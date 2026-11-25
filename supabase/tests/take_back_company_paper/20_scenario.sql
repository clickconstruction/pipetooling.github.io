-- Taking back a trade company's own paper (punch list #403, 20261124103000, its door since 20261124214500):
-- take_back_company_paper deletes a paper
-- that is a trade company's own and is not signed, and answers taken, signed or gone. Who may, each refusal in its
-- words (a paper that is not a trade company's, one a job requires, one a newer copy replaced, one GC mode is waiting
-- on), a signed paper and a received certificate kept, the paper gone with nothing else touched, and the same paper
-- taken back once GC mode's ask is kept. Presses run as a signed-in person through RLS; the fixtures are made as
-- postgres with nobody signed in; everything rolls back. Raises on the first failed assertion; ends with
-- "take_back_company_paper PASSED". See scripts/pgtest-take-back-company-paper.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000b3d01', 'dev@takeback.test'), ('00000000-0000-0000-0000-0000000b3d02', 'master@takeback.test'),
  ('00000000-0000-0000-0000-0000000b3d03', 'assistant@takeback.test'), ('00000000-0000-0000-0000-0000000b3d04', 'controller@takeback.test'),
  ('00000000-0000-0000-0000-0000000b3d05', 'estimator@takeback.test'), ('00000000-0000-0000-0000-0000000b3d06', 'training@takeback.test'),
  ('00000000-0000-0000-0000-0000000b3d07', 'sub@takeback.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000b3d01', 'dev@takeback.test', 'Takeback Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000b3d02', 'master@takeback.test', 'Takeback Master', 'master_technician'),
  ('00000000-0000-0000-0000-0000000b3d03', 'assistant@takeback.test', 'Takeback Assistant', 'assistant'),
  ('00000000-0000-0000-0000-0000000b3d04', 'controller@takeback.test', 'Takeback Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000b3d05', 'estimator@takeback.test', 'Takeback Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000b3d06', 'training@takeback.test', 'Takeback Training Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000b3d07', 'sub@takeback.test', 'Takeback Sub', 'subcontractor')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000b3d06';

-- The companies, one per case. The first is the walk's: entered on People, and sent a paper by the office.
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000b3101', 'ZZ Test Walk Co', '{Plumbing}'),
  ('00000000-0000-0000-0000-0000000b3102', 'Asked Mechanical', '{Mechanical}'),
  ('00000000-0000-0000-0000-0000000b3103', 'Signed Plumbing', '{Plumbing}'),
  ('00000000-0000-0000-0000-0000000b3104', 'Replaced Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-0000000b3105', 'Job Framing', '{Framing}');
-- A job, for the paper a job requires.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000b3c01', 'Takeback Test Owner', '00000000-0000-0000-0000-0000000b3d01');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000b3f01', 'Takeback Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000b3b01', '00000000-0000-0000-0000-0000000b3d01', '00000000-0000-0000-0000-0000000b3f01', 'Takeback test job', '00000000-0000-0000-0000-0000000b3c01');

-- The papers. A company's paper carries its company's stored name, and the table's trigger sets company_id from it.
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, status, doc_type, signer_name) VALUES
  -- The walk's: an agreement that is out, and a W-9 made and never sent. GC mode asked this company for nothing.
  ('00000000-0000-0000-0000-0000000b3201', 'gc-company:00000000-0000-0000-0000-0000000b3101', 'General Conditions for Subcontractors', gen_random_uuid(), 1, 'sent', 'agreement', 'Pat Sample'),
  ('00000000-0000-0000-0000-0000000b3202', 'gc-company:00000000-0000-0000-0000-0000000b3101', 'W-9', gen_random_uuid(), 1, 'unsent', 'w9', NULL),
  -- GC mode asked Asked Mechanical for its W-9 by Nov 30, and for no agreement.
  ('00000000-0000-0000-0000-0000000b3203', 'gc-company:00000000-0000-0000-0000-0000000b3102', 'W-9', gen_random_uuid(), 1, 'sent', 'w9', 'Lee Sample'),
  ('00000000-0000-0000-0000-0000000b3204', 'gc-company:00000000-0000-0000-0000-0000000b3102', 'General Conditions for Subcontractors', gen_random_uuid(), 1, 'sent', 'agreement', 'Lee Sample'),
  -- A signed agreement and a received certificate.
  ('00000000-0000-0000-0000-0000000b3205', 'gc-company:00000000-0000-0000-0000-0000000b3103', 'General Conditions for Subcontractors', gen_random_uuid(), 1, 'signed', 'agreement', 'Kim Sample'),
  ('00000000-0000-0000-0000-0000000b3206', 'gc-company:00000000-0000-0000-0000-0000000b3103', 'Certificate of insurance', gen_random_uuid(), 1, 'received', 'coi', NULL),
  -- A copy a newer one replaced, and the newer one.
  ('00000000-0000-0000-0000-0000000b3207', 'gc-company:00000000-0000-0000-0000-0000000b3104', 'General Conditions for Subcontractors', '00000000-0000-0000-0000-0000000b3e04', 1, 'sent', 'agreement', NULL),
  -- A paper a job requires.
  ('00000000-0000-0000-0000-0000000b3209', 'gc-company:00000000-0000-0000-0000-0000000b3105', 'Site rules', gen_random_uuid(), 1, 'sent', 'other', NULL),
  -- A person's own paper: never a trade company's.
  ('00000000-0000-0000-0000-0000000b320a', 'Takeback Person', 'Site secrecy agreement', gen_random_uuid(), 1, 'sent', 'agreement', NULL);
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, status, doc_type, supersedes_person_contract_document_id) VALUES
  ('00000000-0000-0000-0000-0000000b3208', 'gc-company:00000000-0000-0000-0000-0000000b3104', 'General Conditions for Subcontractors', '00000000-0000-0000-0000-0000000b3e04', 2, 'sent', 'agreement', '00000000-0000-0000-0000-0000000b3207');
UPDATE public.person_contract_documents SET job_id = '00000000-0000-0000-0000-0000000b3b01' WHERE id = '00000000-0000-0000-0000-0000000b3209';
INSERT INTO public.gc_trade_promises (id, company_id, kind, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000b3301', '00000000-0000-0000-0000-0000000b3102', 'w9', 'their W-9', DATE '2026-11-30', 'office');

CREATE SCHEMA tbk;
CREATE FUNCTION tbk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with exactly these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION tbk.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want THEN RAISE EXCEPTION E'% was refused with other words.\n--- got ---\n%\n--- want ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION tbk.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION tbk.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- The walk's paper taken back by one person, then put back as it was (a subtransaction): did the press go through?
-- Called as postgres.
CREATE FUNCTION tbk.goes(label text, p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  got text;
BEGIN
  BEGIN
    PERFORM tbk.as_user(p_user);
    SET LOCAL ROLE authenticated;
    got := public.take_back_company_paper('00000000-0000-0000-0000-0000000b3201');
    RESET ROLE;
    got := got || ' ' || (SELECT count(*)::text FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-0000000b3201');
    RAISE EXCEPTION USING ERRCODE = 'ZZ001', MESSAGE = got;
  EXCEPTION WHEN SQLSTATE 'ZZ001' THEN
    got := SQLERRM;
  END;
  IF got IS DISTINCT FROM 'taken 0' THEN RAISE EXCEPTION '% did not take the paper back: %', label, got; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
GRANT USAGE ON SCHEMA tbk TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tbk TO authenticated;

-- 0 · The fixtures stand as meant: each company's paper took its company from its name.
SELECT tbk.same('the companies’ papers', (SELECT count(*)::text FROM public.person_contract_documents WHERE company_id::text LIKE '00000000-0000-0000-0000-0000000b31%'), '9');

-- 1 · Who may take a paper back: a dev and the controller. Everyone else, the leader among them, is refused in words
-- before any write.
SELECT tbk.as_nobody();
SET LOCAL ROLE authenticated;
SELECT tbk.refused('nobody signed in', $q$SELECT public.take_back_company_paper('00000000-0000-0000-0000-0000000b3201')$q$, 'Sign in to take a paper back.');
RESET ROLE;
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('an assistant', '00000000-0000-0000-0000-0000000b3d03'::uuid, 'Only a dev or the controller takes a paper back.'),
    ('the leader', '00000000-0000-0000-0000-0000000b3d02'::uuid, 'Only a dev or the controller takes a paper back.'),
    ('an estimator', '00000000-0000-0000-0000-0000000b3d05'::uuid, 'Only a dev or the controller takes a paper back.'),
    ('a sub', '00000000-0000-0000-0000-0000000b3d07'::uuid, 'Only a dev or the controller takes a paper back.'),
    ('a training account', '00000000-0000-0000-0000-0000000b3d06'::uuid, 'A training account cannot take a paper back.')) AS t(who, id, want)
  LOOP
    PERFORM tbk.as_user(r.id);
    SET LOCAL ROLE authenticated;
    PERFORM tbk.refused(r.who, $q$SELECT public.take_back_company_paper('00000000-0000-0000-0000-0000000b3201')$q$, r.want);
    RESET ROLE;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('a dev', '00000000-0000-0000-0000-0000000b3d01'::uuid), ('the controller', '00000000-0000-0000-0000-0000000b3d04'::uuid)) AS t(who, id)
  LOOP
    PERFORM tbk.goes(r.who || ' takes a paper back', r.id);
  END LOOP;
END $$;
SELECT tbk.same('every try left the papers as they were', (SELECT count(*)::text FROM public.person_contract_documents WHERE id::text LIKE '00000000-0000-0000-0000-0000000b32%'), '10');

-- 2 · Each refusal, in its words, as the controller.
SELECT tbk.as_user('00000000-0000-0000-0000-0000000b3d04');
SET LOCAL ROLE authenticated;
SELECT tbk.refused('no paper named', $q$SELECT public.take_back_company_paper(NULL)$q$, 'Pick the paper to take back.');
SELECT tbk.refused('a person’s own paper', $q$SELECT public.take_back_company_paper('00000000-0000-0000-0000-0000000b320a')$q$,
  'That paper is not a trade company''s own, so it is not taken back here.');
SELECT tbk.refused('a paper a job requires', $q$SELECT public.take_back_company_paper('00000000-0000-0000-0000-0000000b3209')$q$,
  'Site rules stays with Job Framing, since a job requires it. It comes off on the job.');
SELECT tbk.refused('a copy a newer one replaced', $q$SELECT public.take_back_company_paper('00000000-0000-0000-0000-0000000b3207')$q$,
  'General Conditions for Subcontractors stays with Replaced Electric, since a newer copy replaced it. The newer copy is the live paper.');
SELECT tbk.refused('a paper GC mode is waiting on', $q$SELECT public.take_back_company_paper('00000000-0000-0000-0000-0000000b3203')$q$,
  'W-9 stays with Asked Mechanical, since GC mode asked for it by Nov 30. It is GC mode''s paper to chase.');

-- 3 · A signed paper and a received certificate are kept, and the answer says so. A paper that is not there is gone.
SELECT tbk.same('a signed agreement', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3205'), 'signed');
SELECT tbk.same('a received certificate', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3206'), 'signed');
SELECT tbk.same('a paper that is not there', public.take_back_company_paper('00000000-0000-0000-0000-0000000b32ff'), 'gone');
RESET ROLE;
SELECT tbk.same('nothing taken back by a refusal or a kept paper', (SELECT count(*)::text FROM public.person_contract_documents WHERE id::text LIKE '00000000-0000-0000-0000-0000000b32%'), '10');

-- 4 · The controller takes the walk's papers back: the one that is out and the one never sent. A second press reads gone.
SELECT tbk.as_user('00000000-0000-0000-0000-0000000b3d04');
SET LOCAL ROLE authenticated;
SELECT tbk.same('the paper that is out', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3201'), 'taken');
SELECT tbk.same('the paper never sent', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3202'), 'taken');
SELECT tbk.same('a second press', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3201'), 'gone');
-- The newer copy of a replaced paper is the live one, and it is taken back like any other.
SELECT tbk.same('the newer copy', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3208'), 'taken');
-- GC mode's ask is by kind: Asked Mechanical's agreement has no ask behind it, so it goes while the W-9 stays.
SELECT tbk.same('an agreement GC mode never asked for', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3204'), 'taken');
RESET ROLE;
SELECT tbk.same('what is left', (
  SELECT string_agg(right(d.id::text, 4), ' ' ORDER BY d.id) FROM public.person_contract_documents d WHERE d.id::text LIKE '00000000-0000-0000-0000-0000000b32%'),
  '3203 3205 3206 3207 3209 320a');
SELECT tbk.same('the companies and GC mode’s ask are untouched', (
  SELECT (SELECT count(*) FROM public.gc_companies WHERE id::text LIKE '00000000-0000-0000-0000-0000000b31%') || ' '
      || (SELECT count(*) FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-0000000b3301' AND kept_on IS NULL)), '5 1');

-- 5 · Once GC mode's ask is kept, the W-9 is a waiting paper like any other.
UPDATE public.gc_trade_promises SET kept_on = DATE '2026-11-24' WHERE id = '00000000-0000-0000-0000-0000000b3301';
SELECT tbk.as_user('00000000-0000-0000-0000-0000000b3d01');
SET LOCAL ROLE authenticated;
SELECT tbk.same('the W-9 after the ask is kept', public.take_back_company_paper('00000000-0000-0000-0000-0000000b3203'), 'taken');
RESET ROLE;

-- 6 · The door: nobody without a sign-in can call it.
SELECT tbk.same('anon may not execute it', has_function_privilege('anon', 'public.take_back_company_paper(uuid)', 'EXECUTE')::text, 'false');
SELECT tbk.same('a signed-in person may', has_function_privilege('authenticated', 'public.take_back_company_paper(uuid)', 'EXECUTE')::text, 'true');

DO $$ BEGIN RAISE NOTICE 'take_back_company_paper PASSED'; END $$;
ROLLBACK;
