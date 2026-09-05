SET lock_timeout = '3s';

-- Statement round email v2 + the "contacted" mark (v2.2812 / v2.2813).
--
-- Owner ask: the round email must read as the account man's own account —
-- "this GC should never be surprised by what they owe us; until you mark a
-- statement sent, that's yours to fix." The email needs, per ready GC: the
-- aging pressure, the AP contact, the last statement date, the last word
-- and its temperature. And the round gains a third mark, `contacted`
-- ("spoke with them, no statement"), which carries a required temperature
-- read (hot / warm / cool / cold) and an optional expected pay date.
--
-- 1. gc_statement_round_marks: action check widened to contacted; new
--    columns temperature + expected_pay_by. A contacted mark never counts as
--    a statement sent (mergeMarksIntoLastSent / the pills filter on 'sent').
-- 2. get_statement_round_for_user re-created (4th cut, body from
--    20260904204442) with the per-GC fields the redesigned email renders,
--    held items with their reason, the sender's book total, and the week's
--    deadline (Friday of the Monday-keyed Chicago week).

-- ── 1. Marks: contacted + temperature + expected pay date ────────────────────

ALTER TABLE public.gc_statement_round_marks
  DROP CONSTRAINT IF EXISTS gc_statement_round_marks_action_check;
ALTER TABLE public.gc_statement_round_marks
  ADD CONSTRAINT gc_statement_round_marks_action_check
  CHECK (action IN ('sent', 'skipped', 'contacted'));

ALTER TABLE public.gc_statement_round_marks
  ADD COLUMN IF NOT EXISTS temperature text,
  ADD COLUMN IF NOT EXISTS expected_pay_by date;

ALTER TABLE public.gc_statement_round_marks
  DROP CONSTRAINT IF EXISTS gc_statement_round_marks_temperature_check;
ALTER TABLE public.gc_statement_round_marks
  ADD CONSTRAINT gc_statement_round_marks_temperature_check
  CHECK (temperature IS NULL OR temperature IN ('hot', 'warm', 'cool', 'cold'));

COMMENT ON COLUMN public.gc_statement_round_marks.temperature IS
  'The account man''s read of the GC after a contact (v2.2813): hot = pay date in hand, warm = fine no date, cool = dodging the date, cold = disputing or upset. Required by the app on a contacted mark; optional on a send.';
COMMENT ON COLUMN public.gc_statement_round_marks.expected_pay_by IS
  'When the GC said they would pay, if they said (v2.2813). Feeds the round email and the temperature board.';
COMMENT ON TABLE public.gc_statement_round_marks IS
  'Personal statement round marks (v2.2072 → v2.2813): one row per (week, GC), upsertable. sent = the assigned sender emailed the certified statement (channel + optional note); skipped = deferred this week; contacted = spoke with the GC without a statement (temperature required, note = "what is their temperature?", optional expected_pay_by). Only sent feeds the last-sent pills and the week''s sent count.';

-- ── 2. Round payload, 4th cut ────────────────────────────────────────────────

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
  SELECT m.gc_customer_id, m.action, m.acted_by
  FROM public.gc_statement_round_marks m
  CROSS JOIN chicago ch
  WHERE m.week_start = ch.monday
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
         m.gc_customer_id, m.note, m.acted_by_name, m.acted_at, m.action, m.temperature
  FROM public.gc_statement_round_marks m
  WHERE m.gc_customer_id IN (SELECT gc_id FROM groups)
    AND NULLIF(trim(COALESCE(m.note, '')), '') IS NOT NULL
  ORDER BY m.gc_customer_id, m.acted_at DESC
),
last_temp AS (
  SELECT DISTINCT ON (m.gc_customer_id)
         m.gc_customer_id, m.temperature, m.acted_by_name, m.acted_at
  FROM public.gc_statement_round_marks m
  WHERE m.gc_customer_id IN (SELECT gc_id FROM groups)
    AND m.temperature IS NOT NULL
  ORDER BY m.gc_customer_id, m.acted_at DESC
),
last_pay_by AS (
  SELECT DISTINCT ON (m.gc_customer_id)
         m.gc_customer_id, m.expected_pay_by
  FROM public.gc_statement_round_marks m
  WHERE m.gc_customer_id IN (SELECT gc_id FROM groups)
    AND m.expected_pay_by IS NOT NULL
  ORDER BY m.gc_customer_id, m.acted_at DESC
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
         COALESCE(c.statement_sender_user_id, ab.am_id) AS sender_user_id,
         cs.cert_state, cs.certified_by_name, cs.certified_at,
         CASE
           WHEN m.action IS NOT NULL THEN m.action
           WHEN cs.cert_state <> 'certified' THEN 'needs_certify'
           WHEN COALESCE(c.statement_sender_user_id, ab.am_id) IS NULL THEN 'needs_sender'
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
  LEFT JOIN cert_state cs ON cs.gc_id = g.gc_id
  LEFT JOIN marks m ON m.gc_customer_id = g.gc_id
  LEFT JOIN last_statement ls ON ls.gc_id = g.gc_id
  LEFT JOIN last_word lw ON lw.gc_customer_id = g.gc_id
  LEFT JOIN last_temp lt ON lt.gc_customer_id = g.gc_id
  LEFT JOIN last_pay_by lp ON lp.gc_customer_id = g.gc_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'week_start', to_char((SELECT monday FROM chicago), 'YYYY-MM-DD'),
  'deadline', to_char((SELECT monday FROM chicago) + 4, 'YYYY-MM-DD'),
  'user_id', p_user_id,
  'ready', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'gc_id', i.gc_id,
      'gc_name', i.gc_name,
      'amount', round(i.subtotal, 2),
      'job_count', i.job_count,
      'oldest_age_days', i.oldest_age_days,
      'over_90', round(i.over_90, 2),
      'certified_by_name', i.certified_by_name,
      'certified_at', i.certified_at,
      'ap_email', i.ap_email,
      'ap_phone', i.ap_phone,
      'last_statement_at', i.last_statement_at,
      'last_word', CASE WHEN i.last_word_note IS NULL THEN NULL ELSE jsonb_build_object(
        'note', i.last_word_note, 'by', i.last_word_by, 'at', i.last_word_at, 'action', i.last_word_action, 'temperature', i.last_word_temperature) END,
      'last_temperature', CASE WHEN i.last_temperature IS NULL THEN NULL ELSE jsonb_build_object(
        'temperature', i.last_temperature, 'by', i.last_temperature_by, 'at', i.last_temperature_at) END,
      'expected_pay_by', i.expected_pay_by
    ) ORDER BY i.subtotal DESC, i.gc_name)
    FROM items i
    WHERE i.state = 'ready' AND i.sender_user_id = p_user_id
  ), '[]'::jsonb),
  'held', jsonb_build_object(
    'count', (SELECT count(*) FROM items WHERE state = 'needs_certify' AND sender_user_id = p_user_id),
    'total', COALESCE((SELECT round(sum(subtotal), 2) FROM items WHERE state = 'needs_certify' AND sender_user_id = p_user_id), 0),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('gc_id', i.gc_id, 'gc_name', i.gc_name, 'amount', round(i.subtotal, 2), 'reason', i.cert_state) ORDER BY i.subtotal DESC)
      FROM items i WHERE i.state = 'needs_certify' AND i.sender_user_id = p_user_id
    ), '[]'::jsonb)
  ),
  'assigned_to_me', (SELECT count(*) FROM items WHERE sender_user_id = p_user_id),
  'sent_by_me', (SELECT count(*) FROM items WHERE state = 'sent' AND sender_user_id = p_user_id),
  'contacted_by_me', (SELECT count(*) FROM items WHERE state = 'contacted' AND sender_user_id = p_user_id),
  'book_total', COALESCE((SELECT round(sum(subtotal), 2) FROM items WHERE sender_user_id = p_user_id), 0)
);
$function$;

COMMENT ON FUNCTION public.get_statement_round_for_user(uuid) IS
  'One sender''s personal statement round (v2.2771 → v2.2812), server-side mirror of buildStatementRound: GC groups >= $10,000 (active billing only), certified this week (snapshot diff with the client''s row keys), unmarked, assigned to p_user_id. v2.2812 adds per-GC aging over 90, AP contact, last statement, last word / temperature / expected pay date, held items with reasons, the sender''s book total, and the week''s Friday deadline. Service-role only.';
