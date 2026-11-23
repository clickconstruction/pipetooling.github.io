SET lock_timeout = '3s';

-- The office's statement week says how much it left out (v2.8320, punch list #301, the owner's call of
-- 2026-11-22). get_statement_week_for_office (last defined in 20260928040549) builds on
-- get_gc_statement_email_payload, which since 20261123010000 keeps a bill an in kind deal pays off a
-- GC's rows and sums. So the week's amounts, its over 90 days and its $10,000 line already leave such a
-- bill out. This adds one key, in_kind (count, dollars): the bills GCs pay that a deal covers, summed
-- from the payload's GC groups. statement-round-email-dispatch prints one line from it.
--
-- The body is otherwise verbatim. get_my_statement_week() calls this function and passes the new key
-- through. No new table, so the read-only policy re-apply calls are not needed. Grants are unchanged.

CREATE OR REPLACE FUNCTION public.get_statement_week_for_office()
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
-- The client's row key (GcReviewRow.key via buildBilledStageRows): a billed-
-- status job with exactly one billed line is a merged row keyed by job id, a
-- shell (no line) is keyed by job id, everything else by invoice id.
group_rows AS (
  SELECT g.gc_id,
         r->>'job_id' AS job_id,
         CASE
           WHEN r->>'row_key' = r->>'job_id' THEN r->>'job_id'
           WHEN jl.status = 'billed' AND count(*) OVER (PARTITION BY g.gc_id, r->>'job_id') = 1 THEN r->>'job_id'
           ELSE r->>'row_key'
         END AS client_key,
         (r->>'remaining')::numeric AS remaining,
         NULLIF(r->>'age_days', '')::int AS age_days
  FROM groups g
  CROSS JOIN LATERAL jsonb_array_elements(g.rows) r
  JOIN public.jobs_ledger jl ON jl.id = (r->>'job_id')::uuid
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
         c.certified_by_name,
         c.certified_at
  FROM groups g
  LEFT JOIN latest_cert c ON c.gc_customer_id = g.gc_id
),
marks AS (
  SELECT m.gc_customer_id, m.action, m.acted_by,
         (m.action = 'contacted' OR m.temperature IS NOT NULL) AS carries_word
  FROM public.gc_statement_round_marks m
  CROSS JOIN chicago ch
  WHERE m.week_start = ch.monday
),
-- An app-sent statement this week counts as sent, mark or no mark.
app_sent AS (
  SELECT DISTINCT e.gc_customer_id
  FROM public.gc_statement_emails e
  CROSS JOIN chicago ch
  WHERE e.gc_customer_id IS NOT NULL
    AND (e.sent_at AT TIME ZONE 'America/Chicago')::date >= ch.monday
),
-- Any week: the newest statement send (a sent mark or an app email), the
-- newest mark with a note ("last word"), the newest temperature, the newest
-- expected pay date.
last_statement AS (
  SELECT g.gc_id,
         GREATEST(
           (SELECT max(m.acted_at) FROM public.gc_statement_round_marks m WHERE m.gc_customer_id = g.gc_id AND m.action = 'sent'),
           (SELECT max(e.sent_at) FROM public.gc_statement_emails e WHERE e.gc_customer_id = g.gc_id)
         ) AS at
  FROM groups g
),
last_word AS (
  SELECT DISTINCT ON (m.gc_customer_id)
         m.gc_customer_id, m.note,
         COALESCE(NULLIF(trim(COALESCE(m.word_from_name, '')), ''), m.acted_by_name) AS acted_by_name,
         COALESCE(m.word_at, m.acted_at) AS acted_at, m.action, m.temperature
  FROM public.gc_statement_round_marks m
  WHERE m.gc_customer_id IN (SELECT gc_id FROM groups)
    AND NULLIF(trim(COALESCE(m.note, '')), '') IS NOT NULL
  ORDER BY m.gc_customer_id, COALESCE(m.word_at, m.acted_at) DESC
),
last_temp AS (
  SELECT DISTINCT ON (m.gc_customer_id)
         m.gc_customer_id, m.temperature,
         COALESCE(NULLIF(trim(COALESCE(m.word_from_name, '')), ''), m.acted_by_name) AS acted_by_name,
         COALESCE(m.word_at, m.acted_at) AS acted_at
  FROM public.gc_statement_round_marks m
  WHERE m.gc_customer_id IN (SELECT gc_id FROM groups)
    AND m.temperature IS NOT NULL
  ORDER BY m.gc_customer_id, COALESCE(m.word_at, m.acted_at) DESC
),
last_pay_by AS (
  SELECT DISTINCT ON (m.gc_customer_id)
         m.gc_customer_id, m.expected_pay_by
  FROM public.gc_statement_round_marks m
  WHERE m.gc_customer_id IN (SELECT gc_id FROM groups)
    AND m.expected_pay_by IS NOT NULL
  ORDER BY m.gc_customer_id, COALESCE(m.word_at, m.acted_at) DESC
),
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
         COALESCE((SELECT sum(gr.remaining) FROM group_rows gr WHERE gr.gc_id = g.gc_id AND gr.age_days >= 90), 0) AS over_90,
         COALESCE(c.statement_sender_user_id, ab.am_id) AS owner_user_id,
         NULLIF(trim(COALESCE(ou.name, '')), '') AS owner_name,
         cs.cert_state, cs.certified_by_name, cs.certified_at,
         (COALESCE(m.action, '') = 'sent' OR aps.gc_customer_id IS NOT NULL) AS sent,
         COALESCE(m.carries_word, false) AS word_in,
         COALESCE(m.action, '') = 'skipped' AS skipped,
         -- The week's list (gcWorklist.ts): check, then send, then the word. A word taken early never skips the statement.
         CASE
           WHEN COALESCE(m.action, '') = 'skipped' THEN 'skipped'
           WHEN COALESCE(m.action, '') = 'sent' OR aps.gc_customer_id IS NOT NULL THEN
             CASE WHEN COALESCE(m.carries_word, false) THEN 'done' ELSE 'needs_word' END
           WHEN cs.cert_state <> 'certified' THEN 'needs_certify'
           ELSE 'ready'
         END AS state,
         NULLIF(trim(COALESCE(c.contact_info->>'email', '')), '') AS ap_email,
         NULLIF(trim(COALESCE(c.contact_info->>'phone', '')), '') AS ap_phone,
         ls.at AS last_statement_at,
         lw.note AS last_word_note, lw.acted_by_name AS last_word_by, lw.acted_at AS last_word_at, lw.action AS last_word_action, lw.temperature AS last_word_temperature,
         lt.temperature AS last_temperature, lt.acted_by_name AS last_temperature_by, lt.acted_at AS last_temperature_at,
         lp.expected_pay_by
  FROM groups g
  LEFT JOIN public.customers c ON c.id = g.gc_id
  LEFT JOIN am_best ab ON ab.gc_id = g.gc_id
  LEFT JOIN public.users ou ON ou.id = COALESCE(c.statement_sender_user_id, ab.am_id)
  LEFT JOIN cert_state cs ON cs.gc_id = g.gc_id
  LEFT JOIN marks m ON m.gc_customer_id = g.gc_id
  LEFT JOIN app_sent aps ON aps.gc_customer_id = g.gc_id
  LEFT JOIN last_statement ls ON ls.gc_id = g.gc_id
  LEFT JOIN last_word lw ON lw.gc_customer_id = g.gc_id
  LEFT JOIN last_temp lt ON lt.gc_customer_id = g.gc_id
  LEFT JOIN last_pay_by lp ON lp.gc_customer_id = g.gc_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'week_start', to_char((SELECT monday FROM chicago), 'YYYY-MM-DD'),
  'deadline', to_char((SELECT monday FROM chicago) + 4, 'YYYY-MM-DD'),
  'today', to_char((SELECT today FROM chicago), 'YYYY-MM-DD'),
  'office', true,
  -- Every GC over the line, in the order the office should take them: a broken promise, then the largest balance.
  'items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'gc_id', i.gc_id,
      'gc_name', i.gc_name,
      'amount', round(i.subtotal, 2),
      'job_count', i.job_count,
      'oldest_age_days', i.oldest_age_days,
      'over_90', round(i.over_90, 2),
      'owner_user_id', i.owner_user_id,
      'owner_name', i.owner_name,
      'state', i.state,
      'checked', i.cert_state = 'certified',
      'sent', i.sent,
      'word_in', i.word_in,
      'cert_state', i.cert_state,
      'certified_by_name', i.certified_by_name,
      'certified_at', i.certified_at,
      'ap_email', i.ap_email,
      'ap_phone', i.ap_phone,
      'last_statement_at', i.last_statement_at,
      'last_word', CASE WHEN i.last_word_note IS NULL THEN NULL ELSE jsonb_build_object(
        'note', i.last_word_note, 'by', i.last_word_by, 'at', i.last_word_at, 'action', i.last_word_action, 'temperature', i.last_word_temperature) END,
      'last_temperature', CASE WHEN i.last_temperature IS NULL THEN NULL ELSE jsonb_build_object(
        'temperature', i.last_temperature, 'by', i.last_temperature_by, 'at', i.last_temperature_at) END,
      'expected_pay_by', i.expected_pay_by,
      'promise_late', (i.expected_pay_by IS NOT NULL AND i.expected_pay_by < (SELECT today FROM chicago) AND round(i.subtotal * 100) > 0),
      'days_late', CASE WHEN i.expected_pay_by IS NOT NULL AND i.expected_pay_by < (SELECT today FROM chicago) THEN ((SELECT today FROM chicago) - i.expected_pay_by) ELSE 0 END
    ) ORDER BY (i.expected_pay_by IS NOT NULL AND i.expected_pay_by < (SELECT today FROM chicago)) DESC, i.subtotal DESC, i.gc_name)
    FROM items i
  ), '[]'::jsonb),
  -- The bills GCs pay that an in kind deal covers (v2.8320, punch list #301): on no item above and in no count below.
  -- Counted from the payload's own groups, a GC under the $10,000 line included, so the email can say where the money
  -- went when a GC leaves the list. Zero before migration 20261123010000 gave the payload its in_kind key.
  'in_kind', (
    SELECT jsonb_build_object(
      'count', COALESCE(sum((g->'in_kind'->>'count')::int), 0),
      'dollars', round(COALESCE(sum((g->'in_kind'->>'dollars')::numeric), 0), 2))
    FROM payload, jsonb_array_elements(p->'groups') g
    WHERE COALESCE((g->>'is_no_entity')::boolean, true) = false
      AND g->>'entity_id' IS NOT NULL
  ),
  'counts', jsonb_build_object(
    'gcs', (SELECT count(*) FROM items),
    'to_check', (SELECT count(*) FROM items WHERE state = 'needs_certify'),
    'to_send', (SELECT count(*) FROM items WHERE state = 'ready'),
    'to_send_total', COALESCE((SELECT round(sum(subtotal), 2) FROM items WHERE state = 'ready'), 0),
    'words_due', (SELECT count(*) FROM items WHERE NOT word_in AND NOT skipped),
    'done', (SELECT count(*) FROM items WHERE state = 'done'),
    'late', (SELECT count(*) FROM items WHERE expected_pay_by IS NOT NULL AND expected_pay_by < (SELECT today FROM chicago)),
    'total', COALESCE((SELECT round(sum(subtotal), 2) FROM items), 0)
  )
);
$function$;
