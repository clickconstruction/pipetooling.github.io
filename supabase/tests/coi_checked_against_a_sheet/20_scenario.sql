-- A trade's certificate held against a job's insurance sheet (punch list #404, step 6, migration
-- *_coi_checked_against_a_sheet). A company's certificate gains the job it was checked for, the sheet's lines it was
-- checked against, and the lines sent back as missing. A dev alone marks one good or sends one back, only on a
-- published sheet, only for a company on a trade of that job, and never across two jobs. Every name here is made up.
-- Everything rolls back. Raises on the first failed assertion; ends with "coi_checked_against_a_sheet PASSED". See
-- scripts/pgtest-coi-checked-against-a-sheet.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000004046a1', 'dana@coi.test'),
  ('00000000-0000-0000-0000-0000004046a2', 'marcus@coi.test'),
  ('00000000-0000-0000-0000-0000004046b1', 'tara@coi.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000004046a1', 'dana@coi.test', 'Dana Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004046a2', 'marcus@coi.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004046b1', 'tara@coi.test', 'Tara Training', 'dev', true, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA cob;
CREATE FUNCTION cob.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION cob.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Runs a statement that may be refused or may land on no row: either way the caller reads the row after it.
CREATE FUNCTION cob.attempt(stmt text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
  RETURN 'ran';
END $$;
CREATE FUNCTION cob.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Past row-level security: one answer of one query, as text.
CREATE FUNCTION cob.past(q text) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE out text;
BEGIN
  EXECUTE q INTO out;
  RETURN coalesce(out, 'null');
END $$;
GRANT USAGE ON SCHEMA cob TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cob TO authenticated, anon;

-- Two made-up jobs the company runs as the GC, a trade on each, a company asked on both, and a company asked on neither.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000004046c1', 'Pecan Ridge Holdings', '00000000-0000-0000-0000-0000004046a2');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000004046d1', 'Cedar Park Medical Office', '00000000-0000-0000-0000-0000004046c1'),
  ('00000000-0000-0000-0000-0000004046d2', 'Mesa Verde Retail Shell', '00000000-0000-0000-0000-0000004046c1');
INSERT INTO public.gc_projects (project_id, stage, lost_on) VALUES
  ('00000000-0000-0000-0000-0000004046d1', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000004046d2', 'bidding', NULL);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-0000004046b1', '00000000-0000-0000-0000-0000004046d1', 'Concrete', 0, 84000, false),
  ('00000000-0000-0000-0000-0000004046b2', '00000000-0000-0000-0000-0000004046d2', 'Concrete', 0, 20000, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000004046e1', 'Capped Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000004046e2', 'Far Field Framing', ARRAY['Framing']);
INSERT INTO public.gc_invites (id, package_id, company_id, status, plugs, exclusion_covers, taken_alternates) VALUES
  ('00000000-0000-0000-0000-000000404621', '00000000-0000-0000-0000-0000004046b1', '00000000-0000-0000-0000-0000004046e1', 'bid', '{}', '{}', '{}'),
  ('00000000-0000-0000-0000-000000404622', '00000000-0000-0000-0000-0000004046b2', '00000000-0000-0000-0000-0000004046e1', 'bid', '{}', '{}', '{}');

-- The papers: a certificate each company sent, and a company's agreement, which is no certificate.
INSERT INTO public.person_contract_documents (id, person_name, company_id, document_name, doc_type, expires_at, url, status, sent_at, contract_lineage_id, lineage_version) VALUES
  ('00000000-0000-0000-0000-0000004046f1', 'gc-company:00000000-0000-0000-0000-0000004046e1', '00000000-0000-0000-0000-0000004046e1', 'COI (from their portal)', 'coi', DATE '2099-03-03', 'https://example.test/capped.pdf', 'received', now(), gen_random_uuid(), 1),
  ('00000000-0000-0000-0000-0000004046f2', 'gc-company:00000000-0000-0000-0000-0000004046e2', '00000000-0000-0000-0000-0000004046e2', 'COI (from their portal)', 'coi', DATE '2099-03-03', 'https://example.test/far.pdf', 'received', now(), gen_random_uuid(), 1);
INSERT INTO public.person_contract_documents (id, person_name, company_id, document_name, doc_type, status, contract_lineage_id, lineage_version) VALUES
  ('00000000-0000-0000-0000-0000004046f3', 'gc-company:00000000-0000-0000-0000-0000004046e1', '00000000-0000-0000-0000-0000004046e1', 'Master agreement', 'agreement', 'unsent', gen_random_uuid(), 1);

-- 0 · The columns are there and empty, and only a company's certificate is held against a sheet.
SELECT cob.same('the seven columns', (SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'person_contract_documents' AND column_name LIKE 'sheet\_%'),
  'sheet_asks, sheet_checked_at, sheet_checked_by, sheet_missing, sheet_project_id, sheet_revision, sheet_sent_back_at');
SELECT cob.same('a certificate starts with no job', (SELECT coalesce(sheet_project_id::text, 'null') || ' ' || coalesce(sheet_asks::text, 'null') FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'), 'null null');
SELECT cob.refused('a job on a paper that is no certificate', $q$UPDATE public.person_contract_documents SET sheet_project_id = '00000000-0000-0000-0000-0000004046d1' WHERE id = '00000000-0000-0000-0000-0000004046f3'$q$, 'person_contract_documents_sheet_is_a_company_coi');
SELECT cob.same('anon may not run either function', (SELECT count(*)::text FROM information_schema.role_routine_grants WHERE routine_schema = 'public' AND routine_name IN ('document_builder_coi_mark_good', 'document_builder_coi_send_back') AND grantee = 'anon'), '0');

-- 1 · Dana loads the insurance builder, publishes the usual, and starts a sheet for each job. Only the first is published.
SELECT cob.as_user('00000000-0000-0000-0000-0000004046a1'); SET LOCAL ROLE authenticated;
INSERT INTO public.document_builders (key, kind, draft) VALUES ('insurance', 'filled', '{"fields": {"co": "Acme Plumbing"}}');
UPDATE public.document_builders SET published = draft, revision = 1 WHERE key = 'insurance' AND revision = 0;
INSERT INTO public.document_builder_sheets (id, builder_key, project_id, draft) VALUES
  ('00000000-0000-0000-0000-000000404601', 'insurance', '00000000-0000-0000-0000-0000004046d1', '{}'),
  ('00000000-0000-0000-0000-000000404602', 'insurance', '00000000-0000-0000-0000-0000004046d2', '{}');
UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing", "place": "410 Sample Street"}', revision = 1, usual_revision = 1, published_by = '00000000-0000-0000-0000-0000004046a1'
  WHERE id = '00000000-0000-0000-0000-000000404601';
RESET ROLE;
SELECT cob.same('one sheet is published and one is a draft', cob.past($q$SELECT string_agg(revision::text, ' ' ORDER BY id) FROM document_builder_sheets$q$), '1 0');

-- 2 · Who may, and on what.
SELECT cob.as_user('00000000-0000-0000-0000-0000004046a2'); SET LOCAL ROLE authenticated;
SELECT cob.refused('a master marks one good', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['It is for work at 410 Sample Street.'], DATE '2099-03-03')$q$, 'Only a dev checks a certificate');
SELECT cob.refused('a master sends one back', $q$SELECT public.document_builder_coi_send_back('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['It is for work at 410 Sample Street.'])$q$, 'Only a dev checks a certificate');
RESET ROLE;

SELECT cob.as_user('00000000-0000-0000-0000-0000004046a1'); SET LOCAL ROLE authenticated;
SELECT cob.refused('against a sheet not published', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404602', ARRAY['A line.'], DATE '2099-03-03')$q$, 'Publish this job''s sheet first.');
SELECT cob.refused('against a sheet that is not there', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-0000004046ff', ARRAY['A line.'], DATE '2099-03-03')$q$, 'Publish this job''s sheet first.');
SELECT cob.refused('a paper that is no certificate', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f3', '00000000-0000-0000-0000-000000404601', ARRAY['A line.'], DATE '2099-03-03')$q$, 'That is not a certificate a company sent.');
SELECT cob.refused('a company on no trade of the job', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f2', '00000000-0000-0000-0000-000000404601', ARRAY['A line.'], DATE '2099-03-03')$q$, 'That company is not on a trade of this job.');
SELECT cob.refused('no line ticked', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY[]::text[], DATE '2099-03-03')$q$, 'Tick every line the sheet asks');
SELECT cob.refused('no day', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['A line.'], NULL)$q$, 'Say the day the certificate is good until.');
SELECT cob.refused('a day that has passed', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['A line.'], DATE '2020-01-01')$q$, 'That certificate has run out.');
SELECT cob.refused('sent back naming nothing', $q$SELECT public.document_builder_coi_send_back('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY[]::text[])$q$, 'Say what the certificate is missing');
RESET ROLE;
SELECT cob.same('nothing landed from any refusal', cob.past($q$SELECT status || ' ' || coalesce(sheet_project_id::text, 'null') FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$), 'received null');

-- 3 · Dana sends it back, naming two lines. The paper stays as it was, and keeps the lines and the day.
SELECT cob.as_user('00000000-0000-0000-0000-0000004046a1'); SET LOCAL ROLE authenticated;
SELECT public.document_builder_coi_send_back('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['It names Pecan Ridge Holdings as additional insured.', 'Umbrella: a made-up amount.']);
RESET ROLE;
SELECT cob.same('sent back for the job, still waiting', cob.past($q$SELECT status || ' ' || sheet_project_id::text || ' ' || sheet_revision::text || ' ' || cardinality(sheet_missing)::text || ' ' || (sheet_sent_back_at IS NOT NULL)::text || ' ' || coalesce(sheet_asks::text, 'null') || ' ' || sheet_checked_by::text FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$),
  'received 00000000-0000-0000-0000-0000004046d1 1 2 true null 00000000-0000-0000-0000-0000004046a1');

-- 4 · She marks it good. It is filed, good until its day, with the job, the revision and the lines it was checked against.
SELECT cob.as_user('00000000-0000-0000-0000-0000004046a1'); SET LOCAL ROLE authenticated;
SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['It is for work at 410 Sample Street.', 'Umbrella: a made-up amount.'], DATE '2099-06-30');
RESET ROLE;
SELECT cob.same('good for the job', cob.past($q$SELECT status || ' ' || expires_at::text || ' ' || sheet_project_id::text || ' ' || sheet_revision::text || ' ' || array_to_string(sheet_asks, ' | ') || ' ' || (sheet_checked_at IS NOT NULL)::text || ' ' || (signed_at IS NOT NULL)::text FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$),
  'signed 2099-06-30 00000000-0000-0000-0000-0000004046d1 1 It is for work at 410 Sample Street. | Umbrella: a made-up amount. true true');
SELECT cob.same('marking it good clears what was sent back', cob.past($q$SELECT coalesce(sheet_sent_back_at::text, 'null') || ' ' || coalesce(sheet_missing::text, 'null') FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$), 'null null');

-- 5 · A certificate checked for one job is never moved to another. The second job's sheet is published first.
SELECT cob.as_user('00000000-0000-0000-0000-0000004046a1'); SET LOCAL ROLE authenticated;
UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing", "place": "88 Mesa Road"}', revision = 1, usual_revision = 1, published_by = '00000000-0000-0000-0000-0000004046a1'
  WHERE id = '00000000-0000-0000-0000-000000404602';
SELECT cob.refused('marked good for a second job', $q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404602', ARRAY['It is for work at 88 Mesa Road.'], DATE '2099-06-30')$q$, 'That certificate was checked for another job.');
SELECT cob.refused('sent back for a second job', $q$SELECT public.document_builder_coi_send_back('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404602', ARRAY['It is for work at 88 Mesa Road.'])$q$, 'That certificate was checked for another job.');
-- A good certificate can be sent back for its own job, after the sheet changed. It stays filed for the company.
SELECT public.document_builder_coi_send_back('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['Umbrella: a larger made-up amount.']);
RESET ROLE;
SELECT cob.same('sent back again, still filed', cob.past($q$SELECT status || ' ' || cardinality(sheet_missing)::text || ' ' || (sheet_sent_back_at IS NOT NULL)::text || ' ' || cardinality(sheet_asks)::text FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$), 'signed 1 true 2');

-- 6 · A dev in training changes nothing.
SELECT cob.as_user('00000000-0000-0000-0000-0000004046b1'); SET LOCAL ROLE authenticated;
SELECT cob.attempt($q$SELECT public.document_builder_coi_mark_good('00000000-0000-0000-0000-0000004046f1', '00000000-0000-0000-0000-000000404601', ARRAY['A line from training.'], DATE '2099-12-31')$q$);
RESET ROLE;
SELECT cob.same('the paper is as Dana left it', cob.past($q$SELECT expires_at::text || ' ' || cardinality(sheet_asks)::text || ' ' || sheet_checked_by::text || ' ' || (sheet_sent_back_at IS NOT NULL)::text FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$),
  '2099-06-30 2 00000000-0000-0000-0000-0000004046a1 true');

-- 7 · A job that goes leaves the company's certificate, with no job on it.
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-0000004046d1';
SELECT cob.same('the certificate outlives the job', cob.past($q$SELECT status || ' ' || coalesce(sheet_project_id::text, 'null') FROM person_contract_documents WHERE id = '00000000-0000-0000-0000-0000004046f1'$q$), 'signed null');

DO $$ BEGIN RAISE NOTICE 'coi_checked_against_a_sheet PASSED'; END $$;
ROLLBACK;
