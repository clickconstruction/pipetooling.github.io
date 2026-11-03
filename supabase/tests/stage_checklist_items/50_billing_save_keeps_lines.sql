-- The job form's billing save keeps the job's line ids (punch list #237, v2.6420). Until v2.6420 the save deleted every
-- line of the job and re-inserted the form's rows without their ids (writeBillingSlice over fixtureInsertRows), and the
-- schema took the rest: ON DELETE CASCADE on fixture_id deleted every answer, job item and skip of the stage's checklist
-- and the stage's window; ON DELETE SET NULL took the stage off a report photo and a job photo; the stage's crew-reported
-- progress and the line's created_at, never in the payload, reset; and the activity trigger wrote Specific work added
-- for every line on every save, since its dedupe keys on the line's id. Nothing on prod protected these rows: no trigger
-- re-links them and no constraint is deferred. This bed seeds two jobs alike and replays each save as the office, under
-- RLS, as PostgREST writes it: the save before v2.6420 on job A, to show what it took, and the save since on job B,
-- upsert by id then delete the rest, to show every row standing unchanged, a dropped line gone and a new line landing
-- under the id the form minted. Should a later change protect these rows another way, job A's half is the part to
-- rewrite. Fixtures are written as postgres; the saves run as Rosa; everything rolls back. Writes down each miss and
-- raises at the end with the list; ends with "billing_save_keeps_lines PASSED". See scripts/pgtest-stage-checklist-items.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa is the office (assistant), Dee the dev whose jobs these are, Hal a helper on both teams.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000237301', 'rosa@keeps.test'),
  ('00000000-0000-0000-0000-000000237303', 'dee@keeps.test'),
  ('00000000-0000-0000-0000-000000237306', 'hal@keeps.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000237301', 'rosa@keeps.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-000000237303', 'dee@keeps.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-000000237306', 'hal@keeps.test', 'Hal Helper', 'helpers', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000002373f9', 'Keeps Bed Work');
INSERT INTO public.stage_checklist_templates (id, stage_kind, words, asks_photo) VALUES
  ('00000000-0000-0000-0000-0000002373c1', 'rough_in', 'Is the vent through the roof?', false),
  ('00000000-0000-0000-0000-0000002373c2', 'rough_in', 'Is the sleeve set?', false);
INSERT INTO public.report_templates (id, name) VALUES ('00000000-0000-0000-0000-0000002373f8', 'Keeps bed report');

CREATE SCHEMA sbk;
-- An id is 2373, the job's letter and one more character: 0 the job, 1 the Rough In, 2 the Top Out, 3 the Trim Set the
-- office takes off, 4 the check added for the job, 5 the answer, 6 the skip, 7 the window, 8 the report, 9 its photo,
-- a the job photo, b the line the office adds.
CREATE FUNCTION sbk.id(tag text, n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-0000-0000-0000002373' || tag || n)::uuid
$$;
-- Two jobs seeded alike: three stage lines, and on the Rough In an answer, a check added for the job, a skipped company
-- question, a window, a report photo, a job photo and the crew's 40%, made weeks ago.
CREATE FUNCTION sbk.seed(tag text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id, status)
    VALUES (sbk.id(tag, '0'), '00000000-0000-0000-0000-000000237303', '00000000-0000-0000-0000-0000002373f9', 'Keeps job ' || tag, NULL, 'working');
  INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (sbk.id(tag, '0'), '00000000-0000-0000-0000-000000237306');
  INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, sequence_order, "count", line_unit_price, line_kind, stage_kind, created_at, progress_pct, progress_at, progress_by) VALUES
    (sbk.id(tag, '1'), sbk.id(tag, '0'), 'Rough In', 0, 1, 1000, 'work', 'order', '2026-10-01 12:00+00', 40, '2026-10-20 15:30+00', '00000000-0000-0000-0000-000000237306'),
    (sbk.id(tag, '2'), sbk.id(tag, '0'), 'Top Out', 1, 1, 500, 'work', 'order', '2026-10-01 12:00+00', NULL, NULL, NULL),
    (sbk.id(tag, '3'), sbk.id(tag, '0'), 'Trim Set', 2, 1, 300, 'work', 'order', '2026-10-01 12:00+00', NULL, NULL, NULL);
  INSERT INTO public.stage_checklist_templates (id, stage_kind, words, job_id, fixture_id, created_by, created_by_name)
    VALUES (sbk.id(tag, '4'), 'rough_in', 'Is the roof jack flashed?', sbk.id(tag, '0'), sbk.id(tag, '1'), '00000000-0000-0000-0000-000000237301', 'Rosa Office');
  INSERT INTO public.stage_checklist_answers (id, job_id, fixture_id, question_id, pick, note, answered_by, answered_by_name, answered_at)
    VALUES (sbk.id(tag, '5'), sbk.id(tag, '0'), sbk.id(tag, '1'), '00000000-0000-0000-0000-0000002373c1', 'yes', 'Vent is through', '00000000-0000-0000-0000-000000237306', 'Hal Helper', '2026-10-20 15:00+00');
  INSERT INTO public.stage_checklist_skips (id, job_id, fixture_id, question_id, why, skipped_by, skipped_by_name)
    VALUES (sbk.id(tag, '6'), sbk.id(tag, '0'), sbk.id(tag, '1'), '00000000-0000-0000-0000-0000002373c2', 'No sleeve on this job', '00000000-0000-0000-0000-000000237301', 'Rosa Office');
  INSERT INTO public.job_stage_windows (id, job_id, fixture_id, window_start, window_end, window_by)
    VALUES (sbk.id(tag, '7'), sbk.id(tag, '0'), sbk.id(tag, '1'), '2026-11-10', '2026-11-14', 'office');
  INSERT INTO public.reports (id, job_ledger_id, template_id, created_by_user_id)
    VALUES (sbk.id(tag, '8'), sbk.id(tag, '0'), '00000000-0000-0000-0000-0000002373f8', '00000000-0000-0000-0000-000000237306');
  INSERT INTO public.report_photos (id, job_id, report_id, fixture_id, stage_name, by_user_id, by_name, storage_path)
    VALUES (sbk.id(tag, '9'), sbk.id(tag, '0'), sbk.id(tag, '8'), sbk.id(tag, '1'), 'Rough In', '00000000-0000-0000-0000-000000237306', 'Hal Helper', sbk.id(tag, '0')::text || '/' || sbk.id(tag, '9')::text || '.jpg');
  INSERT INTO public.job_photo_notes (id, job_id, fixture_id, stage_name, description, by_user_id, by_name, added_at)
    VALUES (sbk.id(tag, 'a'), sbk.id(tag, '0'), sbk.id(tag, '1'), 'Rough In', 'The north wall, roughed in', '00000000-0000-0000-0000-000000237306', 'Hal Helper', now());
END $$;
SELECT sbk.seed('a');
SELECT sbk.seed('b');

CREATE TABLE sbk.lost (n serial PRIMARY KEY, what text NOT NULL);
CREATE TABLE sbk.kept (kind text NOT NULL, id uuid NOT NULL, label text NOT NULL, body jsonb NOT NULL);

-- An assertion writes down a miss and goes on; the last statement raises with the whole list.
CREATE FUNCTION sbk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    INSERT INTO sbk.lost (what) VALUES (format('%s: got %s, want %s', label, coalesce(got, 'nothing'), coalesce(want, 'nothing')));
    RAISE NOTICE 'LOST: %: got %, want %', label, got, want;
    RETURN;
  END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sbk.miss(label text, why text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO sbk.lost (what) VALUES (format('%s: %s', label, why));
  RAISE NOTICE 'LOST: %: %', label, why;
END $$;
-- A statement that must run, as the caller.
CREATE FUNCTION sbk.runs(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    PERFORM sbk.miss(label, 'it was refused, ' || SQLERRM);
    RETURN;
  END;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sbk.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

-- Behind the gates. What names one stage line, and the line itself: its place, its price, the day it was made and the
-- crew's progress. Null for a line that is gone.
CREATE FUNCTION sbk.on_line(p_line uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT format('answers %s, items %s, skips %s, windows %s, report photos %s, job photos %s',
    (SELECT count(*) FROM public.stage_checklist_answers WHERE fixture_id = p_line),
    (SELECT count(*) FROM public.stage_checklist_templates WHERE fixture_id = p_line),
    (SELECT count(*) FROM public.stage_checklist_skips WHERE fixture_id = p_line),
    (SELECT count(*) FROM public.job_stage_windows WHERE fixture_id = p_line),
    (SELECT count(*) FROM public.report_photos WHERE fixture_id = p_line),
    (SELECT count(*) FROM public.job_photo_notes WHERE fixture_id = p_line))
$$;
CREATE FUNCTION sbk.line(p_line uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT format('%s at %s for %s, made %s, progress %s by %s at %s',
    name, sequence_order, line_unit_price, (created_at AT TIME ZONE 'UTC')::date,
    coalesce(progress_pct::text, 'none'), coalesce(right(progress_by::text, 2), 'nobody'),
    coalesce(to_char(progress_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'), 'never'))
  FROM public.jobs_ledger_fixtures WHERE id = p_line
$$;
CREATE FUNCTION sbk.lines(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(name || ' at ' || sequence_order, ', ' ORDER BY sequence_order), 'no lines')
  FROM public.jobs_ledger_fixtures WHERE job_id = p_job
$$;
-- What a job's sheet, its Subs tab and its photo lists read, by the filters the client's reads use.
CREATE FUNCTION sbk.on_job(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT format('answers %s, items %s, skips %s, windows %s, photos with a stage %s',
    (SELECT count(*) FROM public.stage_checklist_answers WHERE job_id = p_job),
    (SELECT count(*) FROM public.stage_checklist_templates WHERE job_id = p_job AND retired_at IS NULL),
    (SELECT count(*) FROM public.stage_checklist_skips WHERE job_id = p_job AND put_back_at IS NULL),
    (SELECT count(*) FROM public.job_stage_windows WHERE job_id = p_job),
    (SELECT count(*) FROM public.report_photos WHERE job_id = p_job AND fixture_id IS NOT NULL)
      + (SELECT count(*) FROM public.job_photo_notes WHERE job_id = p_job AND fixture_id IS NOT NULL))
$$;
-- Every row on a job that names a line, whole, and a record of them to compare against after a save.
CREATE FUNCTION sbk.keep(p_job uuid) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM sbk.kept WHERE true;
  INSERT INTO sbk.kept (kind, id, label, body)
    SELECT 'answer', a.id, 'the answer to "' || q.words || '"', to_jsonb(a)
      FROM public.stage_checklist_answers a JOIN public.stage_checklist_templates q ON q.id = a.question_id WHERE a.job_id = p_job
    UNION ALL
    SELECT 'item', t.id, 'the job item "' || t.words || '"', to_jsonb(t)
      FROM public.stage_checklist_templates t WHERE t.job_id = p_job
    UNION ALL
    SELECT 'skip', s.id, 'the skip of "' || q.words || '"', to_jsonb(s)
      FROM public.stage_checklist_skips s JOIN public.stage_checklist_templates q ON q.id = s.question_id WHERE s.job_id = p_job
    UNION ALL
    SELECT 'window', w.id, 'the window on ' || f.name, to_jsonb(w)
      FROM public.job_stage_windows w JOIN public.jobs_ledger_fixtures f ON f.id = w.fixture_id WHERE w.job_id = p_job
    UNION ALL
    SELECT 'report photo', p.id, 'the report photo of ' || p.stage_name, to_jsonb(p)
      FROM public.report_photos p WHERE p.job_id = p_job
    UNION ALL
    SELECT 'job photo', n.id, 'the job photo of ' || n.stage_name, to_jsonb(n)
      FROM public.job_photo_notes n WHERE n.job_id = p_job;
$$;
CREATE FUNCTION sbk.row_now(p_kind text, p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT to_jsonb(a) FROM public.stage_checklist_answers a WHERE p_kind = 'answer' AND a.id = p_id
  UNION ALL SELECT to_jsonb(t) FROM public.stage_checklist_templates t WHERE p_kind = 'item' AND t.id = p_id
  UNION ALL SELECT to_jsonb(s) FROM public.stage_checklist_skips s WHERE p_kind = 'skip' AND s.id = p_id
  UNION ALL SELECT to_jsonb(w) FROM public.job_stage_windows w WHERE p_kind = 'window' AND w.id = p_id
  UNION ALL SELECT to_jsonb(p) FROM public.report_photos p WHERE p_kind = 'report photo' AND p.id = p_id
  UNION ALL SELECT to_jsonb(n) FROM public.job_photo_notes n WHERE p_kind = 'job photo' AND n.id = p_id
$$;
-- Every row in the record that is missing or changed in anything at all.
CREATE FUNCTION sbk.gone() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(k.label, '; ' ORDER BY k.label), 'nothing')
  FROM sbk.kept k
  WHERE sbk.row_now(k.kind, k.id) IS DISTINCT FROM k.body
$$;
-- The Specific work added lines on a job's activity (jobs_ledger_fixtures_to_activity, deduped by the line's id).
CREATE FUNCTION sbk.added_events(p_job uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.job_activity_events WHERE job_id = p_job AND event_type = 'fixture_added'
$$;
GRANT USAGE ON SCHEMA sbk TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sbk TO authenticated;

-- 0 · Both jobs read alike before either save.
SELECT sbk.same('job A, before: the Rough In carries its rows', sbk.on_line(sbk.id('a', '1')), 'answers 1, items 1, skips 1, windows 1, report photos 1, job photos 1');
SELECT sbk.same('job A, before: the Rough In as made', sbk.line(sbk.id('a', '1')), 'Rough In at 0 for 1000.00, made 2026-10-01, progress 40 by 06 at 2026-10-20 15:30');
SELECT sbk.same('job B, before: the same', sbk.on_line(sbk.id('b', '1')) || ' / ' || sbk.line(sbk.id('b', '1')), 'answers 1, items 1, skips 1, windows 1, report photos 1, job photos 1 / Rough In at 0 for 1000.00, made 2026-10-01, progress 40 by 06 at 2026-10-20 15:30');
SELECT sbk.added_events(sbk.id('a', '0')) AS a_events_before \gset
SELECT sbk.added_events(sbk.id('b', '0')) AS b_events_before \gset

-- 1 · Job A gets the save before v2.6420, as Rosa under RLS, as PostgREST wrote it: the office changed the Rough In's
--     price to 1200, took the Trim Set off and added a Water heater. Every line of the job is deleted, then the form's
--     rows are inserted one at a time without their ids.
SELECT sbk.as_user('00000000-0000-0000-0000-000000237301');
SET LOCAL ROLE authenticated;
SELECT sbk.runs('the save before v2.6420, as Rosa: delete every line of job A', format($q$DELETE FROM public.jobs_ledger_fixtures WHERE job_id = %L$q$, sbk.id('a', '0')));
SELECT sbk.runs('the save before v2.6420: re-insert the Rough In without its id', format($q$INSERT INTO public.jobs_ledger_fixtures (job_id, name, sequence_order, line_description, invoice_id, "count", line_unit_price, line_kind, discount_pct, discount_basis_positions, discount_reason, stage_kind, shared_with_gc, bill_to_party) VALUES (%L, 'Rough In', 0, NULL, NULL, 1, 1200, 'work', NULL, NULL, NULL, 'order', false, NULL)$q$, sbk.id('a', '0')));
SELECT sbk.runs('the save before v2.6420: re-insert the Top Out without its id', format($q$INSERT INTO public.jobs_ledger_fixtures (job_id, name, sequence_order, line_description, invoice_id, "count", line_unit_price, line_kind, discount_pct, discount_basis_positions, discount_reason, stage_kind, shared_with_gc, bill_to_party) VALUES (%L, 'Top Out', 1, NULL, NULL, 1, 500, 'work', NULL, NULL, NULL, 'order', false, NULL)$q$, sbk.id('a', '0')));
SELECT sbk.runs('the save before v2.6420: insert the Water heater without its id', format($q$INSERT INTO public.jobs_ledger_fixtures (job_id, name, sequence_order, line_description, invoice_id, "count", line_unit_price, line_kind, discount_pct, discount_basis_positions, discount_reason, stage_kind, shared_with_gc, bill_to_party) VALUES (%L, 'Water heater', 2, NULL, NULL, 1, 800, 'work', NULL, NULL, NULL, 'any', false, NULL)$q$, sbk.id('a', '0')));
RESET ROLE;
SELECT sbk.same('the save before v2.6420 left no line under its old id', (SELECT count(*)::text FROM public.jobs_ledger_fixtures WHERE id IN (sbk.id('a', '1'), sbk.id('a', '2'), sbk.id('a', '3'))), '0');
SELECT sbk.same('the save before v2.6420 took every row on the Rough In with the line', sbk.on_line(sbk.id('a', '1')), 'answers 0, items 0, skips 0, windows 0, report photos 0, job photos 0');
SELECT sbk.same('the save before v2.6420: job A''s sheet, Subs tab and photos read nothing on a stage', sbk.on_job(sbk.id('a', '0')), 'answers 0, items 0, skips 0, windows 0, photos with a stage 0');
SELECT sbk.same('the save before v2.6420: the new Rough In reads made today with no progress', sbk.line((SELECT id FROM public.jobs_ledger_fixtures WHERE job_id = sbk.id('a', '0') AND name = 'Rough In')), format('Rough In at 0 for 1200.00, made %s, progress none by nobody at never', (now() AT TIME ZONE 'UTC')::date));
SELECT sbk.same('the save before v2.6420: the activity says Specific work added for every line again', (sbk.added_events(sbk.id('a', '0')) - :a_events_before)::text, '3');

-- 2 · Job B gets the save since v2.6420, the same edit, as Rosa under RLS, as PostgREST writes it: the lines worth keeping
--     upserted under their own ids in one statement with every column the slice owns, then the job's lines not among
--     them deleted.
SELECT sbk.keep(sbk.id('b', '0'));
SELECT sbk.as_user('00000000-0000-0000-0000-000000237301');
SET LOCAL ROLE authenticated;
SELECT sbk.runs('the save since v2.6420, as Rosa: upsert job B''s lines under their own ids', format($q$INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, sequence_order, line_description, invoice_id, "count", line_unit_price, line_kind, discount_pct, discount_basis_positions, discount_reason, stage_kind, shared_with_gc, bill_to_party, budget_labor_pct, budget_materials_pct, budget_source, budget_tuned_at, budget_rate_usd) VALUES
    (%L, %L, 'Rough In', 0, NULL, NULL, 1, 1200, 'work', NULL, NULL, NULL, 'order', false, NULL, NULL, NULL, NULL, NULL, NULL),
    (%L, %L, 'Top Out', 1, NULL, NULL, 1, 500, 'work', NULL, NULL, NULL, 'order', false, NULL, NULL, NULL, NULL, NULL, NULL),
    (%L, %L, 'Water heater', 2, NULL, NULL, 1, 800, 'work', NULL, NULL, NULL, 'any', false, NULL, NULL, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET job_id = EXCLUDED.job_id, name = EXCLUDED.name, sequence_order = EXCLUDED.sequence_order, line_description = EXCLUDED.line_description, invoice_id = EXCLUDED.invoice_id, "count" = EXCLUDED."count", line_unit_price = EXCLUDED.line_unit_price, line_kind = EXCLUDED.line_kind, discount_pct = EXCLUDED.discount_pct, discount_basis_positions = EXCLUDED.discount_basis_positions, discount_reason = EXCLUDED.discount_reason, stage_kind = EXCLUDED.stage_kind, shared_with_gc = EXCLUDED.shared_with_gc, bill_to_party = EXCLUDED.bill_to_party, budget_labor_pct = EXCLUDED.budget_labor_pct, budget_materials_pct = EXCLUDED.budget_materials_pct, budget_source = EXCLUDED.budget_source, budget_tuned_at = EXCLUDED.budget_tuned_at, budget_rate_usd = EXCLUDED.budget_rate_usd$q$,
  sbk.id('b', '1'), sbk.id('b', '0'), sbk.id('b', '2'), sbk.id('b', '0'), sbk.id('b', 'b'), sbk.id('b', '0')));
SELECT sbk.runs('the save since v2.6420: delete job B''s lines not among them', format($q$DELETE FROM public.jobs_ledger_fixtures WHERE job_id = %L AND NOT (id IN (%L, %L, %L))$q$, sbk.id('b', '0'), sbk.id('b', '1'), sbk.id('b', '2'), sbk.id('b', 'b')));
RESET ROLE;
SELECT sbk.same('the save since v2.6420 kept the Rough In''s id, its date and its progress, and wrote the new price', sbk.line(sbk.id('b', '1')), 'Rough In at 0 for 1200.00, made 2026-10-01, progress 40 by 06 at 2026-10-20 15:30');
SELECT sbk.same('the Rough In still carries its rows', sbk.on_line(sbk.id('b', '1')), 'answers 1, items 1, skips 1, windows 1, report photos 1, job photos 1');
SELECT sbk.same('nothing on job B is gone or changed', sbk.gone(), 'nothing');
SELECT sbk.same('job B''s sheet, Subs tab and photos read what they did', sbk.on_job(sbk.id('b', '0')), 'answers 1, items 1, skips 1, windows 1, photos with a stage 2');
SELECT sbk.same('the Top Out kept its id and its date', sbk.line(sbk.id('b', '2')), 'Top Out at 1 for 500.00, made 2026-10-01, progress none by nobody at never');
SELECT sbk.same('the Trim Set the office took off is gone', (SELECT count(*)::text FROM public.jobs_ledger_fixtures WHERE id = sbk.id('b', '3')), '0');
SELECT sbk.same('the Water heater landed under the id the form minted', sbk.line(sbk.id('b', 'b')), format('Water heater at 2 for 800.00, made %s, progress none by nobody at never', (now() AT TIME ZONE 'UTC')::date));
SELECT sbk.same('job B reads the form''s three lines in order', sbk.lines(sbk.id('b', '0')), 'Rough In at 0, Top Out at 1, Water heater at 2');
SELECT sbk.same('the activity says Specific work added once, for the new line', (sbk.added_events(sbk.id('b', '0')) - :b_events_before)::text, '1');

DO $$
DECLARE
  v_lost text;
BEGIN
  SELECT string_agg(what, E'\n' ORDER BY n) INTO v_lost FROM sbk.lost;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION E'What the billing save lost, or did not do:\n%', v_lost;
  END IF;
  RAISE NOTICE 'billing_save_keeps_lines PASSED';
END $$;
ROLLBACK;
