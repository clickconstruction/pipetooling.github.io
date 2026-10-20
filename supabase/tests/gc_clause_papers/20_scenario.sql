-- A statement of work and our contract built from clauses (Messages, cut 4c's next piece, migration *_gc_clause_papers):
-- a dev picks a statement of work's paper and the money team our contract's, each refused in words for anyone else, a
-- twin, a form, a paper not in the library or a copy already signed; the trade signs its statement of work in its portal
-- only at the revision its page showed, keeping the job's clauses and its own trade's exhibit; one with no paper signs as
-- before; the customer signs our contract the same way; Mark it signed freezes the newest send as the office attests;
-- and nothing rewrites a signed copy after a retire. The fixture is made as postgres; presses run as each user or as the
-- service role; everything rolls back. Raises on the first failed assertion; ends with "gc_clause_papers PASSED". See
-- scripts/pgtest-gc-clause-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Robert the dev, Rosa the office, Maria the controller (the money team), and a twin with a dev's role.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000c201', 'robert@papers.test'),
  ('00000000-0000-0000-0000-00000000c202', 'rosa@papers.test'),
  ('00000000-0000-0000-0000-00000000c203', 'maria@papers.test'),
  ('00000000-0000-0000-0000-00000000c204', 'twin@papers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000c201', 'robert@papers.test', 'Robert', 'dev', false, false),
  ('00000000-0000-0000-0000-00000000c202', 'rosa@papers.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000000c203', 'maria@papers.test', 'Maria', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000c204', 'twin@papers.test', 'Twin', 'dev', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Dr. Raman's clinic, being built, with Iron Horse on Electrical and Drywall and a Paint statement of work it signed;
-- her second clinic, bought out; a third, bought out, for a freeze that must wait.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-00000000c2c1', 'Raman Dental Group', '00000000-0000-0000-0000-00000000c201');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000c2a1', 'Clause Clinic', '00000000-0000-0000-0000-00000000c2c1'),
  ('00000000-0000-0000-0000-00000000c2a2', 'Clause Paper Clinic', '00000000-0000-0000-0000-00000000c2c1'),
  ('00000000-0000-0000-0000-00000000c2a3', 'Clause Waiting Clinic', '00000000-0000-0000-0000-00000000c2c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-00000000c2a1', 'building'),
  ('00000000-0000-0000-0000-00000000c2a2', 'buyout'),
  ('00000000-0000-0000-0000-00000000c2a3', 'buyout');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-00000000c2b1', '00000000-0000-0000-0000-00000000c2a1', 'Electrical', 0),
  ('00000000-0000-0000-0000-00000000c2b2', '00000000-0000-0000-0000-00000000c2a1', 'Drywall', 1),
  ('00000000-0000-0000-0000-00000000c2b5', '00000000-0000-0000-0000-00000000c2a1', 'Paint', 2),
  ('00000000-0000-0000-0000-00000000c2b3', '00000000-0000-0000-0000-00000000c2a2', 'Roofing', 0),
  ('00000000-0000-0000-0000-00000000c2b4', '00000000-0000-0000-0000-00000000c2a3', 'Paving', 0);
INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-00000000c211', 'Iron Horse Electric', '{Electrical,Drywall,Paint}');
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES
  ('00000000-0000-0000-0000-00000000c221', '00000000-0000-0000-0000-00000000c2b1', '00000000-0000-0000-0000-00000000c211', 'bid'),
  ('00000000-0000-0000-0000-00000000c222', '00000000-0000-0000-0000-00000000c2b2', '00000000-0000-0000-0000-00000000c211', 'bid'),
  ('00000000-0000-0000-0000-00000000c225', '00000000-0000-0000-0000-00000000c2b5', '00000000-0000-0000-0000-00000000c211', 'bid');
UPDATE public.gc_trade_packages k SET awarded_invite_id = i.id, awarded_on = DATE '2026-10-01'
FROM public.gc_invites i WHERE i.package_id = k.id AND k.project_id = '00000000-0000-0000-0000-00000000c2a1';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-00000000c231', '00000000-0000-0000-0000-00000000c2b1', '00000000-0000-0000-0000-00000000c221', '00000000-0000-0000-0000-00000000c211', 'sent', 48000, DATE '2026-10-02', NULL),
  ('00000000-0000-0000-0000-00000000c232', '00000000-0000-0000-0000-00000000c2b2', '00000000-0000-0000-0000-00000000c222', '00000000-0000-0000-0000-00000000c211', 'sent', 19000, DATE '2026-10-02', NULL),
  ('00000000-0000-0000-0000-00000000c233', '00000000-0000-0000-0000-00000000c2b5', '00000000-0000-0000-0000-00000000c225', '00000000-0000-0000-0000-00000000c211', 'signed', 9500, DATE '2026-09-20', DATE '2026-09-22');
-- Iron Horse signed our master agreement, which a statement of work needs first.
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status, doc_type) VALUES
  ('gc-company:00000000-0000-0000-0000-00000000c211', 'Master Subcontract Agreement', gen_random_uuid(), 1, 'signed', 'agreement');

-- The library: a statement of work and our construction contract built from clauses, and a W-9 form.
INSERT INTO public.contract_templates (id, name) VALUES ('00000000-0000-0000-0000-00000000c2e1', 'Clause papers bed');
INSERT INTO public.contract_form_templates (id, name, pdf_storage_path, status, doc_type, published_at) VALUES
  ('00000000-0000-0000-0000-00000000c2f1', 'Clause papers bed W-9', 'bed/w9.pdf', 'published', 'w9', now());
INSERT INTO public.contract_template_documents (id, template_id, document_name, form_template_id, revision, published_at) VALUES
  ('00000000-0000-0000-0000-00000000c2d1', '00000000-0000-0000-0000-00000000c2e1', 'Statement of work', NULL, 1, now()),
  ('00000000-0000-0000-0000-00000000c2d2', '00000000-0000-0000-0000-00000000c2e1', 'Construction contract', NULL, 1, now()),
  ('00000000-0000-0000-0000-00000000c2d3', '00000000-0000-0000-0000-00000000c2e1', 'W-9', '00000000-0000-0000-0000-00000000c2f1', 0, NULL);
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, scope) VALUES
  ('00000000-0000-0000-0000-00000000c351', '00000000-0000-0000-0000-00000000c2d1', 1, 'The scope, per the plans and addenda named on it.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c352', '00000000-0000-0000-0000-00000000c2d1', 2, 'Draws: as the master agreement says.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c353', '00000000-0000-0000-0000-00000000c2d1', 3, 'Temporary power stays yours until the permanent service is energized.', ARRAY['Electrical']),
  ('00000000-0000-0000-0000-00000000c354', '00000000-0000-0000-0000-00000000c2d1', 4, 'Water is ours until the meter is set.', ARRAY['Plumbing']),
  ('00000000-0000-0000-0000-00000000c361', '00000000-0000-0000-0000-00000000c2d2', 1, 'The work, per the plans and the bid, at the contract sum.', ARRAY['all']),
  ('00000000-0000-0000-0000-00000000c362', '00000000-0000-0000-0000-00000000c2d2', 2, 'Warranty: one year from acceptance.', ARRAY['all']);

-- Our contract went to Dr. Raman for each clinic, with a whole price by line.
INSERT INTO public.gc_owner_contract_sends (id, project_id, customer_id, first, sign_by, sent_on, note, worth, file_path, file_name, file_sha256) VALUES
  ('00000000-0000-0000-0000-00000000c371', '00000000-0000-0000-0000-00000000c2a1', '00000000-0000-0000-0000-00000000c2c1', true, public.app_today() + 7, public.app_today(), '',
   '{"00000000-0000-0000-0000-00000000c2b1": 100000, "00000000-0000-0000-0000-00000000c2b2": 40000, "00000000-0000-0000-0000-00000000c2b5": 10000, "gc": 20000, "contingency": 5000, "fee": 10000}',
   'c2a1/contract.pdf', 'contract.pdf', repeat('a', 64)),
  ('00000000-0000-0000-0000-00000000c372', '00000000-0000-0000-0000-00000000c2a2', '00000000-0000-0000-0000-00000000c2c1', true, public.app_today() + 7, public.app_today(), '',
   '{"00000000-0000-0000-0000-00000000c2b3": 80000, "gc": 10000, "contingency": 2000, "fee": 5000}',
   'c2a2/contract.pdf', 'contract.pdf', repeat('b', 64)),
  ('00000000-0000-0000-0000-00000000c373', '00000000-0000-0000-0000-00000000c2a3', '00000000-0000-0000-0000-00000000c2c1', true, public.app_today() + 7, public.app_today(), '',
   '{"00000000-0000-0000-0000-00000000c2b4": 30000, "gc": 5000, "contingency": 1000, "fee": 2000}',
   'c2a3/contract.pdf', 'contract.pdf', repeat('c', 64));

CREATE SCHEMA gcp;
CREATE FUNCTION gcp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION gcp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A portal verb's refusal: the key as its message, the words as its DETAIL.
CREATE FUNCTION gcp.refused_key(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION E'% was refused otherwise.\n--- got ---\n% / %\n--- want ---\n% / %', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gcp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The portals sign as the service role, with no user.
CREATE FUNCTION gcp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- A frozen copy, read back: revision, language, heading, between, then each clause as n:id-end.
CREATE FUNCTION gcp.kept(j jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN j IS NULL THEN 'none' ELSE
    concat_ws(' | ', j ->> 'revision', j ->> 'lang', j ->> 'title', coalesce(j ->> 'between', '-'),
      (SELECT string_agg((c ->> 'n') || ':' || right(c ->> 'id', 2), ' ' ORDER BY (c ->> 'n')::int) FROM jsonb_array_elements(j -> 'clauses') c),
      coalesce((SELECT string_agg((c ->> 'n') || ':' || right(c ->> 'id', 2), ' ' ORDER BY (c ->> 'n')::int) FROM jsonb_array_elements(j -> 'exhibit') c), '-'),
      (j -> 'exhibitFor')::text)
  END
$$;
GRANT USAGE ON SCHEMA gcp TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gcp TO anon, authenticated, service_role;

-- 1 · Who picks a paper.
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c202');
SET LOCAL ROLE authenticated;
SELECT gcp.refused('the office does not pick a statement of work''s paper', $q$SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c231', '00000000-0000-0000-0000-00000000c2d1')$q$,
  'Only a dev picks the paper for a statement of work while GC mode is built.');
SELECT gcp.refused('nor our contract''s', $q$SELECT public.gc_set_owner_contract_paper('00000000-0000-0000-0000-00000000c371', '00000000-0000-0000-0000-00000000c2d2')$q$,
  'Only the money team picks the paper for our contract.');
RESET ROLE;
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c204');
SET LOCAL ROLE authenticated;
SELECT gcp.refused('a digital twin picks no paper', $q$SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c231', '00000000-0000-0000-0000-00000000c2d1')$q$,
  'A digital twin cannot pick a paper.');
RESET ROLE;
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c201');
SET LOCAL ROLE authenticated;
SELECT gcp.refused('a form is not a paper built from clauses', $q$SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c231', '00000000-0000-0000-0000-00000000c2d3')$q$,
  'A fillable form is not a paper built from clauses.');
SELECT gcp.refused('a paper not in the library', $q$SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c231', gen_random_uuid())$q$,
  'That paper is not in the Contract library.');
SELECT gcp.refused('a signed statement of work keeps its paper', $q$SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c233', '00000000-0000-0000-0000-00000000c2d1')$q$,
  'That statement of work is signed already.');
SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c231', '00000000-0000-0000-0000-00000000c2d1');
RESET ROLE;
SELECT gcp.same('Robert picks the Electrical statement of work''s paper', (SELECT paper_id::text FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-00000000c231'), '00000000-0000-0000-0000-00000000c2d1');
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c203');
SET LOCAL ROLE authenticated;
SELECT public.gc_set_owner_contract_paper('00000000-0000-0000-0000-00000000c371', '00000000-0000-0000-0000-00000000c2d2');
SELECT public.gc_set_owner_contract_paper('00000000-0000-0000-0000-00000000c372', '00000000-0000-0000-0000-00000000c2d2');
SELECT public.gc_set_owner_contract_paper('00000000-0000-0000-0000-00000000c373', '00000000-0000-0000-0000-00000000c2d2');
RESET ROLE;
SELECT gcp.same('Maria picks our contract''s paper on each send', (
  SELECT string_agg(DISTINCT paper_id::text, ',') FROM public.gc_owner_contract_sends WHERE project_id IN ('00000000-0000-0000-0000-00000000c2a1', '00000000-0000-0000-0000-00000000c2a2', '00000000-0000-0000-0000-00000000c2a3')),
  '00000000-0000-0000-0000-00000000c2d2');

-- 2 · The trade signs its statement of work built from clauses: only at the revision its page showed.
SELECT gcp.as_service();
SET LOCAL ROLE service_role;
SELECT gcp.refused_key('a page that showed no clauses cannot sign them', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-00000000c211', '00000000-0000-0000-0000-00000000c231', 'Dana Whitfield', NULL, NULL, NULL)$q$,
  'paperChanged', 'The paper changed since you opened it. Reload to read the new version.');
SELECT gcp.refused_key('a page that showed an older revision', $q$SELECT public.gc_trade_sign_sow('00000000-0000-0000-0000-00000000c211', '00000000-0000-0000-0000-00000000c231', 'Dana Whitfield', NULL, NULL, NULL, 0, 'es')$q$,
  'paperChanged', 'The paper changed since you opened it. Reload to read the new version.');
SELECT gcp.same('it signs at the revision shown, in Spanish', (
  SELECT (public.gc_trade_sign_sow('00000000-0000-0000-0000-00000000c211', '00000000-0000-0000-0000-00000000c231', 'Dana Whitfield', NULL, NULL, NULL, 1, 'es') = now())::text), 'true');
SELECT gcp.same('a statement of work with no paper signs as before', (
  SELECT (public.gc_trade_sign_sow('00000000-0000-0000-0000-00000000c211', '00000000-0000-0000-0000-00000000c232', 'Dana Whitfield', NULL, NULL, NULL) = now())::text), 'true');
RESET ROLE;
SELECT gcp.same('it keeps the job''s clauses and its own trade''s exhibit, never another trade''s', (
  SELECT status || ' | ' || paper_revision || ' | ' || gcp.kept(clause_versions) FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-00000000c231'),
  'signed | 1 | 1 | es | Statement of work | Click Construction y Iron Horse Electric | 1:51 2:52 | 3:53 | ["Electrical"]');
SELECT gcp.same('the one with no paper keeps nothing', (
  SELECT status || ' | ' || coalesce(paper_revision::text, '-') || ' | ' || gcp.kept(clause_versions) FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-00000000c232'),
  'signed | - | none');

-- 3 · Robert retires the Electrical clause: the signed copy keeps it, and nothing rewrites it.
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c201');
SET LOCAL ROLE authenticated;
SELECT gcp.same('Robert retires it', (
  SELECT public.edit_clause('00000000-0000-0000-0000-00000000c2d1', 'retire', '00000000-0000-0000-0000-00000000c353', '', '', NULL, 'the service is in')->>'state'), 'published');
SELECT gcp.refused('a signed statement of work''s paper stays', $q$SELECT public.gc_set_sow_paper('00000000-0000-0000-0000-00000000c231', NULL)$q$,
  'That statement of work is signed already.');
RESET ROLE;
SELECT gcp.same('the signed copy keeps the retired clause', (
  SELECT gcp.kept(clause_versions) FROM public.gc_sows WHERE id = '00000000-0000-0000-0000-00000000c231'),
  '1 | es | Statement of work | Click Construction y Iron Horse Electric | 1:51 2:52 | 3:53 | ["Electrical"]');
SELECT gcp.refused('nobody rewrites a signed statement of work''s clauses', $q$UPDATE public.gc_sows SET clause_versions = '{}'::jsonb WHERE id = '00000000-0000-0000-0000-00000000c231'$q$,
  'A signed copy keeps the words it was signed with.');

-- 4 · The customer signs our contract built from clauses the same way: the clauses for everyone, no exhibit.
SELECT gcp.as_service();
SET LOCAL ROLE service_role;
SELECT gcp.refused_key('a page that showed no clauses cannot sign them', $q$SELECT public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-00000000c2c1', '00000000-0000-0000-0000-00000000c371', 'Priya Raman', '', '', '')$q$,
  'paperChanged', 'The paper changed since you opened it. Reload to read the new version.');
SELECT gcp.same('she signs at the revision shown', (
  SELECT (public.gc_customer_sign_owner_contract('00000000-0000-0000-0000-00000000c2c1', '00000000-0000-0000-0000-00000000c371', 'Priya Raman', '', '', '', 1, 'en') = now())::text), 'true');
RESET ROLE;
SELECT gcp.same('our contract keeps the clauses for everyone, between us and her', (
  SELECT (signed_on = public.app_today()) || ' | ' || paper_revision || ' | ' || gcp.kept(clause_versions) FROM public.gc_owner_contract_sends WHERE id = '00000000-0000-0000-0000-00000000c371'),
  'true | 1 | 1 | en | Construction contract | Click Construction and Raman Dental Group | 1:61 2:62 | - | []');
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c203');
SET LOCAL ROLE authenticated;
SELECT gcp.refused('a signed contract keeps its paper', $q$SELECT public.gc_set_owner_contract_paper('00000000-0000-0000-0000-00000000c371', NULL)$q$,
  'That contract is signed already.');
-- 5 · A freeze on its own waits for the project to be signed.
SELECT public.gc_owner_contract_freeze_newest('00000000-0000-0000-0000-00000000c2a3');
RESET ROLE;
SELECT gcp.same('nothing freezes on a project not signed', (SELECT gcp.kept(clause_versions) FROM public.gc_owner_contract_sends WHERE id = '00000000-0000-0000-0000-00000000c373'), 'none');

-- 6 · Robert marks the second clinic's contract signed on paper: the office attests, so the send keeps its clauses.
SELECT gcp.as_user('00000000-0000-0000-0000-00000000c201');
SET LOCAL ROLE authenticated;
SELECT public.gc_sign_owner_contract('00000000-0000-0000-0000-00000000c2a2', public.app_today(),
  '{"00000000-0000-0000-0000-00000000c2b3": 80000, "gc": 10000, "contingency": 2000, "fee": 5000}'::jsonb);
RESET ROLE;
SELECT gcp.same('Mark it signed freezes the newest send''s clauses', (
  SELECT paper_revision || ' | ' || gcp.kept(clause_versions) FROM public.gc_owner_contract_sends WHERE id = '00000000-0000-0000-0000-00000000c372'),
  '1 | 1 | en | Construction contract | Click Construction and Raman Dental Group | 1:61 2:62 | - | []');
SELECT gcp.same('and the project is signed', (SELECT (owner_contract_signed_on = public.app_today())::text FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-00000000c2a2'), 'true');

-- 7 · The functions: one signature each for the two sign verbs, the service role's alone; the setters signed in.
SELECT gcp.same('one gc_trade_sign_sow and one gc_customer_sign_owner_contract, the service role''s alone', (
  SELECT string_agg(p.proname || '(' || p.pronargs || '):' || has_function_privilege('service_role', p.oid, 'EXECUTE') || '/' || has_function_privilege('authenticated', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('gc_trade_sign_sow', 'gc_customer_sign_owner_contract')),
  'gc_customer_sign_owner_contract(8):true/false gc_trade_sign_sow(8):true/false');
SELECT gcp.same('the setters are for the signed in, never anon', (
  SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/' || has_function_privilege('anon', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('gc_set_sow_paper', 'gc_set_owner_contract_paper', 'contract_clause_freeze', 'gc_owner_contract_freeze_newest')),
  'contract_clause_freeze:true/false gc_owner_contract_freeze_newest:true/false gc_set_owner_contract_paper:true/false gc_set_sow_paper:true/false');

DO $$ BEGIN RAISE NOTICE 'gc_clause_papers PASSED'; END $$;
ROLLBACK;
