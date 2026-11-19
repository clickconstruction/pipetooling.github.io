-- The sub sheet's tie to one bill (punch list #388, step 1, migration *_sub_sheet_draw_invoice): a sheet that arrives
-- at Waiting on customer takes the job's one open bill when the job has exactly one, and none when it has none or
-- several; a sheet off that stage rides on no bill; a tie to a bill of another job is no tie; deleting the bill
-- clears the tie; and the office picks, changes or clears the tie through set_sub_sheet_draw_invoice, which refuses
-- a sheet off the stage, a bill of another job and a caller who is not an office writer. The office's moves run
-- set_sub_sheet_stage as a signed-in dev. Everything rolls back. Raises on the first failed assertion; ends with
-- "sub_sheet_draw_invoice PASSED". See scripts/pgtest-sub-sheet-draw-invoice.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dara is a dev, Hank a helper. Every name is made up.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003880d1', 'dara@drawtie.test'),
  ('00000000-0000-0000-0000-0000003880d2', 'hank@drawtie.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003880d1', 'dara@drawtie.test', 'Dara Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003880d2', 'hank@drawtie.test', 'Hank Helper', 'helpers', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-000000388051', 'Draw Tie Plumbing');
-- Job A holds the sheet under test. Job B is another job. Job C is found by its number.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000003880a1', '00000000-0000-0000-0000-0000003880d1', '00000000-0000-0000-0000-000000388051', 'Tie job A', 'DT-3881'),
  ('00000000-0000-0000-0000-0000003880a2', '00000000-0000-0000-0000-0000003880d1', '00000000-0000-0000-0000-000000388051', 'Tie job B', 'DT-3882'),
  ('00000000-0000-0000-0000-0000003880a3', '00000000-0000-0000-0000-0000003880d1', '00000000-0000-0000-0000-000000388051', 'Tie job C', 'DT-3883');
-- The scenario counts each job's bills, so it starts from none, whatever a new job is given by itself.
DELETE FROM public.jobs_ledger_invoices
 WHERE job_id IN ('00000000-0000-0000-0000-0000003880a1', '00000000-0000-0000-0000-0000003880a2', '00000000-0000-0000-0000-0000003880a3');

CREATE SCHEMA sdt;
CREATE FUNCTION sdt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sdt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A sheet's tie as the last two letters of the bill's id, '-' for none. Past row-level security.
CREATE FUNCTION sdt.tie(p_sheet uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(right(draw_invoice_id::text, 2), '-') FROM public.people_labor_jobs WHERE id = p_sheet
$$;
-- A sheet's stage. Past row-level security.
CREATE FUNCTION sdt.stage(p_sheet uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT stage FROM public.people_labor_jobs WHERE id = p_sheet
$$;
-- The office's stage move: 'moved', or the refusal's words.
CREATE FUNCTION sdt.move(p_sheet uuid, p_stage text) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(r ->> 'error', 'moved') FROM (SELECT public.set_sub_sheet_stage(p_sheet, p_stage, NULL) AS r) x
$$;
-- The office's pick: 'saved', or the refusal's words.
CREATE FUNCTION sdt.pick(p_sheet uuid, p_bill uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(r ->> 'error', 'saved') FROM (SELECT public.set_sub_sheet_draw_invoice(p_sheet, p_bill) AS r) x
$$;
GRANT USAGE ON SCHEMA sdt TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sdt TO authenticated, anon, service_role;

-- Sheet 1 is on job A, sheet 2 stays Working on job A.
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_ledger_id) VALUES
  ('00000000-0000-0000-0000-0000003880b1', '00000000-0000-0000-0000-0000003880d1', 'Tie Sub', '00000000-0000-0000-0000-0000003880a1'),
  ('00000000-0000-0000-0000-0000003880b2', '00000000-0000-0000-0000-0000003880d1', 'Tie Sub', '00000000-0000-0000-0000-0000003880a1');

-- 1 · The column, the trigger and who may call the pick.
SELECT sdt.same('the tie is a uuid',
  (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'people_labor_jobs' AND column_name = 'draw_invoice_id'), 'uuid');
SELECT sdt.same('one trigger, switched on, after a second run of the migration',
  (SELECT count(*)::text || ' ' || min(tgenabled::text) FROM pg_trigger WHERE tgrelid = 'public.people_labor_jobs'::regclass AND tgname = 'people_labor_jobs_stage_draw_tie_biu'), '1 O');
SELECT sdt.same('deleting the bill clears the tie',
  (SELECT confdeltype::text FROM pg_constraint WHERE conrelid = 'public.people_labor_jobs'::regclass AND contype = 'f' AND confrelid = 'public.jobs_ledger_invoices'::regclass), 'n');
SELECT sdt.same('a signed-in person may call the pick, and nobody signed out',
  has_function_privilege('authenticated', 'public.set_sub_sheet_draw_invoice(uuid, uuid)', 'EXECUTE')::text || ' ' ||
  has_function_privilege('anon', 'public.set_sub_sheet_draw_invoice(uuid, uuid)', 'EXECUTE')::text, 'true false');
SELECT sdt.same('a new sheet rides on no bill', sdt.tie('00000000-0000-0000-0000-0000003880b1'), '-');

-- 2 · Arriving at Waiting on customer, as the office moves the sheet.
SELECT sdt.as_user('00000000-0000-0000-0000-0000003880d1'); SET LOCAL ROLE authenticated;
SELECT sdt.same('the office moves it on a job with no bill', sdt.move('00000000-0000-0000-0000-0000003880b1', 'customer_pay'), 'moved');
SELECT sdt.same('no bill, no tie', sdt.tie('00000000-0000-0000-0000-0000003880b1'), '-');
SELECT sdt.same('back to the walk-through', sdt.move('00000000-0000-0000-0000-0000003880b1', 'walkthrough'), 'moved');
RESET ROLE;
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000003880e1', '00000000-0000-0000-0000-0000003880a1', 0, 'billed', 3000, now());
SET LOCAL ROLE authenticated;
SELECT sdt.same('the office moves it on a job with one open bill', sdt.move('00000000-0000-0000-0000-0000003880b1', 'customer_pay'), 'moved');
SELECT sdt.same('the one open bill is tied by the move itself', sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'e1');
SELECT sdt.same('a move back clears the tie', sdt.move('00000000-0000-0000-0000-0000003880b1', 'walkthrough') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'moved -');
RESET ROLE;
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount) VALUES
  ('00000000-0000-0000-0000-0000003880e2', '00000000-0000-0000-0000-0000003880a1', 1, 'ready_to_bill', 1200);
SET LOCAL ROLE authenticated;
SELECT sdt.same('two open bills, a sent one and a draft: the move ties none', sdt.move('00000000-0000-0000-0000-0000003880b1', 'customer_pay') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'moved -');
SELECT sdt.same('back again', sdt.move('00000000-0000-0000-0000-0000003880b1', 'walkthrough'), 'moved');
RESET ROLE;
UPDATE public.jobs_ledger_invoices SET status = 'paid' WHERE id = '00000000-0000-0000-0000-0000003880e1';
SET LOCAL ROLE authenticated;
SELECT sdt.same('a paid bill is not open: the draft is the one open bill, and it is tied', sdt.move('00000000-0000-0000-0000-0000003880b1', 'customer_pay') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'moved e2');
SELECT sdt.same('the same stage again changes nothing', sdt.move('00000000-0000-0000-0000-0000003880b1', 'customer_pay') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'moved e2');
RESET ROLE;
-- A second open bill later, and a write that is not a move: the tie made on arrival stands.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000003880e3', '00000000-0000-0000-0000-0000003880a1', 2, 'billed', 900, now());
UPDATE public.people_labor_jobs SET pay_hold_reason = 'Waiting on a certificate' WHERE id = '00000000-0000-0000-0000-0000003880b1';
SELECT sdt.same('a later bill and a later write leave the tie', sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'e2');

-- 3 · The office's pick.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000003880f1', '00000000-0000-0000-0000-0000003880a2', 0, 'billed', 500, now());
SET LOCAL ROLE authenticated;
SELECT sdt.same('the office picks another bill of the job', sdt.pick('00000000-0000-0000-0000-0000003880b1', '00000000-0000-0000-0000-0000003880e3') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'saved e3');
SELECT sdt.same('a paid bill of the job may be picked', sdt.pick('00000000-0000-0000-0000-0000003880b1', '00000000-0000-0000-0000-0000003880e1') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'saved e1');
SELECT sdt.same('a bill of another job is refused', sdt.pick('00000000-0000-0000-0000-0000003880b1', '00000000-0000-0000-0000-0000003880f1'), 'That bill is not on this sheet''s job');
SELECT sdt.same('and the tie it had stands', sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'e1');
SELECT sdt.same('No bill clears the tie', sdt.pick('00000000-0000-0000-0000-0000003880b1', NULL) || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'saved -');
SELECT sdt.same('a sheet that is not waiting on the customer is refused', sdt.pick('00000000-0000-0000-0000-0000003880b2', '00000000-0000-0000-0000-0000003880e3'), 'This sheet is not waiting on the customer');
SELECT sdt.same('a sheet that does not exist is refused', sdt.pick('00000000-0000-0000-0000-0000003880bf', '00000000-0000-0000-0000-0000003880e3'), 'Sheet not found');
RESET ROLE;
SELECT sdt.as_user('00000000-0000-0000-0000-0000003880d2'); SET LOCAL ROLE authenticated;
SELECT sdt.same('a helper is refused', sdt.pick('00000000-0000-0000-0000-0000003880b1', '00000000-0000-0000-0000-0000003880e3'), 'Not authorized');
RESET ROLE;
SELECT sdt.same('and wrote nothing', sdt.tie('00000000-0000-0000-0000-0000003880b1'), '-');

-- 4 · The trigger holds every other writer to the same rules. These writes are made as postgres.
UPDATE public.people_labor_jobs SET pay_hold_reason = NULL WHERE id = '00000000-0000-0000-0000-0000003880b1';
SELECT sdt.same('a cleared tie stays cleared through a later write', sdt.tie('00000000-0000-0000-0000-0000003880b1'), '-');
UPDATE public.people_labor_jobs SET draw_invoice_id = '00000000-0000-0000-0000-0000003880f1' WHERE id = '00000000-0000-0000-0000-0000003880b1';
SELECT sdt.same('a tie written to a bill of another job is no tie', sdt.tie('00000000-0000-0000-0000-0000003880b1'), '-');
UPDATE public.people_labor_jobs SET draw_invoice_id = '00000000-0000-0000-0000-0000003880e3' WHERE id = '00000000-0000-0000-0000-0000003880b2';
SELECT sdt.same('a tie written on a Working sheet is no tie', sdt.stage('00000000-0000-0000-0000-0000003880b2') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b2'), 'working -');
UPDATE public.people_labor_jobs SET draw_invoice_id = '00000000-0000-0000-0000-0000003880e3' WHERE id = '00000000-0000-0000-0000-0000003880b1';
SELECT sdt.same('a tie written to a bill of the sheet''s own job is kept', sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'e3');
UPDATE public.people_labor_jobs SET job_ledger_id = '00000000-0000-0000-0000-0000003880a2' WHERE id = '00000000-0000-0000-0000-0000003880b1';
SELECT sdt.same('moving the sheet to another job drops the tie, and does not take that job''s bill', sdt.tie('00000000-0000-0000-0000-0000003880b1'), '-');
UPDATE public.people_labor_jobs SET job_ledger_id = '00000000-0000-0000-0000-0000003880a1', draw_invoice_id = '00000000-0000-0000-0000-0000003880e3' WHERE id = '00000000-0000-0000-0000-0000003880b1';
SELECT sdt.same('back on its job with its bill', sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'e3');
DELETE FROM public.jobs_ledger_invoices WHERE id = '00000000-0000-0000-0000-0000003880e3';
SELECT sdt.same('deleting the bill clears the tie and leaves the sheet where it was', sdt.stage('00000000-0000-0000-0000-0000003880b1') || ' ' || sdt.tie('00000000-0000-0000-0000-0000003880b1'), 'customer_pay -');

-- 5 · A sheet born at Waiting on customer with only its job's number: the link is made first, then the tie.
INSERT INTO public.jobs_ledger_invoices (id, job_id, sequence_order, status, amount, billed_at) VALUES
  ('00000000-0000-0000-0000-0000003880c1', '00000000-0000-0000-0000-0000003880a3', 0, 'billed', 700, now());
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_number, stage) VALUES
  ('00000000-0000-0000-0000-0000003880b3', '00000000-0000-0000-0000-0000003880d1', 'Tie Sub', 'DT-3883', 'customer_pay');
SELECT sdt.same('the number found the job',
  (SELECT job_ledger_id::text FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-0000003880b3'), '00000000-0000-0000-0000-0000003880a3');
SELECT sdt.same('and the job''s one open bill is tied', sdt.tie('00000000-0000-0000-0000-0000003880b3'), 'c1');
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_ledger_id, draw_invoice_id) VALUES
  ('00000000-0000-0000-0000-0000003880b4', '00000000-0000-0000-0000-0000003880d1', 'Tie Sub', '00000000-0000-0000-0000-0000003880a3', '00000000-0000-0000-0000-0000003880c1');
SELECT sdt.same('a sheet born Working with a tie rides on no bill', sdt.tie('00000000-0000-0000-0000-0000003880b4'), '-');

DO $$ BEGIN RAISE NOTICE 'sub_sheet_draw_invoice PASSED'; END $$;
ROLLBACK;
