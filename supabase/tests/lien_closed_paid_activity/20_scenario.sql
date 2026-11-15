-- The scenario (v2.7359): after the migration ran twice over the seed, the notice closed before it has one line and
-- nothing else has one; a notice closed now gets its line the moment it is set aside, once; the record without the
-- set-aside, a combine's set-aside and an affidavit write nothing; a thin record still reads; nobody signed in can
-- call the functions. In one transaction that rolls back.
\set ON_ERROR_STOP on
BEGIN;

-- 1. The backfill, and nothing doubled by the second run.
SELECT bedt.ok('the backfill wrote one line, for the notice closed before the migration, and nothing twice',
  (SELECT count(*) FROM public.job_activity_events) = 1
  AND bedt.lines('00000000-0000-0000-0000-00000000000a') = 1);
SELECT bedt.ok('its line is on its job, at the close''s time, nobody''s, financial, with the months in order and the paper''s claim',
  (SELECT l.job_id = '00000000-0000-0000-0000-000000000001'
      AND l.occurred_at = '2026-11-15T18:00:00Z'::timestamptz
      AND l.actor_user_id IS NULL
      AND l.financial
      AND l.summary = 'Lien notice for Aug 2026 and Sep 2026 closed by ZZ Office · the job was paid, nothing was mailed — the paper said $2,400.00'
      AND l.detail ->> 'item_id' = '00000000-0000-0000-0000-00000000000a'
      AND l.detail -> 'months' = '["2026-09", "2026-08"]'::jsonb
      AND (l.detail ->> 'paper_claim')::numeric = 2400
      AND (l.detail ->> 'printed_at')::timestamptz = '2026-10-08T15:00:00Z'::timestamptz
   FROM bedt.line('00000000-0000-0000-0000-00000000000a') l));
SELECT bedt.ok('a combine''s set-aside and an affidavit have no line',
  bedt.lines('00000000-0000-0000-0000-00000000000c') = 0 AND bedt.lines('00000000-0000-0000-0000-00000000000d') = 0);

-- 2. A close now: the press's one update sets the item aside and keeps the record.
UPDATE public.job_lien_desk_items
   SET voided_at = '2026-11-16T14:30:00Z',
       fields = fields || '{"runClosedPaid": {"at": "2026-11-16T14:30:00Z", "by": "00000000-0000-0000-0000-0000000000a1", "byName": "ZZ Office", "printedAt": "2026-10-09T15:00:00Z", "paperClaim": 6150.75}}'::jsonb
 WHERE id = '00000000-0000-0000-0000-00000000000b';
SELECT bedt.ok('the close wrote its line at once, with the claim to the cent',
  (SELECT l.job_id = '00000000-0000-0000-0000-000000000002'
      AND l.occurred_at = '2026-11-16T14:30:00Z'::timestamptz
      AND l.summary = 'Lien notice for Sep 2026 closed by ZZ Office · the job was paid, nothing was mailed — the paper said $6,150.75'
   FROM bedt.line('00000000-0000-0000-0000-00000000000b') l));
UPDATE public.job_lien_desk_items SET fields = fields || '{"note": "touched again"}'::jsonb WHERE id = '00000000-0000-0000-0000-00000000000b';
SELECT bedt.ok('a later update of the closed item writes no second line',
  bedt.lines('00000000-0000-0000-0000-00000000000b') = 1);

-- 3. The record alone is not a close: nothing until the item is set aside.
UPDATE public.job_lien_desk_items SET fields = '{"runClosedPaid": {"at": "not a time"}}'::jsonb WHERE id = '00000000-0000-0000-0000-00000000000e';
SELECT bedt.ok('the record on a live item writes nothing',
  bedt.lines('00000000-0000-0000-0000-00000000000e') = 0);
UPDATE public.job_lien_desk_items SET voided_at = '2026-11-16T15:00:00Z' WHERE id = '00000000-0000-0000-0000-00000000000e';
SELECT bedt.ok('a thin record still reads: no months, no name, no claim, the set-aside''s time',
  (SELECT l.summary = 'Lien notice closed · the job was paid, nothing was mailed'
      AND l.occurred_at = '2026-11-16T15:00:00Z'::timestamptz
      AND l.detail -> 'paper_claim' = 'null'::jsonb
   FROM bedt.line('00000000-0000-0000-0000-00000000000e') l));

-- 4. A set-aside with no record (a job combine) still writes nothing, and the old rows are as they were.
UPDATE public.job_lien_desk_items SET voided_at = '2026-11-16T16:00:00Z' WHERE id = '00000000-0000-0000-0000-00000000000c';
SELECT bedt.ok('three lines in all: the backfill''s and the two closes',
  (SELECT count(*) FROM public.job_activity_events) = 3 AND bedt.lines('00000000-0000-0000-0000-00000000000c') = 0);

-- 5. Neither function is anyone's to call.
SELECT bedt.ok('nobody signed in can call the functions',
  NOT has_function_privilege('authenticated', 'public.job_activity_line_lien_closed_paid(public.job_lien_desk_items)', 'execute')
  AND NOT has_function_privilege('anon', 'public.job_activity_line_lien_closed_paid(public.job_lien_desk_items)', 'execute')
  AND NOT has_function_privilege('authenticated', 'public.job_lien_desk_items_closed_paid_to_activity()', 'execute'));

DO $$ BEGIN RAISE NOTICE 'lien_closed_paid_activity PASSED'; END $$;
ROLLBACK;
