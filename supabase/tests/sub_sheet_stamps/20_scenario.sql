-- The sub sheet's two days (residential Messages R8 · 12, PR 2, migration *_sub_sheet_on_site_done): on_site_at is the
-- first report of a percent above 0 while the sheet is Working, and never the 0% report, a note with no new percent or
-- the "my work is done" press; done_at is the first move out of Working, cleared by a move back and set again by the
-- next move out. Then the backfill: with the trigger off, sheets gather their reports and moves in the activity feed;
-- the migration once more at the -- @rerun line (the bed script streams it in there, as a second push would) fills
-- both days from the feed, done_at falling back to stage_changed_at for a sheet past Working, and touches no row it
-- does not fill. The portal's writes are made as postgres, standing in for the service role, with the same columns
-- submit-sub-portal sets; the office's move runs set_sub_sheet_stage as a dev. Everything rolls back. Raises on the
-- first failed assertion; ends with "sub_sheet_stamps PASSED". See scripts/pgtest-sub-sheet-stamps.sh. Never prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000009d1', 'dev@stamps.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@stamps.test', 'Stamps Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = false, is_digital_twin = false;
INSERT INTO public.jobs_ledger (id) VALUES ('00000000-0000-0000-0000-0000000009a1');

CREATE SCHEMA sss;
CREATE FUNCTION sss.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A sheet's two days as one line: on_site_at | done_at, in Chicago, '-' for none.
CREATE FUNCTION sss.days(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(to_char(on_site_at AT TIME ZONE 'America/Chicago', 'MM-DD HH24:MI'), '-') || ' | '
      || coalesce(to_char(done_at AT TIME ZONE 'America/Chicago', 'MM-DD HH24:MI'), '-')
    FROM public.people_labor_jobs WHERE id = p_id
$$;
CREATE FUNCTION sss.sheet(p_id uuid, p_linked boolean) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_ledger_id)
  VALUES (p_id, '00000000-0000-0000-0000-0000000009d1', 'Stamps Sub',
          CASE WHEN p_linked THEN '00000000-0000-0000-0000-0000000009a1'::uuid END)
$$;
-- The portal's progress report, as submit-sub-portal writes it: a new percent, or a note (p_pct NULL) that keeps the
-- one before. With p_line, the sub_progress feed line the portal writes beside it, carrying the percent the sheet kept.
CREATE FUNCTION sss.report(p_id uuid, p_pct integer, p_at timestamptz, p_line boolean DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.people_labor_jobs
     SET progress_pct = coalesce(p_pct, progress_pct, 0), progress_at = p_at, progress_source = 'portal',
         progress_note = CASE WHEN p_pct IS NULL THEN 'a note' ELSE progress_note END
   WHERE id = p_id;
  IF p_line THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, summary, detail, financial)
    SELECT job_ledger_id, 'sub_progress', p_at, 'Stamps Sub · along on their part',
           jsonb_build_object('laborJobId', id, 'pct', progress_pct, 'note', progress_note, 'source', 'portal'), false
      FROM public.people_labor_jobs WHERE id = p_id;
  END IF;
END $$;
-- "My work here is done" from the portal.
CREATE FUNCTION sss.done_press(p_id uuid, p_at timestamptz) RETURNS void LANGUAGE sql AS $$
  UPDATE public.people_labor_jobs
     SET stage = 'walkthrough', stage_changed_at = p_at, stage_changed_by = NULL, stage_source = 'portal',
         progress_pct = 100, progress_at = p_at, progress_source = 'portal'
   WHERE id = p_id AND stage = 'working'
$$;
-- An office move with its own time, as set_sub_sheet_stage writes it.
CREATE FUNCTION sss.move(p_id uuid, p_stage text, p_at timestamptz) RETURNS void LANGUAGE sql AS $$
  UPDATE public.people_labor_jobs
     SET stage = p_stage, stage_changed_at = p_at, stage_source = 'office'
   WHERE id = p_id AND stage IS DISTINCT FROM p_stage
$$;

-- 1. The columns and the trigger.
SELECT sss.same('the two days are timestamps',
  (SELECT string_agg(column_name || ' ' || data_type, ', ' ORDER BY column_name) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'people_labor_jobs' AND column_name IN ('on_site_at', 'done_at')),
  'done_at timestamp with time zone, on_site_at timestamp with time zone');
SELECT sss.same('one trigger wakes on the report and the stage only',
  (SELECT replace(pg_get_triggerdef(t.oid), 'public.', '') FROM pg_trigger t
    WHERE t.tgrelid = 'public.people_labor_jobs'::regclass AND t.tgname = 'people_labor_jobs_flow_stamps_biu'),
  'CREATE TRIGGER people_labor_jobs_flow_stamps_biu BEFORE INSERT OR UPDATE OF progress_at, progress_pct, stage ON people_labor_jobs FOR EACH ROW EXECUTE FUNCTION people_labor_jobs_flow_stamps()');

-- 2. On site, report by report (sheet A).
SELECT sss.sheet('00000000-0000-0000-0000-0000000009b1', true);
SELECT sss.same('a new sheet has neither day', sss.days('00000000-0000-0000-0000-0000000009b1'), '- | -');
SELECT sss.report('00000000-0000-0000-0000-0000000009b1', 0, '2026-10-05 08:00-05');
SELECT sss.same('a 0% report is not on site', sss.days('00000000-0000-0000-0000-0000000009b1'), '- | -');
SELECT sss.report('00000000-0000-0000-0000-0000000009b1', NULL, '2026-10-05 09:00-05');
SELECT sss.same('a note with no percent is not on site', sss.days('00000000-0000-0000-0000-0000000009b1'), '- | -');
SELECT sss.report('00000000-0000-0000-0000-0000000009b1', 25, '2026-10-06 10:15-05');
SELECT sss.same('the first real percent is on site', sss.days('00000000-0000-0000-0000-0000000009b1'), '10-06 10:15 | -');
SELECT sss.report('00000000-0000-0000-0000-0000000009b1', 50, '2026-10-07 11:00-05');
SELECT sss.report('00000000-0000-0000-0000-0000000009b1', NULL, '2026-10-07 15:00-05');
SELECT sss.same('later reports and notes keep the first day', sss.days('00000000-0000-0000-0000-0000000009b1'), '10-06 10:15 | -');

-- 3. Done, move by move (sheet A). The office's move through its own RPC stamps the move's time.
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000009d1', 'role', 'authenticated')::text, true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000009d1', true);
SELECT sss.same('the office moves it to the walk-through',
  public.set_sub_sheet_stage('00000000-0000-0000-0000-0000000009b1', 'walkthrough', NULL)::text, '{"ok": true, "stage": "walkthrough"}');
SELECT sss.same('done is the time of the move out of Working',
  (SELECT (done_at = stage_changed_at AND done_at = now())::text FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-0000000009b1'), 'true');
SELECT sss.same('the move keeps the day on site',
  (SELECT to_char(on_site_at AT TIME ZONE 'America/Chicago', 'MM-DD HH24:MI') FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-0000000009b1'), '10-06 10:15');
SELECT sss.move('00000000-0000-0000-0000-0000000009b1', 'customer_pay', '2026-10-09 09:00-05');
SELECT sss.same('on to the customer keeps the day it was done',
  (SELECT (done_at = now())::text FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-0000000009b1'), 'true');
UPDATE public.people_labor_jobs SET stage = 'customer_pay' WHERE id = '00000000-0000-0000-0000-0000000009b1';
SELECT sss.same('a write of the same stage keeps it',
  (SELECT (done_at = now())::text FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-0000000009b1'), 'true');
SELECT sss.move('00000000-0000-0000-0000-0000000009b1', 'working', '2026-10-10 08:00-05');
SELECT sss.same('back to Working clears done and keeps on site', sss.days('00000000-0000-0000-0000-0000000009b1'), '10-06 10:15 | -');
SELECT sss.move('00000000-0000-0000-0000-0000000009b1', 'walkthrough', '2026-10-12 16:30-05');
SELECT sss.same('the next move out stamps done again', sss.days('00000000-0000-0000-0000-0000000009b1'), '10-06 10:15 | 10-12 16:30');

-- 4. "My work is done" on a sheet with no report (sheet C): done, never on site.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009b3', true);
SELECT sss.done_press('00000000-0000-0000-0000-0000000009b3', '2026-10-08 17:45-05');
SELECT sss.same('done never fills on site', sss.days('00000000-0000-0000-0000-0000000009b3'), '- | 10-08 17:45');

-- 5. A move that leaves stage_changed_at alone (sheet D) is done at the write.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009b4', false);
UPDATE public.people_labor_jobs SET stage = 'walkthrough' WHERE id = '00000000-0000-0000-0000-0000000009b4';
SELECT sss.same('a move with no time of its own is done now',
  (SELECT (done_at = now())::text FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-0000000009b4'), 'true');

-- 6. Sheets born already moving (E, F, G).
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, stage, stage_changed_at) VALUES
  ('00000000-0000-0000-0000-0000000009b5', '00000000-0000-0000-0000-0000000009d1', 'Stamps Sub', 'walkthrough', '2026-10-03 12:00-05'),
  ('00000000-0000-0000-0000-0000000009b6', '00000000-0000-0000-0000-0000000009d1', 'Stamps Sub', 'customer_pay', NULL);
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, progress_pct, progress_at) VALUES
  ('00000000-0000-0000-0000-0000000009b7', '00000000-0000-0000-0000-0000000009d1', 'Stamps Sub', 50, '2026-10-04 07:30-05');
SELECT sss.same('born past Working, done at its stage time', sss.days('00000000-0000-0000-0000-0000000009b5'), '- | 10-03 12:00');
SELECT sss.same('born past Working with no time, no day is made up', sss.days('00000000-0000-0000-0000-0000000009b6'), '- | -');
SELECT sss.same('born Working with a percent, on site', sss.days('00000000-0000-0000-0000-0000000009b7'), '10-04 07:30 | -');

-- 7. The backfill. With the trigger off, sheets gather reports and moves the way they did before this migration.
ALTER TABLE public.people_labor_jobs DISABLE TRIGGER people_labor_jobs_flow_stamps_biu;
-- H: 0%, 50%, a note, 75%; out, on, back, out again. The stage trigger writes each move's feed line.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009c1', true);
SELECT sss.report('00000000-0000-0000-0000-0000000009c1', 0, '2026-09-21 08:00-05', true);
SELECT sss.report('00000000-0000-0000-0000-0000000009c1', 50, '2026-09-22 09:10-05', true);
SELECT sss.report('00000000-0000-0000-0000-0000000009c1', NULL, '2026-09-22 14:00-05', true);
SELECT sss.report('00000000-0000-0000-0000-0000000009c1', 75, '2026-09-23 10:00-05', true);
SELECT sss.move('00000000-0000-0000-0000-0000000009c1', 'walkthrough', '2026-09-24 16:00-05');
SELECT sss.move('00000000-0000-0000-0000-0000000009c1', 'customer_pay', '2026-09-25 09:00-05');
SELECT sss.move('00000000-0000-0000-0000-0000000009c1', 'working', '2026-09-26 08:00-05');
SELECT sss.move('00000000-0000-0000-0000-0000000009c1', 'walkthrough', '2026-09-29 15:20-05');
SELECT sss.move('00000000-0000-0000-0000-0000000009c1', 'customer_pay', '2026-09-30 11:00-05');
SELECT sss.same('the feed kept every move of H',
  (SELECT string_agg((detail ->> 'from') || '>' || (detail ->> 'to'), ' ' ORDER BY occurred_at) FROM public.job_activity_events
    WHERE event_type = 'sub_stage_change' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000009c1'),
  'working>walkthrough walkthrough>customer_pay customer_pay>working working>walkthrough walkthrough>customer_pay');
-- I: past Working with no job, so no feed line: stage_changed_at is the day.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009c2', false);
SELECT sss.move('00000000-0000-0000-0000-0000000009c2', 'walkthrough', '2026-09-27 13:00-05');
-- J: out and back, Working now: no done day.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009c3', true);
SELECT sss.move('00000000-0000-0000-0000-0000000009c3', 'walkthrough', '2026-09-28 10:00-05');
SELECT sss.move('00000000-0000-0000-0000-0000000009c3', 'working', '2026-09-28 15:00-05');
-- K: both days already set, say by the live trigger: the backfill leaves them though the feed says otherwise.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009c4', true);
SELECT sss.report('00000000-0000-0000-0000-0000000009c4', 25, '2026-09-20 08:00-05', true);
SELECT sss.move('00000000-0000-0000-0000-0000000009c4', 'walkthrough', '2026-09-20 17:00-05');
UPDATE public.people_labor_jobs SET on_site_at = '2026-09-19 07:00-05', done_at = '2026-09-19 18:00-05' WHERE id = '00000000-0000-0000-0000-0000000009c4';
-- L: "my work is done" with no report: done from its move, never on site.
SELECT sss.sheet('00000000-0000-0000-0000-0000000009c5', true);
SELECT sss.done_press('00000000-0000-0000-0000-0000000009c5', '2026-10-01 16:00-05');
ALTER TABLE public.people_labor_jobs ENABLE TRIGGER people_labor_jobs_flow_stamps_biu;
SELECT sss.same('with the trigger off, H, I and L have no days yet',
  sss.days('00000000-0000-0000-0000-0000000009c1') || ' / ' || sss.days('00000000-0000-0000-0000-0000000009c2') || ' / ' || sss.days('00000000-0000-0000-0000-0000000009c5'),
  '- | - / - | - / - | -');
-- Where each row lives now: an UPDATE gives a row a new place, so an unmoved place is a row the backfill left alone.
CREATE TABLE sss.before AS SELECT id, ctid::text AS place FROM public.people_labor_jobs WHERE id::text LIKE '00000000-0000-0000-0000-0000000009%';
-- @rerun
SELECT sss.same('H: on site is the first real percent, done the newest move out of Working',
  sss.days('00000000-0000-0000-0000-0000000009c1'), '09-22 09:10 | 09-29 15:20');
SELECT sss.same('I: no feed line, so done is its stage time', sss.days('00000000-0000-0000-0000-0000000009c2'), '- | 09-27 13:00');
SELECT sss.same('J: Working now, so no done day', sss.days('00000000-0000-0000-0000-0000000009c3'), '- | -');
SELECT sss.same('K: days already set are kept', sss.days('00000000-0000-0000-0000-0000000009c4'), '09-19 07:00 | 09-19 18:00');
SELECT sss.same('L: done from its move, never on site', sss.days('00000000-0000-0000-0000-0000000009c5'), '- | 10-01 16:00');
SELECT sss.same('the backfill touched only H, I and L',
  (SELECT string_agg(right(b.id::text, 3), ' ' ORDER BY b.id) FROM sss.before b JOIN public.people_labor_jobs s ON s.id = b.id WHERE s.ctid::text <> b.place),
  '9c1 9c2 9c5');
SELECT sss.same('the trigger is on again after the second run',
  (SELECT tgenabled::text FROM pg_trigger WHERE tgrelid = 'public.people_labor_jobs'::regclass AND tgname = 'people_labor_jobs_flow_stamps_biu'), 'O');

DO $$ BEGIN RAISE NOTICE 'sub_sheet_stamps PASSED'; END $$;
ROLLBACK;
