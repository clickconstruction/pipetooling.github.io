SET lock_timeout = '3s';

-- Statement round RPC: diff with the CLIENT's row keys (v2.2771 follow-up,
-- same PR). The first cut (20260904201238) keyed every invoice row by invoice
-- id; the GC Review rollup keys a job with exactly one billed invoice by JOB
-- id (buildBilledStageRows → job_with_merged_billed), so every such GC read
-- "changed since certified" server-side while the panel showed it certified —
-- caught by the pre-first-dispatch fidelity check (Malachi: 0 ready vs 2 in
-- the panel). Body otherwise identical; re-keys in a group_rows CTE.

CREATE OR REPLACE FUNCTION public.get_statement_round_for_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH chicago AS (
  SELECT today,
         (today - ((EXTRACT(ISODOW FROM today)::int - 1)))::date AS monday
  FROM (SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today) t
),
payload AS (
  SELECT public.get_gc_statement_email_payload('gc', NULL, false) AS p
),
groups AS (
  SELECT (g->>'entity_id')::uuid AS gc_id,
         g->>'entity_name' AS gc_name,
         (g->>'subtotal')::numeric AS subtotal,
         (g->>'job_count')::int AS job_count,
         NULLIF(g->>'oldest_age_days', '')::int AS oldest_age_days,
         COALESCE(g->'rows', '[]'::jsonb) AS rows
  FROM payload, jsonb_array_elements(p->'groups') g
  WHERE COALESCE((g->>'is_no_entity')::boolean, true) = false
    AND g->>'entity_id' IS NOT NULL
    AND (g->>'subtotal')::numeric >= 10000
),
-- The client's row key (GcReviewRow.key via buildBilledStageRows): a job with
-- exactly ONE billed invoice is a merged job row keyed by job id, a job with
-- none is a shell keyed by job id, two or more become invoice rows keyed by
-- invoice id. The payload's row_key is the invoice id for every invoice row,
-- so re-key single-invoice jobs here before diffing against the snapshot.
group_rows AS (
  SELECT g.gc_id,
         r->>'job_id' AS job_id,
         CASE
           WHEN r->>'row_key' = r->>'job_id' THEN r->>'job_id'
           WHEN count(*) OVER (PARTITION BY g.gc_id, r->>'job_id') = 1 THEN r->>'job_id'
           ELSE r->>'row_key'
         END AS client_key,
         (r->>'remaining')::numeric AS remaining
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(g.rows) r
),
latest_cert AS (
  SELECT DISTINCT ON (c.gc_customer_id)
         c.gc_customer_id, c.total, c.snapshot, c.certified_by_name, c.certified_at
  FROM public.gc_review_certifications c
  CROSS JOIN chicago ch
  WHERE c.week_start = ch.monday
  ORDER BY c.gc_customer_id, c.certified_at DESC
),
cert_state AS (
  -- Mirrors gcGroupCertStatus: no cert → uncertified; unreadable snapshot →
  -- compare totals; else the row set (key + remaining cents) must match.
  SELECT g.gc_id,
         CASE
           WHEN c.gc_customer_id IS NULL THEN 'uncertified'
           WHEN c.snapshot IS NULL OR jsonb_typeof(c.snapshot->'rows') <> 'array' THEN
             CASE WHEN round(g.subtotal * 100) = round(COALESCE(c.total, 0) * 100) THEN 'certified' ELSE 'changed' END
           WHEN (SELECT count(DISTINCT s->>'key') FROM jsonb_array_elements(c.snapshot->'rows') s)
                <> (SELECT count(*) FROM group_rows gr WHERE gr.gc_id = g.gc_id) THEN 'changed'
           WHEN EXISTS (
             SELECT 1 FROM group_rows gr
             WHERE gr.gc_id = g.gc_id
               AND NOT EXISTS (
                 SELECT 1 FROM jsonb_array_elements(c.snapshot->'rows') s
                 WHERE s->>'key' = gr.client_key
                   AND round((s->>'remaining')::numeric * 100) = round(gr.remaining * 100)
               )
           ) THEN 'changed'
           ELSE 'certified'
         END AS cert_state,
         c.certified_by_name
  FROM groups g
  LEFT JOIN latest_cert c ON c.gc_customer_id = g.gc_id
),
marks AS (
  SELECT m.gc_customer_id, m.action, m.acted_by
  FROM public.gc_statement_round_marks m
  CROSS JOIN chicago ch
  WHERE m.week_start = ch.monday
),
-- Account Man fallback: the most common account_manager_user_id over the
-- group's rows (deriveGcAccountMen tallies per row, not per job).
am AS (
  SELECT g.gc_id, jl.account_manager_user_id AS am_id, count(*) AS n
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(g.rows) r
  JOIN public.jobs_ledger jl ON jl.id = (r->>'job_id')::uuid
  WHERE jl.account_manager_user_id IS NOT NULL
  GROUP BY g.gc_id, jl.account_manager_user_id
),
am_best AS (
  SELECT DISTINCT ON (gc_id) gc_id, am_id FROM am ORDER BY gc_id, n DESC, am_id
),
items AS (
  SELECT g.gc_id, g.gc_name, g.subtotal, g.job_count, g.oldest_age_days,
         COALESCE(c.statement_sender_user_id, ab.am_id) AS sender_user_id,
         cs.cert_state, cs.certified_by_name,
         CASE
           WHEN m.action IS NOT NULL THEN m.action
           WHEN cs.cert_state <> 'certified' THEN 'needs_certify'
           WHEN COALESCE(c.statement_sender_user_id, ab.am_id) IS NULL THEN 'needs_sender'
           ELSE 'ready'
         END AS state
  FROM groups g
  LEFT JOIN public.customers c ON c.id = g.gc_id
  LEFT JOIN am_best ab ON ab.gc_id = g.gc_id
  LEFT JOIN cert_state cs ON cs.gc_id = g.gc_id
  LEFT JOIN marks m ON m.gc_customer_id = g.gc_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'week_start', to_char((SELECT monday FROM chicago), 'YYYY-MM-DD'),
  'user_id', p_user_id,
  'ready', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'gc_id', i.gc_id,
      'gc_name', i.gc_name,
      'amount', round(i.subtotal, 2),
      'job_count', i.job_count,
      'oldest_age_days', i.oldest_age_days,
      'certified_by_name', i.certified_by_name
    ) ORDER BY i.subtotal DESC, i.gc_name)
    FROM items i
    WHERE i.state = 'ready' AND i.sender_user_id = p_user_id
  ), '[]'::jsonb),
  'held', jsonb_build_object(
    'count', (SELECT count(*) FROM items WHERE state = 'needs_certify'),
    'total', COALESCE((SELECT round(sum(subtotal), 2) FROM items WHERE state = 'needs_certify'), 0)
  ),
  'assigned_to_me', (SELECT count(*) FROM items WHERE sender_user_id = p_user_id),
  'sent_by_me', (SELECT count(*) FROM items WHERE state = 'sent' AND sender_user_id = p_user_id)
);
$function$;
