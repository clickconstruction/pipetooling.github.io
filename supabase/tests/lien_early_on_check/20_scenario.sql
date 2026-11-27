-- Before a check clears, only a leader, a controller or a dev lets a lien's release go (20261127164654, punch list
-- #437 call 4): job_lien_filings_early_on_check_guard. Here, for each of the nine roles through RLS: an early release
-- (a release_of_record row carrying releasedBeforeClearedReason) and The bank confirmed the funds (fields.fundsConfirmed
-- set, changed, taken off) land for a dev, a leader and a controller and are refused in the guard's words for the
-- other six; every other write the office makes still passes, for an assistant too and on a lien that carries a
-- confirmation; a field role's plain insert is still refused by the row policy; a write with no sign-in passes the
-- guard. Made-up people, a made-up job. Fixtures made as postgres; the presses run as signed-in users, inside one
-- transaction that rolls back. Raises on the first failed assertion; ends with "lien_early_on_check PASSED".
-- See scripts/pgtest-lien-early-on-check.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA leo;
CREATE FUNCTION leo.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- How a statement was answered: 'allowed N' with the rows it wrote, or its SQLSTATE and its words. An update that
-- the row policy hides every row from is 'allowed 0': it reaches no row, so no trigger runs and nothing changes.
CREATE FUNCTION leo.answer(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  n integer;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RETURN SQLSTATE || ' ' || SQLERRM;
  END;
  RETURN 'allowed ' || n;
END $$;
CREATE FUNCTION leo.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS: a row's fundsConfirmed note, or '-'.
CREATE FUNCTION leo.funds(p uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT f.fields -> 'fundsConfirmed' ->> 'note' FROM public.job_lien_filings f WHERE f.id = p), '-') $$;
CREATE FUNCTION leo.early_releases(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.job_lien_filings f WHERE f.job_id = p_job AND f.kind = 'release_of_record' AND f.fields ? 'releasedBeforeClearedReason' $$;
GRANT USAGE ON SCHEMA leo TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA leo TO authenticated, anon, service_role;

-- Who: one person a role, all nine.

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000004370d1', 'dev@early.test'),
  ('00000000-0000-0000-0000-0000004370d2', 'master_technician@early.test'),
  ('00000000-0000-0000-0000-0000004370d3', 'controller@early.test'),
  ('00000000-0000-0000-0000-0000004370d4', 'assistant@early.test'),
  ('00000000-0000-0000-0000-0000004370d5', 'estimator@early.test'),
  ('00000000-0000-0000-0000-0000004370d6', 'primary@early.test'),
  ('00000000-0000-0000-0000-0000004370d7', 'superintendent@early.test'),
  ('00000000-0000-0000-0000-0000004370d8', 'subcontractor@early.test'),
  ('00000000-0000-0000-0000-0000004370d9', 'helpers@early.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000004370d1', 'dev@early.test', 'Early dev', 'dev'),
  ('00000000-0000-0000-0000-0000004370d2', 'master_technician@early.test', 'Early master_technician', 'master_technician'),
  ('00000000-0000-0000-0000-0000004370d3', 'controller@early.test', 'Early controller', 'controller'),
  ('00000000-0000-0000-0000-0000004370d4', 'assistant@early.test', 'Early assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000004370d5', 'estimator@early.test', 'Early estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000004370d6', 'primary@early.test', 'Early primary', 'primary'),
  ('00000000-0000-0000-0000-0000004370d7', 'superintendent@early.test', 'Early superintendent', 'superintendent'),
  ('00000000-0000-0000-0000-0000004370d8', 'subcontractor@early.test', 'Early subcontractor', 'subcontractor'),
  ('00000000-0000-0000-0000-0000004370d9', 'helpers@early.test', 'Early helpers', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- A job whose leader is the bed's leader, and one that is another leader's, each with a filed lien. The second lien
-- carries a confirmation already, made by the leader.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-000000437b09', 'Early Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-000000437b01', '00000000-0000-0000-0000-0000004370d2', '00000000-0000-0000-0000-000000437b09', '4371', 'ZZ Test Early One', 'ZZ Test Builder', 'gc', 5000, 5000, 'billed'),
  ('00000000-0000-0000-0000-000000437b02', '00000000-0000-0000-0000-0000004370d2', '00000000-0000-0000-0000-000000437b09', '4372', 'ZZ Test Early Two', 'ZZ Test Builder', 'gc', 7000, 7000, 'billed');
INSERT INTO public.job_lien_filings (id, job_id, kind, amount, fields, filed_at, county, recording_number, created_by) VALUES
  ('00000000-0000-0000-0000-000000437c01', '00000000-0000-0000-0000-000000437b01', 'affidavit', 5000, '{"claimant":"ZZ Test Co"}'::jsonb, '2026-10-01', 'Bexar', '2026-0001', '00000000-0000-0000-0000-0000004370d2'),
  ('00000000-0000-0000-0000-000000437c02', '00000000-0000-0000-0000-000000437b02', 'affidavit', 7000, '{"claimant":"ZZ Test Co","fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d2","name":"Early master_technician","at":"2026-11-20T15:00:00.000Z","note":"the bank said good funds"}}'::jsonb, '2026-10-01', 'Bexar', '2026-0002', '00000000-0000-0000-0000-0000004370d2');

SELECT leo.same('the guard stands once on the table, before insert and update, as a definer with no caller''s right to call it',
  (SELECT count(*)::text || ' ' || bool_and(t.tgenabled = 'O')::text || ' ' || bool_and(p.prosecdef)::text || ' ' || bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text
     FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.job_lien_filings'::regclass AND t.tgname = 'job_lien_filings_early_on_check_guard' AND NOT t.tgisinternal),
  '1 true true false');

SET LOCAL ROLE authenticated;

-- ── dev ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d1');
SELECT leo.same('dev: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d1')$q$), 'allowed 1');
SELECT leo.same('dev: the bank confirmed the funds, set on a lien', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d1","name":"Early dev","at":"2026-11-27T16:00:00.000Z","note":"set by dev"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1');
SELECT leo.same('dev: a confirmation changed', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by dev"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 1');
RESET ROLE;
SELECT leo.same('dev: both confirmations read as dev left them', leo.funds('00000000-0000-0000-0000-000000437c01') || ' | ' || leo.funds('00000000-0000-0000-0000-000000437c02'), 'set by dev | reworded by dev');
SET LOCAL ROLE authenticated;
SELECT leo.same('dev: a confirmation taken off', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1');

-- ── master_technician ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d2');
SELECT leo.same('master_technician: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d2')$q$), 'allowed 1');
SELECT leo.same('master_technician: the bank confirmed the funds, set on a lien', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d2","name":"Early master_technician","at":"2026-11-27T16:00:00.000Z","note":"set by master_technician"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1');
SELECT leo.same('master_technician: a confirmation changed', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by master_technician"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 1');
RESET ROLE;
SELECT leo.same('master_technician: both confirmations read as master_technician left them', leo.funds('00000000-0000-0000-0000-000000437c01') || ' | ' || leo.funds('00000000-0000-0000-0000-000000437c02'), 'set by master_technician | reworded by master_technician');
SET LOCAL ROLE authenticated;
SELECT leo.same('master_technician: a confirmation taken off', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1');

-- ── controller ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d3');
SELECT leo.same('controller: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d3')$q$), 'allowed 1');
SELECT leo.same('controller: the bank confirmed the funds, set on a lien', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d3","name":"Early controller","at":"2026-11-27T16:00:00.000Z","note":"set by controller"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1');
SELECT leo.same('controller: a confirmation changed', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by controller"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 1');
RESET ROLE;
SELECT leo.same('controller: both confirmations read as controller left them', leo.funds('00000000-0000-0000-0000-000000437c01') || ' | ' || leo.funds('00000000-0000-0000-0000-000000437c02'), 'set by controller | reworded by controller');
SET LOCAL ROLE authenticated;
SELECT leo.same('controller: a confirmation taken off', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1');

-- ── assistant ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d4');
SELECT leo.same('assistant: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d4')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('assistant: the bank confirmed the funds, set on a lien', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d4","name":"Early assistant","at":"2026-11-27T16:00:00.000Z","note":"set by assistant"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), '42501 Only a leader, a controller or a dev can say the bank confirmed the funds, or take that back.');
SELECT leo.same('assistant: a confirmation changed', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by assistant"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), '42501 Only a leader, a controller or a dev can say the bank confirmed the funds, or take that back.');
SELECT leo.same('assistant: a confirmation taken off', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), '42501 Only a leader, a controller or a dev can say the bank confirmed the funds, or take that back.');

-- ── estimator ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d5');
SELECT leo.same('estimator: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d5')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('estimator: the bank confirmed the funds, set on a lien, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d5","name":"Early estimator","at":"2026-11-27T16:00:00.000Z","note":"set by estimator"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 0');
SELECT leo.same('estimator: a confirmation changed, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by estimator"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');
SELECT leo.same('estimator: a confirmation taken off, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');

-- ── primary ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d6');
SELECT leo.same('primary: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d6')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('primary: the bank confirmed the funds, set on a lien, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d6","name":"Early primary","at":"2026-11-27T16:00:00.000Z","note":"set by primary"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 0');
SELECT leo.same('primary: a confirmation changed, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by primary"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');
SELECT leo.same('primary: a confirmation taken off, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');

-- ── superintendent ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d7');
SELECT leo.same('superintendent: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d7')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('superintendent: the bank confirmed the funds, set on a lien, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d7","name":"Early superintendent","at":"2026-11-27T16:00:00.000Z","note":"set by superintendent"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 0');
SELECT leo.same('superintendent: a confirmation changed, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by superintendent"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');
SELECT leo.same('superintendent: a confirmation taken off, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');

-- ── subcontractor ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d8');
SELECT leo.same('subcontractor: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d8')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('subcontractor: the bank confirmed the funds, set on a lien, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d8","name":"Early subcontractor","at":"2026-11-27T16:00:00.000Z","note":"set by subcontractor"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 0');
SELECT leo.same('subcontractor: a confirmation changed, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by subcontractor"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');
SELECT leo.same('subcontractor: a confirmation taken off, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');

-- ── helpers ─────────────────────────────────────────────────────────────────────────────────────────
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d9');
SELECT leo.same('helpers: a release before the check clears', leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedBeforeClearedReason":"the builder wired it too"}'::jsonb, '00000000-0000-0000-0000-0000004370d9')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('helpers: the bank confirmed the funds, set on a lien, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"00000000-0000-0000-0000-0000004370d9","name":"Early helpers","at":"2026-11-27T16:00:00.000Z","note":"set by helpers"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 0');
SELECT leo.same('helpers: a confirmation changed, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{fundsConfirmed,note}', '"reworded by helpers"') WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');
SELECT leo.same('helpers: a confirmation taken off, reaches no row', leo.answer($q$UPDATE public.job_lien_filings SET fields = fields - 'fundsConfirmed' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 0');

RESET ROLE;
SELECT leo.same('three early releases landed, one for each of the three', leo.early_releases('00000000-0000-0000-0000-000000437b01'), '3');
SELECT leo.same('the second lien''s confirmation is the last allowed one''s, untouched by the six', leo.funds('00000000-0000-0000-0000-000000437c02'), 'reworded by controller');
SELECT leo.same('and the first lien carries none, taken off last by a controller', leo.funds('00000000-0000-0000-0000-000000437c01'), '-');

-- ── everything else is as it was: the assistant, who is office and not one of the three ──────────
SET LOCAL ROLE authenticated;
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d4');
SELECT leo.same('an assistant records an ordinary release',
  leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01"}'::jsonb, '00000000-0000-0000-0000-0000004370d4')$q$), 'allowed 1');
SELECT leo.same('an assistant records a release that went out with money still open',
  leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01","releasedUnpaidReason":"the owner asked for it"}'::jsonb, '00000000-0000-0000-0000-0000004370d4')$q$), 'allowed 1');
SELECT leo.same('an assistant records a release that rests on a leader''s confirmation',
  leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b02', 'release_of_record', 7000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c02","releasedOnConfirmedFunds":{"by":"00000000-0000-0000-0000-0000004370d2","name":"Early master_technician","at":"2026-11-20T15:00:00.000Z","note":"the bank said good funds"}}'::jsonb, '00000000-0000-0000-0000-0000004370d4')$q$), 'allowed 1');
SELECT leo.same('an assistant records a notice and a lien',
  leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'notice_53_056', 5000, '{}'::jsonb, '00000000-0000-0000-0000-0000004370d4'), ('00000000-0000-0000-0000-000000437b01', 'affidavit', 5000, '{"claimant":"ZZ Test Co"}'::jsonb, '00000000-0000-0000-0000-0000004370d4')$q$), 'allowed 2');
SELECT leo.same('an assistant keeps the day a release was asked for, on a lien that carries a confirmation',
  leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"releaseAskedYmd":"2026-11-25"}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c02'$q$), 'allowed 1');
SELECT leo.same('an assistant stamps a lien served and voids one',
  leo.answer($q$UPDATE public.job_lien_filings SET served_at = '2026-10-04' WHERE id = '00000000-0000-0000-0000-000000437c02'$q$) || ' ' ||
  leo.answer($q$UPDATE public.job_lien_filings SET voided_at = now() WHERE job_id = '00000000-0000-0000-0000-000000437b01' AND kind = 'notice_53_056'$q$), 'allowed 1 allowed 1');
SELECT leo.same('an assistant may reword an early release''s other fields, and not its reason',
  leo.answer($q$UPDATE public.job_lien_filings SET recording_number = '2026-0099' WHERE job_id = '00000000-0000-0000-0000-000000437b01' AND kind = 'release_of_record' AND fields ? 'releasedBeforeClearedReason'$q$) || ' | ' ||
  leo.answer($q$UPDATE public.job_lien_filings SET fields = jsonb_set(fields, '{releasedBeforeClearedReason}', '"another reason"') WHERE job_id = '00000000-0000-0000-0000-000000437b01' AND kind = 'release_of_record' AND fields ? 'releasedBeforeClearedReason'$q$),
  'allowed 3 | 42501 Only a leader, a controller or a dev can release a lien before its check clears.');
SELECT leo.same('an assistant may not add the reason to an ordinary release after the fact',
  leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"releasedBeforeClearedReason":"added later"}'::jsonb WHERE job_id = '00000000-0000-0000-0000-000000437b01' AND kind = 'release_of_record' AND NOT (fields ? 'releasedBeforeClearedReason')$q$), '42501 Only a leader, a controller or a dev can release a lien before its check clears.');
RESET ROLE;
SELECT leo.same('the confirmation outlived the assistant''s other writes, with the asked day beside it',
  leo.funds('00000000-0000-0000-0000-000000437c02') || ' / ' || (SELECT fields ->> 'releaseAskedYmd' FROM public.job_lien_filings WHERE id = '00000000-0000-0000-0000-000000437c02'), 'reworded by controller / 2026-11-25');

-- ── a field role's plain insert is still the row policy's to refuse ──────────────────────────────
SET LOCAL ROLE authenticated;
SELECT leo.as_user('00000000-0000-0000-0000-0000004370d9');
SELECT leo.same('a helper''s ordinary release is refused by the row policy, as before',
  (leo.answer($q$INSERT INTO public.job_lien_filings (job_id, kind, amount, fields, created_by) VALUES ('00000000-0000-0000-0000-000000437b01', 'release_of_record', 5000, '{"releasesFilingId":"00000000-0000-0000-0000-000000437c01"}'::jsonb, '00000000-0000-0000-0000-0000004370d9')$q$) LIKE '42501 new row violates row-level security policy%')::text, 'true');
SELECT leo.same('and a helper reads no filing', (SELECT count(*)::text FROM public.job_lien_filings), '0');
RESET ROLE;

-- ── no sign-in behind the write: the service role's stamps pass the guard ────────────────────────
SELECT set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;
SELECT leo.same('the service role''s write of a lien''s sends passes, and so does a confirmation it carries',
  leo.answer($q$UPDATE public.job_lien_filings SET sends = '[{"recipient":"owner","method":"certified","tracking":"ZZ1","sent_on":"2026-10-03"}]'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$) || ' ' ||
  leo.answer($q$UPDATE public.job_lien_filings SET fields = fields || '{"fundsConfirmed":{"by":"","name":"","at":"2026-11-27T16:30:00.000Z","note":"by the service role"}}'::jsonb WHERE id = '00000000-0000-0000-0000-000000437c01'$q$), 'allowed 1 allowed 1');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'lien_early_on_check PASSED'; END $$;
ROLLBACK;
