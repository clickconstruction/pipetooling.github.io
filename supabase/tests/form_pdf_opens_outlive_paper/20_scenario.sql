-- The open log outlives its paper (migration *_form_pdf_opens_outlive_paper, punch list #403, the owner's fourth
-- decision of 2026-11-22). The scenario, inside one transaction that rolls back:
--   * an open of a signed form keeps its paper's name and who the paper was with on its own line: the person a paper
--     is filed under, a party's frozen name and a trade company's name, never a stored name;
--   * deleting the paper leaves the line, with its link emptied and its words kept;
--   * an open still needs a paper that is there when it is written;
--   * a dev and the controller read the log, and nobody else reads a line, as before.
-- Every name and company is made up. The opens are written as postgres, standing in for the edge function's service
-- role; the papers are written and deleted, and the log is read, as each user through RLS. Raises on the first failed
-- assertion; ends with "form_pdf_opens_outlive_paper PASSED". See scripts/pgtest-form-pdf-opens-outlive-paper.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000006c0d1', 'dev@openlog.test'),
  ('00000000-0000-0000-0000-00000006c0d2', 'master@openlog.test'),
  ('00000000-0000-0000-0000-00000006c0d3', 'assistant@openlog.test'),
  ('00000000-0000-0000-0000-00000006c0d4', 'controller@openlog.test'),
  ('00000000-0000-0000-0000-00000006c0d5', 'estimator@openlog.test'),
  ('00000000-0000-0000-0000-00000006c0d6', 'primary@openlog.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000006c0d1', 'dev@openlog.test', 'Openlog Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000006c0d2', 'master@openlog.test', 'Openlog Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000006c0d3', 'assistant@openlog.test', 'Openlog Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000006c0d4', 'controller@openlog.test', 'Openlog Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-00000006c0d5', 'estimator@openlog.test', 'Openlog Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-00000006c0d6', 'primary@openlog.test', 'Openlog Primary', 'primary', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-00000006c0e1', '00000000-0000-0000-0000-00000006c0d2', 'helper', 'Pat Tallman', NULL);
INSERT INTO public.supply_houses (id, name, phone, vendor_kind) VALUES
  ('00000000-0000-0000-0000-00000006c0a1', 'Tallgrass Supply Co.', '(210) 555-0142', 'supply_house');
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-00000006c0b1', 'Juniper Mechanical LLC', '{Plumbing}');

CREATE SCHEMA ol;
CREATE FUNCTION ol.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ol.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF position(want IN SQLERRM || ' ' || coalesce(v_detail, '')) = 0 THEN
      RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n% %\n--- want it to hold ---\n%', label, SQLERRM, v_detail, want;
    END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION ol.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Every line of the log, past every policy: whether it still has its paper, and the words it keeps.
CREATE FUNCTION ol.lines() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(concat_ws('|', CASE WHEN person_contract_document_id IS NULL THEN 'no paper' ELSE 'paper' END, coalesce(paper_name, '-'), coalesce(paper_with, '-')), ' ; ' ORDER BY paper_name), 'none')
  FROM public.contract_form_pdf_opens
$$;
-- The lines a caller reads, under their own policies.
CREATE FUNCTION ol.mine() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.contract_form_pdf_opens
$$;
GRANT USAGE ON SCHEMA ol TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ol TO authenticated, anon;

-- Three signed papers, written as the office: a person's, a supply house's and a trade company's own.
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d3');
SET LOCAL ROLE authenticated;
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, status, signed_at)
  VALUES ('00000000-0000-0000-0000-000006c00101', 'Pat Tallman', 'A W-9', gen_random_uuid(), 1, 'signed', DATE '2026-11-01');
INSERT INTO public.person_contract_documents (id, person_name, party_contact_id, party_name, document_name, contract_lineage_id, lineage_version, status, signed_at, signer_name)
  SELECT '00000000-0000-0000-0000-000006c00102', 'party:' || x.id::text, x.id, 'Tallgrass Supply Co.', 'B W-9', gen_random_uuid(), 1, 'signed', DATE '2026-11-02', 'Lena Park'
  FROM (SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-00000006c0a1') AS id) x;
INSERT INTO public.person_contract_documents (id, person_name, company_id, document_name, contract_lineage_id, lineage_version, status, signed_at)
  VALUES ('00000000-0000-0000-0000-000006c00103', 'gc-company:00000000-0000-0000-0000-00000006c0b1', '00000000-0000-0000-0000-00000006c0b1', 'C W-9', gen_random_uuid(), 1, 'signed', DATE '2026-11-03');
RESET ROLE;

-- 1 · An open keeps its paper's words. Written as the edge function writes it: the paper and who opened it.
INSERT INTO public.contract_form_pdf_opens (person_contract_document_id, opened_by) VALUES
  ('00000000-0000-0000-0000-000006c00101', '00000000-0000-0000-0000-00000006c0d1'),
  ('00000000-0000-0000-0000-000006c00102', '00000000-0000-0000-0000-00000006c0d4'),
  ('00000000-0000-0000-0000-000006c00103', '00000000-0000-0000-0000-00000006c0d5');
SELECT ol.same('each line keeps its paper''s name and who it was with, never a stored name', ol.lines(),
  'paper|A W-9|Pat Tallman ; paper|B W-9|Tallgrass Supply Co. ; paper|C W-9|Juniper Mechanical LLC');
SELECT ol.refused('an open of a paper that is not there', $q$INSERT INTO public.contract_form_pdf_opens (person_contract_document_id, opened_by) VALUES ('00000000-0000-0000-0000-0000006cdead', '00000000-0000-0000-0000-00000006c0d1')$q$, 'foreign key');

-- 2 · The papers are deleted, as a dev may. Their lines stay.
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d1');
SET LOCAL ROLE authenticated;
DELETE FROM public.person_contract_documents WHERE id IN ('00000000-0000-0000-0000-000006c00101', '00000000-0000-0000-0000-000006c00102');
RESET ROLE;
SELECT ol.same('the two papers are gone', (SELECT count(*)::text FROM public.person_contract_documents WHERE id IN ('00000000-0000-0000-0000-000006c00101', '00000000-0000-0000-0000-000006c00102')), '0');
SELECT ol.same('their lines outlive them, with their words', ol.lines(),
  'no paper|A W-9|Pat Tallman ; no paper|B W-9|Tallgrass Supply Co. ; paper|C W-9|Juniper Mechanical LLC');
SELECT ol.same('who opened them is still on the line', (
  SELECT string_agg(u.name, ', ' ORDER BY o.paper_name) FROM public.contract_form_pdf_opens o JOIN public.users u ON u.id = o.opened_by), 'Openlog Dev, Openlog Controller, Openlog Estimator');
-- A company renamed afterwards: the line keeps the name as it stood at the open.
UPDATE public.gc_companies SET name = 'Juniper Mechanical Inc' WHERE id = '00000000-0000-0000-0000-00000006c0b1';
SELECT ol.same('a line keeps the name as it stood when the form was opened', ol.lines(),
  'no paper|A W-9|Pat Tallman ; no paper|B W-9|Tallgrass Supply Co. ; paper|C W-9|Juniper Mechanical LLC');

-- 3 · Who reads the log: a dev and the controller, and nobody else, as before.
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d1');
SET LOCAL ROLE authenticated;
SELECT ol.same('a dev reads every line', ol.mine(), '3');
RESET ROLE;
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d2');
SET LOCAL ROLE authenticated;
SELECT ol.same('a leader reads no line', ol.mine(), '0');
RESET ROLE;
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d3');
SET LOCAL ROLE authenticated;
SELECT ol.same('an assistant reads no line', ol.mine(), '0');
RESET ROLE;
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d4');
SET LOCAL ROLE authenticated;
SELECT ol.same('the controller reads every line', ol.mine(), '3');
RESET ROLE;
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d5');
SET LOCAL ROLE authenticated;
SELECT ol.same('an estimator reads no line, their own open included', ol.mine(), '0');
RESET ROLE;
SELECT ol.as_user('00000000-0000-0000-0000-00000006c0d6');
SET LOCAL ROLE authenticated;
SELECT ol.same('a primary reads no line', ol.mine(), '0');
RESET ROLE;

-- 4 · The key's shape: a deleted paper empties the link.
SELECT ol.same('the link to the paper is emptied on delete, and may be empty', (
  SELECT c.confdeltype::text || ' ' || (SELECT (NOT a.attnotnull)::text FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'person_contract_document_id')
  FROM pg_constraint c
  WHERE c.conrelid = 'public.contract_form_pdf_opens'::regclass AND c.contype = 'f' AND c.confrelid = 'public.person_contract_documents'::regclass), 'n true');

DO $$ BEGIN RAISE NOTICE 'form_pdf_opens_outlive_paper PASSED'; END $$;
ROLLBACK;
