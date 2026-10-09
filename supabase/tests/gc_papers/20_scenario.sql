-- A trade partner company's papers (v2.NNNN, the Board's B6-b-i, migration 20261010009000): the company's paper under a
-- name no person can have, held both ways; the person trigger deriving the company and leaving a person's paper as it
-- was; every send of a paper with its promise; who may send; and a project's or a company's delete. Presses run as a dev
-- (or an estimator) through RLS; the fixture is made as postgres; everything rolls back. Raises on the first failed
-- assertion; ends with "gc_papers PASSED". See scripts/pgtest-gc-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000007d1', 'dev@papers.test'), ('00000000-0000-0000-0000-0000000007d2', 'estimator@papers.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@papers.test', 'Papers Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000007d2', 'estimator@papers.test', 'Papers Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- A person on the roster, once by name: their paper still finds them (resolve_pay_person_id).
INSERT INTO public.people (id, master_user_id, kind, name) VALUES ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007d1', 'sub', 'Bed Sub Dana');

-- The Contract Book: the Subs packet with the master agreement and the W-9 form.
INSERT INTO public.contract_templates (id, name) VALUES ('00000000-0000-0000-0000-0000000007a1', 'Papers bed Subs');
INSERT INTO public.contract_form_templates (id, name, pdf_storage_path, status, doc_type, published_at) VALUES
  ('00000000-0000-0000-0000-0000000007f1', 'Papers bed W-9', 'bed/template.pdf', 'published', 'w9', now());
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format, canonical_document_url) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007a1', 'Master Subcontract Agreement', '<p>Terms.</p>', 'html', 'https://example.test/msa.pdf');
INSERT INTO public.contract_template_documents (id, template_id, document_name, form_template_id) VALUES
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007a1', 'W-9', '00000000-0000-0000-0000-0000000007f1');

-- Two companies, and a building project with one trade.
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-000000000711', 'Papers Concrete', '{Concrete}'),
  ('00000000-0000-0000-0000-000000000712', 'Papers Paving', '{Paving}');
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000007c1', 'Papers Owner', '00000000-0000-0000-0000-0000000007d1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-0000000007a9', 'Papers test clinic', '00000000-0000-0000-0000-0000000007c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000007a9', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-0000000007ab', '00000000-0000-0000-0000-0000000007a9', 'Concrete', 0, 50000, false);

CREATE SCHEMA gpt;
CREATE FUNCTION gpt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with exactly these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION gpt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- A statement the database itself refuses, by its SQLSTATE.
CREATE FUNCTION gpt.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM want THEN RAISE EXCEPTION '% was refused as % (%), not %', label, SQLSTATE, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gpt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA gpt TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gpt TO authenticated;

-- 0 · Who may send: an estimator is refused in words before any write.
SELECT gpt.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT gpt.refused('an estimator makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-0000000007b1')$q$,
  'Only a dev sends a trade its papers while GC mode is built.');
SELECT gpt.refused('an estimator sends no paper', $q$SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "msa", "dueOn": "2026-10-16", "what": "the signed master agreement"}')$q$,
  'Only a dev sends a trade its papers while GC mode is built.');
SELECT gpt.same('an estimator reads no send', (SELECT count(*)::text FROM public.gc_paper_sends), '0');
RESET ROLE;

SELECT gpt.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;

-- 1 · A company's paper: the stored name, the company, no person; the Book's entry; a second call is the same row.
SELECT public.gc_company_paper('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-0000000007b1') IS NOT NULL AS made;
SELECT gpt.same('the company''s master agreement', (
  SELECT person_name || ' ' || company_id || ' ' || coalesce(person_id::text, 'no person') || ' ' || status || ' ' || doc_type || ' ' || applied_contract_template_document_id
  FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-000000000711'),
  'gc-company:00000000-0000-0000-0000-000000000711 00000000-0000-0000-0000-000000000711 no person unsent agreement 00000000-0000-0000-0000-0000000007b1');
SELECT gpt.same('a second call is the same paper', (
  SELECT (public.gc_company_paper('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-0000000007b1')
          = (SELECT id FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-000000000711'))::text), 'true');
-- The W-9 is a form: the form trigger stamps its type, as on a person's copy.
SELECT public.gc_company_paper('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-0000000007b2') IS NOT NULL AS made_w9;
SELECT gpt.same('the company''s W-9 is a w9', (
  SELECT doc_type || ' ' || form_template_id FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-000000000711' AND document_name = 'W-9'),
  'w9 00000000-0000-0000-0000-0000000007f1');
SELECT gpt.refused('no paper for a company that is not there', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-000000000799', '00000000-0000-0000-0000-0000000007b1')$q$, 'No company with that id.');
SELECT gpt.refused('no paper the Book does not have', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-0000000007b9')$q$, 'That paper is not in the Contract Book.');

-- 2 · A send and its promise; a second send moves the promise and keeps its first day; a waiver's promise is closeout.
SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "msa", "dueOn": "2026-10-16", "note": "Thanks.", "first": true, "what": "the signed master agreement"}') IS NOT NULL AS sent;
SELECT gpt.same('the send', (SELECT paper || ' ' || due_on || ' ' || first || ' ' || note || ' ' || (sent_on = public.app_today()) FROM public.gc_paper_sends),
  'msa 2026-10-16 true Thanks. true');
SELECT gpt.same('its promise', (SELECT kind || ' ' || due_on || ' ' || source || ' ' || what FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-000000000711'),
  'msa 2026-10-16 office the signed master agreement');
SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "msa", "dueOn": "2026-10-20", "what": "the signed master agreement"}') IS NOT NULL AS reminded;
SELECT gpt.same('a reminder moves the promise and keeps its first day', (
  SELECT count(*) || ' sends, promise due ' || (SELECT due_on FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-000000000711' AND kept_on IS NULL)
      || ', was ' || (SELECT string_agg(was_due_on::text, ',') FROM public.gc_trade_promise_moves)
  FROM public.gc_paper_sends), '2 sends, promise due 2026-10-20, was 2026-10-16');
SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "waiver", "projectId": "00000000-0000-0000-0000-0000000007a9", "packageId": "00000000-0000-0000-0000-0000000007ab", "dueOn": "2026-10-18", "draws": [1, 2], "what": "the unconditional waivers"}') IS NOT NULL AS asked_waiver;
SELECT gpt.same('a waiver''s send names its draws, and its promise is closeout', (
  SELECT s.draws::text || ' ' || (SELECT kind FROM public.gc_trade_promises WHERE package_id = '00000000-0000-0000-0000-0000000007ab')
  FROM public.gc_paper_sends s WHERE s.paper = 'waiver'), '{1,2} closeout');

-- 3 · The refusals, in words.
SELECT gpt.refused('no company', $q$SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000799", "paper": "msa", "dueOn": "2026-10-16", "what": "x"}')$q$, 'No company with that id.');
SELECT gpt.refused('an unknown paper', $q$SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "lunch", "dueOn": "2026-10-16", "what": "x"}')$q$, 'That is not a paper we send.');
SELECT gpt.refused('a statement of work with no trade', $q$SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "sow", "dueOn": "2026-10-16", "what": "x"}')$q$, 'A statement of work or a waiver is for one trade on a job.');
SELECT gpt.refused('no day', $q$SELECT public.gc_send_paper('{"companyId": "00000000-0000-0000-0000-000000000711", "paper": "w9"}')$q$, 'Pick the day to ask for it by.');

RESET ROLE;

-- 4 · Both ways, and the person trigger. A copy that lost its company (the Book's new versions) takes it back from its name.
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status)
VALUES ('gc-company:00000000-0000-0000-0000-000000000712', 'Master Subcontract Agreement', gen_random_uuid(), 1, 'unsent');
SELECT gpt.same('a copy takes its company back from its name', (
  SELECT company_id || ' ' || coalesce(person_id::text, 'no person') FROM public.person_contract_documents WHERE person_name = 'gc-company:00000000-0000-0000-0000-000000000712'),
  '00000000-0000-0000-0000-000000000712 no person');
-- A person's paper finds its person, as before, and has no company.
INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status)
VALUES ('Bed Sub Dana', 'Master Subcontract Agreement', gen_random_uuid(), 1, 'unsent');
SELECT gpt.same('a person''s paper finds its person', (
  SELECT coalesce(person_id::text, 'none') || ' ' || coalesce(company_id::text, 'no company') FROM public.person_contract_documents WHERE person_name = 'Bed Sub Dana'),
  '00000000-0000-0000-0000-0000000007e1 no company');
-- A company's paper never keeps a person, even when one is written.
INSERT INTO public.person_contract_documents (person_name, company_id, person_id, document_name, contract_lineage_id, lineage_version, status)
VALUES ('gc-company:00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-0000000007e1', 'W-9 by hand', gen_random_uuid(), 1, 'unsent');
SELECT gpt.same('a company''s paper keeps no person', (
  SELECT coalesce(person_id::text, 'no person') FROM public.person_contract_documents WHERE document_name = 'W-9 by hand'), 'no person');
SELECT gpt.refused_code('a stored name that is not well formed has no company', $q$INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id, lineage_version, status) VALUES ('gc-company:not-a-uuid', 'X', gen_random_uuid(), 1, 'unsent')$q$, '23514');
SELECT gpt.refused_code('a company under a person''s name', $q$INSERT INTO public.person_contract_documents (person_name, company_id, document_name, contract_lineage_id, lineage_version, status) VALUES ('Bed Sub Dana', '00000000-0000-0000-0000-000000000712', 'X', gen_random_uuid(), 1, 'unsent')$q$, '23514');
SELECT gpt.refused_code('a company under another company''s name', $q$INSERT INTO public.person_contract_documents (person_name, company_id, document_name, contract_lineage_id, lineage_version, status) VALUES ('gc-company:00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000712', 'X', gen_random_uuid(), 1, 'unsent')$q$, '23514');
SELECT gpt.refused_code('moving a company''s paper to a person''s name', $q$UPDATE public.person_contract_documents SET person_name = 'Bed Sub Dana' WHERE document_name = 'W-9 by hand'$q$, '23514');

-- 5 · Who reads and writes: gc_paper_sends carries its dev policy and the read-only and twin blocks.
SELECT gpt.same('gc_paper_sends carries its policy and blocks', (
  SELECT string_agg(polname, ',' ORDER BY polname) FROM pg_policy WHERE polrelid = 'public.gc_paper_sends'::regclass),
  'digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,gc_paper_sends_dev,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update');
SELECT gpt.same('the person trigger fires on the company too', (
  SELECT pg_get_triggerdef(oid) LIKE '%UPDATE OF person_name, company_id%' FROM pg_trigger WHERE tgname = 'set_person_id_on_write' AND tgrelid = 'public.person_contract_documents'::regclass)::text, 'true');

-- 6 · Deletes: a project's sends go with it; a company with papers stays (its signed papers are kept).
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000007a9';
SELECT gpt.same('a project''s delete takes its sends, and the company''s own stay', (
  SELECT count(*) FILTER (WHERE package_id IS NOT NULL) || ' ' || count(*) FILTER (WHERE package_id IS NULL) FROM public.gc_paper_sends), '0 2');
SELECT gpt.refused_code('a company with papers is not deleted', $q$DELETE FROM public.gc_companies WHERE id = '00000000-0000-0000-0000-000000000711'$q$, '23503');

DO $$ BEGIN RAISE NOTICE 'gc_papers PASSED'; END $$;
ROLLBACK;
