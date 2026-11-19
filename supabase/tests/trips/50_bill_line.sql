-- Put a trip on a bill (migration *_trip_bill_line, punch list #391): the mark on a line and the one function that
-- writes it. The column, its foreign key and its unique index; who may press, by role, and the three accounts a
-- definer has to refuse itself; a trip that is not Extra; a job that is not the trip's; the GC desk's billing job;
-- the amount and the name; a dry run that writes nothing; the line, its position, the total with the riders and the
-- History row; a second press answered as a duplicate; a site's job joining the trip's jobs; a job that holds its
-- own trip; a save that renames the line and keeps the mark; a deleted line that frees the trip; and a deleted trip
-- that leaves the line; and Add discount, which refuses the GC desk's billing job too. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on
-- the first failed assertion; ends with "trips bill line PASSED". See scripts/pgtest-trips.sh. Never against prod.
-- Every name and figure here is made up.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office (assistant), Marcus a master, Devon a dev, Cole the controller: the four roles that may add a
-- discount to a job. Pat is a primary: in the trips office, not among the four. Luis (superintendent) is on the
-- trip. Priya estimates. Tara is an assistant in training, Tess an assistant twin, Gwen an assistant who left.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003910a1', 'dana@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a2', 'marcus@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a3', 'luis@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a5', 'pat@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a6', 'cole@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a7', 'priya@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a8', 'gwen@tripline.test'),
  ('00000000-0000-0000-0000-0000003910a9', 'tess@tripline.test'),
  ('00000000-0000-0000-0000-0000003910ab', 'devon@tripline.test'),
  ('00000000-0000-0000-0000-0000003910ac', 'tara@tripline.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003910a1', 'dana@tripline.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910a2', 'marcus@tripline.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910a3', 'luis@tripline.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910a5', 'pat@tripline.test', 'Pat Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910a6', 'cole@tripline.test', 'Cole Controller', 'controller', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910a7', 'priya@tripline.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910a8', 'gwen@tripline.test', 'Gwen Gone', 'assistant', false, false, false, now(), now()),
  ('00000000-0000-0000-0000-0000003910a9', 'tess@tripline.test', 'Tess Twin', 'assistant', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910ab', 'devon@tripline.test', 'Devon Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003910ac', 'tara@tripline.test', 'Tara Training', 'assistant', true, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA tbl;
CREATE FUNCTION tbl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION tbl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION tbl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The press on the Heron Point trip and its clubhouse job, as the window sends it; and its reply in one line.
CREATE FUNCTION tbl.press(p_trip uuid, p_job uuid, p_amount numeric, p_dry boolean DEFAULT false, p_name text DEFAULT 'Trip 1, crew of 4, Nov 2 to Nov 8') RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.trip_put_on_job_line(p_trip, p_job, p_amount, p_name, 'Reset the riser the framers moved. Asked by Walt, by phone.', p_dry)
$$;
CREATE FUNCTION tbl.said(r jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN (r->>'dry_run')::boolean THEN 'dry run' ELSE 'written' END
    || CASE WHEN (r->>'duplicate')::boolean THEN ', duplicate' ELSE '' END
    || ', line ' || CASE WHEN r->>'fixture_id' IS NULL THEN 'none' ELSE 'given' END
    || ', ' || (r->>'revenue_before') || ' to ' || (r->>'revenue_after')
$$;
-- What a job holds, read as postgres: its lines in order with their marks, and its total.
CREATE FUNCTION tbl.lines(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE(string_agg(f.sequence_order::text || ':' || f.name || ' ' || f.line_unit_price::text || CASE WHEN f.trip_id IS NULL THEN '' ELSE ' [trip]' END, ' | ' ORDER BY f.sequence_order), 'no lines')
    || ' = ' || (SELECT j.revenue::text FROM public.jobs_ledger j WHERE j.id = p_job)
  FROM public.jobs_ledger_fixtures f WHERE f.job_id = p_job
$$;
GRANT USAGE ON SCHEMA tbl TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tbl TO authenticated, anon;

-- Two sites. Heron Point has a clubhouse job with a price, a discount and a hazmat fee, a pool house job with no
-- line, and the GC desk's billing job. Egret Landing has one job. One far job is on no site.
INSERT INTO public.developments (id, master_user_id, name) VALUES
  ('00000000-0000-0000-0000-0000003910d1', '00000000-0000-0000-0000-0000003910a2', 'Heron Point'),
  ('00000000-0000-0000-0000-0000003910d2', '00000000-0000-0000-0000-0000003910a2', 'Egret Landing');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003910f9', 'Trip Line Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000003910b1', '00000000-0000-0000-0000-0000003910a2', '00000000-0000-0000-0000-0000003910f9', 'Heron Point Clubhouse', '00000000-0000-0000-0000-0000003910d1'),
  ('00000000-0000-0000-0000-0000003910b2', '00000000-0000-0000-0000-0000003910a2', '00000000-0000-0000-0000-0000003910f9', 'Heron Point Pool House', '00000000-0000-0000-0000-0000003910d1'),
  ('00000000-0000-0000-0000-0000003910b3', '00000000-0000-0000-0000-0000003910a2', '00000000-0000-0000-0000-0000003910f9', 'Egret Landing Lodge', '00000000-0000-0000-0000-0000003910d2'),
  ('00000000-0000-0000-0000-0000003910b4', '00000000-0000-0000-0000-0000003910a2', '00000000-0000-0000-0000-0000003910f9', 'A far job on no site', NULL),
  ('00000000-0000-0000-0000-0000003910b5', '00000000-0000-0000-0000-0000003910a2', '00000000-0000-0000-0000-0000003910f9', 'Heron Point owner billing', '00000000-0000-0000-0000-0000003910d1');
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_kind) VALUES
  ('00000000-0000-0000-0000-0000003910c1', '00000000-0000-0000-0000-0000003910b1', 'Bid price', 1, 0, 184000, 'work'),
  ('00000000-0000-0000-0000-0000003910c2', '00000000-0000-0000-0000-0000003910b1', 'Loyalty discount', 1, 1, -4000, 'discount');
INSERT INTO public.job_hazmat_incidents (id, job_id, description, tos_clause_snapshot, fee_amount) VALUES
  ('00000000-0000-0000-0000-0000003910e9', '00000000-0000-0000-0000-0000003910b1', 'Trip line bed incident', 'Clause as shown.', 50);
UPDATE public.jobs_ledger SET revenue = 180050 WHERE id = '00000000-0000-0000-0000-0000003910b1';
UPDATE public.jobs_ledger SET revenue = 0 WHERE id IN ('00000000-0000-0000-0000-0000003910b2', '00000000-0000-0000-0000-0000003910b4');
UPDATE public.jobs_ledger SET revenue = 900000 WHERE id = '00000000-0000-0000-0000-0000003910b5';
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000003910f1', 'Trip Line Bed Owner', '00000000-0000-0000-0000-0000003910a2');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000003910f2', 'Heron Point, built as the GC', '00000000-0000-0000-0000-0000003910f1');
INSERT INTO public.gc_projects (project_id, stage, billing_job_id) VALUES
  ('00000000-0000-0000-0000-0000003910f2', 'building', '00000000-0000-0000-0000-0000003910b5');

-- The trips. e1: Extra, at Heron Point, its work on the clubhouse. e2: inside the price. e3: Extra with no job
-- named. e4: Extra, held by the far job. e5: nobody has said how it bills.
INSERT INTO public.trips (id, development_id, job_id, purpose, asked_by, asked_who, asked_how, billing) VALUES
  ('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910d1', NULL, 'Reset the riser the framers moved', 'them', 'Walt, the site super', 'by phone', 'extra'),
  ('00000000-0000-0000-0000-0000003910e2', '00000000-0000-0000-0000-0000003910d1', NULL, 'Rough-in, as priced', 'us', '', '', 'inside'),
  ('00000000-0000-0000-0000-0000003910e3', '00000000-0000-0000-0000-0000003910d1', NULL, 'Move the pool house cleanouts', 'them', 'Walt, the site super', 'by email', 'extra'),
  ('00000000-0000-0000-0000-0000003910e4', NULL, '00000000-0000-0000-0000-0000003910b4', 'A second visit they asked for', 'them', 'Ines', 'by text', 'extra'),
  ('00000000-0000-0000-0000-0000003910e5', '00000000-0000-0000-0000-0000003910d1', NULL, 'A walk of the site', NULL, '', '', NULL);
INSERT INTO public.trip_people (trip_id, user_id, person_name, days) VALUES
  ('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910a3', 'Luis Lead', '{"2026-11-02": "road", "2026-11-03": "site", "2026-11-08": "road"}'),
  ('00000000-0000-0000-0000-0000003910e2', NULL, 'Omar', '{"2026-10-12": "site"}'),
  ('00000000-0000-0000-0000-0000003910e3', NULL, 'Omar', '{"2026-11-10": "site"}'),
  ('00000000-0000-0000-0000-0000003910e4', NULL, 'Priya P.', '{"2026-11-11": "site"}'),
  ('00000000-0000-0000-0000-0000003910e5', NULL, 'Omar', '{"2026-11-12": "site"}');
INSERT INTO public.trip_jobs (trip_id, job_id) VALUES
  ('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1');

-- 0 · The mark: a nullable column, a checked foreign key that lets a trip go, one line a trip, and no door for anon.
SELECT tbl.same('the column is there and nullable', (SELECT data_type || ' ' || is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs_ledger_fixtures' AND column_name = 'trip_id'), 'uuid YES');
SELECT tbl.same('the foreign key is checked and sets null when the trip goes', (SELECT convalidated::text || ' ' || confdeltype::text || ' ' || confrelid::regclass::text FROM pg_constraint WHERE conname = 'jobs_ledger_fixtures_trip_id_fkey' AND conrelid = 'public.jobs_ledger_fixtures'::regclass), 'true n trips');
SELECT tbl.same('one unique index, on marked lines only', (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'jobs_ledger_fixtures' AND indexname = 'jobs_ledger_fixtures_one_line_a_trip' AND indexdef LIKE 'CREATE UNIQUE INDEX%WHERE (trip_id IS NOT NULL)'), '1');
SELECT tbl.same('no line is marked before a press', (SELECT count(*)::text FROM public.jobs_ledger_fixtures WHERE trip_id IS NOT NULL), '0');
SELECT tbl.same('anon cannot run the press, a signed-in person can', has_function_privilege('anon', 'public.trip_put_on_job_line(uuid, uuid, numeric, text, text, boolean)', 'EXECUTE')::text || ' ' || has_function_privilege('authenticated', 'public.trip_put_on_job_line(uuid, uuid, numeric, text, text, boolean)', 'EXECUTE')::text, 'false true');

-- 1 · Who may press. Nobody signed in, then the roles outside the four, then the three accounts behind the fences.
SELECT tbl.refused('nobody signed in', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Sign in first.');
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a5');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('a primary, who reads every trip, is not one of the four', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Putting a trip on a bill is for the office.');
RESET ROLE;
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a3');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('a crew member on the trip', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Putting a trip on a bill is for the office.');
SELECT tbl.refused('a crew member on the trip, on a dry run', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800, true)$q$, 'Putting a trip on a bill is for the office.');
RESET ROLE;
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a7');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('an estimator', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Putting a trip on a bill is for the office.');
RESET ROLE;
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910ac');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('an assistant in training', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Training mode is read-only. No line was added.');
RESET ROLE;
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a9');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('an assistant twin', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'A digital twin puts no trip on a bill.');
RESET ROLE;
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a8');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('an assistant who left', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'This account is archived.');
RESET ROLE;
SELECT tbl.same('none of them wrote a line, a total or a History row', tbl.lines('00000000-0000-0000-0000-0000003910b1') || ' / ' || (SELECT count(*)::text FROM public.job_activity_events WHERE event_type = 'trip_line_added'), '0:Bid price 184000.00 | 1:Loyalty discount -4000.00 = 180050.00 / 0');

-- 2 · Dana, the office: what the press refuses, in words.
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a1');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('a trip inside the price', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e2', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Only a trip marked Extra goes on a bill.');
SELECT tbl.refused('a trip nobody has said the billing of', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e5', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'Only a trip marked Extra goes on a bill.');
SELECT tbl.refused('a trip inside the price, on a dry run', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e2', '00000000-0000-0000-0000-0000003910b1', 6800, true)$q$, 'Only a trip marked Extra goes on a bill.');
SELECT tbl.refused('a job of another site', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b3', 6800)$q$, 'That job is not one of the trip''s jobs or a job of its site.');
SELECT tbl.refused('a job on no site, for a site''s trip', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b4', 6800)$q$, 'That job is not one of the trip''s jobs or a job of its site.');
SELECT tbl.refused('a site''s job, for a trip a far job holds', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e4', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'That job is not one of the trip''s jobs or a job of its site.');
SELECT tbl.refused('the GC desk''s billing job, though it is a job of the site', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b5', 6800)$q$, 'This job is billed from Owner Billing on the GC desk.');
SELECT tbl.refused('the GC desk''s billing job, on a dry run', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b5', 6800, true)$q$, 'This job is billed from Owner Billing on the GC desk.');
SELECT tbl.refused('no amount', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 0)$q$, 'A trip''s line needs an amount.');
SELECT tbl.refused('an amount below nothing', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', -50)$q$, 'A trip''s line needs an amount.');
SELECT tbl.refused('an amount that rounds to nothing', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 0.004)$q$, 'A trip''s line needs an amount.');
SELECT tbl.refused('an amount nobody means', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 1000000.01)$q$, 'That amount is over $1,000,000.');
SELECT tbl.refused('a line with no name', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800, false, '   ')$q$, 'A trip''s line needs a name.');
SELECT tbl.refused('no trip', $q$SELECT tbl.press(NULL, '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'A trip''s line needs the trip and the job.');
SELECT tbl.refused('no job', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910e1', NULL, 6800)$q$, 'A trip''s line needs the trip and the job.');
SELECT tbl.refused('a trip that is gone', $q$SELECT tbl.press('00000000-0000-0000-0000-0000003910ee', '00000000-0000-0000-0000-0000003910b1', 6800)$q$, 'That trip is not here any more.');

-- 3 · A dry run says the total before and after, and writes nothing.
SELECT tbl.same('a dry run says the total before and after', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800, true)), 'dry run, line none, 180050.00 to 186850.00');
RESET ROLE;
SELECT tbl.same('the dry run wrote no line, no total, no job link and no History row', tbl.lines('00000000-0000-0000-0000-0000003910b1') || ' / ' || (SELECT count(*)::text FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000003910e1') || ' / ' || (SELECT count(*)::text FROM public.job_activity_events WHERE event_type = 'trip_line_added'), '0:Bid price 184000.00 | 1:Loyalty discount -4000.00 = 180050.00 / 1 / 0');

-- 4 · The press: one line at the next position, the total written again from the lines and the rider, one History row.
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a1');
SET LOCAL ROLE authenticated;
SELECT tbl.same('the press says the same total before and after as the dry run', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)), 'written, line given, 180050.00 to 186850.00');
RESET ROLE;
SELECT tbl.same('the line sits after the others, and the total is the lines and the hazmat fee', tbl.lines('00000000-0000-0000-0000-0000003910b1'), '0:Bid price 184000.00 | 1:Loyalty discount -4000.00 | 2:Trip 1, crew of 4, Nov 2 to Nov 8 6800.00 [trip] = 186850.00');
SELECT tbl.same('the line is a work line of one, with its words, on no bill, and names its trip', (SELECT line_kind || ' x' || count::text || ' / ' || line_description || ' / ' || COALESCE(invoice_id::text, 'no bill') || ' / ' || trip_id::text FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e1'), 'work x1 / Reset the riser the framers moved. Asked by Walt, by phone. / no bill / 00000000-0000-0000-0000-0000003910e1');
SELECT tbl.same('no two lines of the job share a position', (SELECT count(*)::text || ' lines, ' || count(DISTINCT sequence_order)::text || ' positions' FROM public.jobs_ledger_fixtures WHERE job_id = '00000000-0000-0000-0000-0000003910b1'), '3 lines, 3 positions');
SELECT tbl.same('History holds one money row for the press, by Dana, naming the trip and the line', (SELECT count(*)::text || ' / ' || min(summary) || ' / ' || bool_and(financial)::text || ' / ' || min(actor_user_id::text) || ' / ' || min(detail->>'dollars') || ' / ' || (min(detail->>'fixture_id') = (SELECT id::text FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e1'))::text FROM public.job_activity_events WHERE event_type = 'trip_line_added' AND job_id = '00000000-0000-0000-0000-0000003910b1'), '1 / Trip ' || (SELECT trip_number::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003910e1') || ' put on the job''s lines: Trip 1, crew of 4, Nov 2 to Nov 8 / true / 00000000-0000-0000-0000-0000003910a1 / 6800.00 / true');
SELECT tbl.same('the job was the trip''s already, so its jobs are as they were', (SELECT count(*)::text FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000003910e1'), '1');

-- 5 · One trip, one line. A second press is answered with the line, whoever presses and whatever they send.
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a6');
SET LOCAL ROLE authenticated;
SELECT tbl.same('the controller''s second press, for another job and another amount, is a duplicate', (SELECT tbl.said(r) || ' / ' || (r->>'job_id') FROM tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b2', 9999) AS r), 'written, duplicate, line given, 186850.00 to 186850.00 / 00000000-0000-0000-0000-0000003910b1');
SELECT tbl.same('a dry run on a trip that holds a line says so too', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800, true)), 'dry run, duplicate, line given, 186850.00 to 186850.00');
RESET ROLE;
SELECT tbl.same('the second press wrote nothing anywhere', tbl.lines('00000000-0000-0000-0000-0000003910b1') || ' // ' || tbl.lines('00000000-0000-0000-0000-0000003910b2') || ' // ' || (SELECT count(*)::text FROM public.job_activity_events WHERE event_type = 'trip_line_added'), '0:Bid price 184000.00 | 1:Loyalty discount -4000.00 | 2:Trip 1, crew of 4, Nov 2 to Nov 8 6800.00 [trip] = 186850.00 // no lines = 0.00 // 1');
SELECT tbl.refused('the index refuses a second line for the trip, even written by hand', $q$INSERT INTO public.jobs_ledger_fixtures (job_id, name, count, sequence_order, line_unit_price, line_kind, trip_id) VALUES ('00000000-0000-0000-0000-0000003910b2', 'A second line', 1, 0, 1, 'work', '00000000-0000-0000-0000-0000003910e1')$q$, 'jobs_ledger_fixtures_one_line_a_trip');

-- 6 · A trip with no job named: a master picks one of the site's jobs, and it joins the trip's jobs. A name too
-- long for a line is cut to the line's length.
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a2');
SET LOCAL ROLE authenticated;
SELECT tbl.same('a master puts the trip on one of the site''s jobs', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e3', '00000000-0000-0000-0000-0000003910b2', 2500.5, false, repeat('Trip 3 ', 40))), 'written, line given, 0.00 to 2500.50');
RESET ROLE;
SELECT tbl.same('the picked job joined the trip''s jobs', (SELECT string_agg(job_id::text, ',') FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000003910e3'), '00000000-0000-0000-0000-0000003910b2');
SELECT tbl.same('its line is the job''s first, the name cut to 200', (SELECT sequence_order::text || ' / ' || char_length(name)::text || ' / ' || line_unit_price::text FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e3'), '0 / 200 / 2500.50');

-- 7 · A job that holds its own trip: a dev puts the trip on it.
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910ab');
SET LOCAL ROLE authenticated;
SELECT tbl.same('a dev puts a far job''s trip on that job', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e4', '00000000-0000-0000-0000-0000003910b4', 1200)), 'written, line given, 0.00 to 1200.00');
RESET ROLE;
SELECT tbl.same('the far job holds the line and is among the trip''s jobs', tbl.lines('00000000-0000-0000-0000-0000003910b4') || ' / ' || (SELECT count(*)::text FROM public.trip_jobs WHERE trip_id = '00000000-0000-0000-0000-0000003910e4' AND job_id = '00000000-0000-0000-0000-0000003910b4'), '0:Trip 1, crew of 4, Nov 2 to Nov 8 1200.00 [trip] = 1200.00 / 1');

-- 8 · The trip's billing changed off Extra while its line exists: allowed, and a press is still answered with the line.
UPDATE public.trips SET billing = 'inside' WHERE id = '00000000-0000-0000-0000-0000003910e3';
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a1');
SET LOCAL ROLE authenticated;
SELECT tbl.same('a trip moved off Extra still answers with its line', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e3', '00000000-0000-0000-0000-0000003910b2', 2500.5)), 'written, duplicate, line given, 2500.50 to 2500.50');
RESET ROLE;

-- 9 · The Job window's save writes a line under its own id with the columns it knows. The mark is not one of them,
-- so a rename or a new price leaves it; and a combine moves a line by its job alone.
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name, count, sequence_order, line_unit_price, line_description, invoice_id, line_kind)
SELECT f.id, f.job_id, 'Trip 1, the riser reset', 1, f.sequence_order, 7000, f.line_description, NULL, 'work'
FROM public.jobs_ledger_fixtures f WHERE f.trip_id = '00000000-0000-0000-0000-0000003910e1'
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, count = EXCLUDED.count, sequence_order = EXCLUDED.sequence_order,
  line_unit_price = EXCLUDED.line_unit_price, line_description = EXCLUDED.line_description, invoice_id = EXCLUDED.invoice_id, line_kind = EXCLUDED.line_kind;
SELECT tbl.same('a line renamed and repriced by the window''s save keeps its trip', (SELECT name || ' ' || line_unit_price::text || ' ' || trip_id::text FROM public.jobs_ledger_fixtures WHERE id = (SELECT id FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e1')), 'Trip 1, the riser reset 7000.00 00000000-0000-0000-0000-0000003910e1');
UPDATE public.jobs_ledger_fixtures SET job_id = '00000000-0000-0000-0000-0000003910b3' WHERE trip_id = '00000000-0000-0000-0000-0000003910e4';
SELECT tbl.same('a line moved to another job, as a combine moves it, keeps its trip', (SELECT job_id::text FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e4'), '00000000-0000-0000-0000-0000003910b3');

-- 10 · The mark lives on the line. Delete the line and the trip is free: a press is no duplicate, and writes a new line.
DELETE FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e1';
SELECT tbl.same('the trip is still there, and holds no line', (SELECT count(*)::text FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003910e1') || ' trip, ' || (SELECT count(*)::text FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e1') || ' lines', '1 trip, 0 lines');
-- The total on the job is left wrong and the discount is far down the list, to show the total is written whole from
-- the lines and the line goes past the highest position, not into a gap.
UPDATE public.jobs_ledger SET revenue = 1 WHERE id = '00000000-0000-0000-0000-0000003910b1';
UPDATE public.jobs_ledger_fixtures SET sequence_order = 7 WHERE id = '00000000-0000-0000-0000-0000003910c2';
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a1');
SET LOCAL ROLE authenticated;
SELECT tbl.same('the press works again once the line is gone, and writes the total from the lines, not by a delta', tbl.said(tbl.press('00000000-0000-0000-0000-0000003910e1', '00000000-0000-0000-0000-0000003910b1', 6800)), 'written, line given, 1.00 to 186850.00');
RESET ROLE;
SELECT tbl.same('the new line took the position past the highest', (SELECT sequence_order::text FROM public.jobs_ledger_fixtures WHERE trip_id = '00000000-0000-0000-0000-0000003910e1'), '8');

-- 11 · Delete the trip and the line stays with its words, its price and its place; only the mark goes.
DELETE FROM public.trips WHERE id = '00000000-0000-0000-0000-0000003910e1';
SELECT tbl.same('the line outlives its trip, unmarked, and the total is as it was', tbl.lines('00000000-0000-0000-0000-0000003910b1') || ' / ' || (SELECT line_description FROM public.jobs_ledger_fixtures WHERE job_id = '00000000-0000-0000-0000-0000003910b1' AND sequence_order = 8), '0:Bid price 184000.00 | 7:Loyalty discount -4000.00 | 8:Trip 1, crew of 4, Nov 2 to Nov 8 6800.00 = 186850.00 / Reset the riser the framers moved. Asked by Walt, by phone.');

-- 12 · Add discount (migration *_discount_refuses_gc_billing_job): the GC desk's billing job takes no discount line
-- either, and keeps its total. Any other job takes one as before.
RESET ROLE;
SELECT tbl.as_user('00000000-0000-0000-0000-0000003910a1');
SET LOCAL ROLE authenticated;
SELECT tbl.refused('a discount on the GC desk''s billing job', $q$SELECT public.apply_job_discount('00000000-0000-0000-0000-0000003910b5', 'Goodwill', NULL, 100, NULL, NULL)$q$, 'This job is billed from Owner Billing on the GC desk. Its price changes only by a signed change order');
SELECT tbl.same('a discount on another job is taken as before', (SELECT r->>'ok' FROM public.apply_job_discount('00000000-0000-0000-0000-0000003910b2', 'Goodwill', NULL, 100, NULL, NULL) AS r), 'true');
RESET ROLE;
SELECT tbl.same('the GC billing job keeps its total and gains no line', (SELECT (j.revenue = 900000)::text || ' ' || (SELECT count(*) FROM public.jobs_ledger_fixtures f WHERE f.job_id = j.id)::text FROM public.jobs_ledger j WHERE j.id = '00000000-0000-0000-0000-0000003910b5'), 'true 0');

DO $$ BEGIN RAISE NOTICE 'trips bill line PASSED'; END $$;
ROLLBACK;
