-- A paper names a site (punch list #439, piece 3, migration *_paper_names_a_site). Four columns on a paper's row and
-- three checks that hold their shape. And Documents → Agreements answers the site (migration *_agreements_on_file_site). Fixtures are made as postgres, standing in for the screens; the two writes of
-- case 7 run as each user through RLS. Raises on the first failed assertion; ends with "paper_site PASSED". See
-- scripts/pgtest-paper-site.sh. Never against prod. Every person, development and address is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA psb;
CREATE FUNCTION psb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement that must be refused by the named check. Anything else it raises fails the bed.
CREATE FUNCTION psb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN check_violation THEN
    IF position(want IN SQLERRM) = 0 THEN
      RAISE EXCEPTION E'% was refused by another check.\n--- got ---\n%\n--- want it to name ---\n%', label, SQLERRM, want;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION psb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- One paper's site, past RLS: the development's last four characters, the key, the address as written, the print.
CREATE FUNCTION psb.site(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT concat_ws(' | ', COALESCE(right(d.site_development_id::text, 4), 'no development'), COALESCE(d.site_address_key, 'no key'),
                   COALESCE(d.site_address, 'no address'), CASE WHEN d.site_prints_address THEN 'prints' ELSE 'does not print' END)
  FROM public.person_contract_documents d WHERE d.id = p_id
$$;
GRANT USAGE ON SCHEMA psb TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA psb TO authenticated, service_role;

-- Who: Devon the dev and Sol the subcontractor. One development. Four papers, made as the table stood before: no site.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000439a1', 'devon@papersite.test'),
  ('00000000-0000-0000-0000-0000000439a2', 'sol@papersite.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000439a1', 'devon@papersite.test', 'Devon Dev Psb', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000439a2', 'sol@papersite.test', 'Sol Sub Psb', 'subcontractor', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.developments (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000439d1', 'ZZ Test Site Bed Development', '00000000-0000-0000-0000-0000000439a1');
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id) VALUES
  ('00000000-0000-0000-0000-000004390101', 'ZZ Test Site Vendor One', 'Site secrecy paper', gen_random_uuid()),
  ('00000000-0000-0000-0000-000004390102', 'ZZ Test Site Vendor Two', 'Site secrecy paper', gen_random_uuid()),
  ('00000000-0000-0000-0000-000004390103', 'ZZ Test Site Vendor Three', 'Site secrecy paper', gen_random_uuid()),
  ('00000000-0000-0000-0000-000004390104', 'ZZ Test Site Vendor Four', 'Site secrecy paper', gen_random_uuid());

-- ---------------------------------------------------------------------------------------------------------------
-- 1. A paper made with no word of a site names none and prints no address.
SELECT psb.same('a paper made with no site names none', psb.site('00000000-0000-0000-0000-000004390101'),
  'no development | no key | no address | does not print');

-- 2. A paper names a development.
UPDATE public.person_contract_documents SET site_development_id = '00000000-0000-0000-0000-0000000439d1'
  WHERE id = '00000000-0000-0000-0000-000004390101';
SELECT psb.same('a paper names a development', psb.site('00000000-0000-0000-0000-000004390101'),
  '39d1 | no key | no address | does not print');

-- 3. A paper names an address: by its key alone, with the address as written, and with the print ticked.
UPDATE public.person_contract_documents SET site_address_key = '100 example road springfield'
  WHERE id = '00000000-0000-0000-0000-000004390102';
SELECT psb.same('a paper names an address by its key alone', psb.site('00000000-0000-0000-0000-000004390102'),
  'no development | 100 example road springfield | no address | does not print');
UPDATE public.person_contract_documents SET site_address = '100 Example Rd, Springfield'
  WHERE id = '00000000-0000-0000-0000-000004390102';
UPDATE public.person_contract_documents SET site_prints_address = true
  WHERE id = '00000000-0000-0000-0000-000004390102';
SELECT psb.same('and keeps the address as written, with the print ticked', psb.site('00000000-0000-0000-0000-000004390102'),
  'no development | 100 example road springfield | 100 Example Rd, Springfield | prints');
UPDATE public.person_contract_documents SET site_address_key = repeat('k', 300)
  WHERE id = '00000000-0000-0000-0000-000004390103';
SELECT psb.same('a key of 300 characters is kept',
  (SELECT char_length(site_address_key)::text FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-000004390103'), '300');

-- 4. Never both: a development and an address on one paper, either way round.
SELECT psb.refused('an address on a paper that names a development',
  $q$UPDATE public.person_contract_documents SET site_address_key = '100 example road springfield' WHERE id = '00000000-0000-0000-0000-000004390101'$q$,
  'person_contract_documents_site_one_kind');
SELECT psb.refused('a development on a paper that names an address',
  $q$UPDATE public.person_contract_documents SET site_development_id = '00000000-0000-0000-0000-0000000439d1' WHERE id = '00000000-0000-0000-0000-000004390102'$q$,
  'person_contract_documents_site_one_kind');

-- 5. The key's words: never blank, at most 300 characters.
SELECT psb.refused('a blank key',
  $q$UPDATE public.person_contract_documents SET site_address_key = '   ' WHERE id = '00000000-0000-0000-0000-000004390104'$q$,
  'person_contract_documents_site_key_words');
SELECT psb.refused('a key of 301 characters',
  $q$UPDATE public.person_contract_documents SET site_address_key = repeat('k', 301) WHERE id = '00000000-0000-0000-0000-000004390104'$q$,
  'person_contract_documents_site_key_words');

-- 6. The address as written: only beside a key, never blank, at most 500 characters. And the print needs an address.
SELECT psb.refused('an address as written with no key',
  $q$UPDATE public.person_contract_documents SET site_address = '100 Example Rd, Springfield' WHERE id = '00000000-0000-0000-0000-000004390104'$q$,
  'person_contract_documents_site_address_words');
SELECT psb.refused('an address as written on a paper that names a development',
  $q$UPDATE public.person_contract_documents SET site_address = '100 Example Rd, Springfield' WHERE id = '00000000-0000-0000-0000-000004390101'$q$,
  'person_contract_documents_site_address_words');
SELECT psb.refused('a blank address as written',
  $q$UPDATE public.person_contract_documents SET site_address = '  ' WHERE id = '00000000-0000-0000-0000-000004390103'$q$,
  'person_contract_documents_site_address_words');
SELECT psb.refused('an address as written of 501 characters',
  $q$UPDATE public.person_contract_documents SET site_address = repeat('a', 501) WHERE id = '00000000-0000-0000-0000-000004390103'$q$,
  'person_contract_documents_site_address_words');
SELECT psb.refused('the print ticked on a paper with a key and no address as written',
  $q$UPDATE public.person_contract_documents SET site_prints_address = true WHERE id = '00000000-0000-0000-0000-000004390103'$q$,
  'person_contract_documents_site_address_words');
SELECT psb.refused('the print ticked on a paper that names a development',
  $q$UPDATE public.person_contract_documents SET site_prints_address = true WHERE id = '00000000-0000-0000-0000-000004390101'$q$,
  'person_contract_documents_site_address_words');
SELECT psb.refused('the key taken off a paper that keeps its address as written',
  $q$UPDATE public.person_contract_documents SET site_address_key = NULL WHERE id = '00000000-0000-0000-0000-000004390102'$q$,
  'person_contract_documents_site_address_words');

-- 7. Through the table's own policies: the dev writes a paper's site, and a subcontractor reaches no row.
SELECT psb.as_user('00000000-0000-0000-0000-0000000439a1');
SET LOCAL ROLE authenticated;
UPDATE public.person_contract_documents SET site_address_key = '200 example avenue springfield', site_address = '200 Example Ave, Springfield'
  WHERE id = '00000000-0000-0000-0000-000004390104';
SELECT psb.same('the dev writes a paper''s site through RLS', psb.site('00000000-0000-0000-0000-000004390104'),
  'no development | 200 example avenue springfield | 200 Example Ave, Springfield | does not print');
RESET ROLE;
SELECT psb.as_user('00000000-0000-0000-0000-0000000439a2');
SET LOCAL ROLE authenticated;
UPDATE public.person_contract_documents SET site_address_key = NULL, site_address = NULL WHERE id = '00000000-0000-0000-0000-000004390104';
SELECT psb.same('a subcontractor''s write reaches no row', psb.site('00000000-0000-0000-0000-000004390104'),
  'no development | 200 example avenue springfield | 200 Example Ave, Springfield | does not print');
RESET ROLE;

-- 8. The development deleted: the paper stands and names no site.
DELETE FROM public.developments WHERE id = '00000000-0000-0000-0000-0000000439d1';
SELECT psb.same('a development deleted leaves its paper naming no site', psb.site('00000000-0000-0000-0000-000004390101'),
  'no development | no key | no address | does not print');

-- 9. The two indexes are there and partial, and the three checks are validated. The key to developments is a
-- constraint of the table too, named alike, so the checks are read by their kind.
SELECT psb.same('the two indexes are partial',
  (SELECT string_agg(indexname || ': ' || (indexdef LIKE '%WHERE (% IS NOT NULL)')::text, ' · ' ORDER BY indexname)
   FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'person_contract_documents' AND indexname LIKE 'idx_person_contract_documents_site_%'),
  'idx_person_contract_documents_site_address_key: true · idx_person_contract_documents_site_development: true');
SELECT psb.same('the three checks are validated',
  (SELECT string_agg(conname || ': ' || convalidated::text, ' · ' ORDER BY conname)
   FROM pg_constraint WHERE conrelid = 'public.person_contract_documents'::regclass AND contype = 'c' AND conname LIKE 'person_contract_documents_site_%'),
  'person_contract_documents_site_address_words: true · person_contract_documents_site_key_words: true · person_contract_documents_site_one_kind: true');

-- 10. Documents → Agreements answers the site (migration *_agreements_on_file_site): three columns, the view's last,
-- in this order. A sent agreement that names an address reads its key and its address as written on its line. One that
-- names a development reads the development. A paper that names no site reads three nulls.
SELECT psb.same('agreements_on_file ends with the three columns of a site',
  (SELECT string_agg(column_name || ' ' || data_type, ' · ' ORDER BY ordinal_position)
   FROM (SELECT column_name, data_type, ordinal_position FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'agreements_on_file' ORDER BY ordinal_position DESC LIMIT 3) c),
  'site_development_id uuid · site_address_key text · site_address text');
INSERT INTO public.developments (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000439d2', 'ZZ Test Site Bed Development Two', '00000000-0000-0000-0000-0000000439a1');
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, status, doc_type, sent_at, site_development_id, site_address_key, site_address) VALUES
  ('00000000-0000-0000-0000-000004390111', 'ZZ Test Site Vendor Five', 'Site secrecy paper', gen_random_uuid(), 'sent', 'agreement', '2026-11-20T15:00:00Z', NULL, '300 example court springfield', '300 Example Ct, Springfield'),
  ('00000000-0000-0000-0000-000004390112', 'ZZ Test Site Vendor Six', 'Site secrecy paper', gen_random_uuid(), 'sent', 'agreement', '2026-11-20T15:00:00Z', '00000000-0000-0000-0000-0000000439d2', NULL, NULL),
  ('00000000-0000-0000-0000-000004390113', 'ZZ Test Site Vendor Seven', 'Site secrecy paper', gen_random_uuid(), 'sent', 'agreement', '2026-11-20T15:00:00Z', NULL, NULL, NULL);
SELECT psb.same('a paper that names an address reads it on its line',
  (SELECT concat_ws(' | ', COALESCE(right(site_development_id::text, 4), 'no development'), COALESCE(site_address_key, 'no key'), COALESCE(site_address, 'no address'))
   FROM public.agreements_on_file WHERE id LIKE '%:00000000-0000-0000-0000-000004390111'),
  'no development | 300 example court springfield | 300 Example Ct, Springfield');
SELECT psb.same('a paper that names a development reads it on its line',
  (SELECT concat_ws(' | ', COALESCE(right(site_development_id::text, 4), 'no development'), COALESCE(site_address_key, 'no key'), COALESCE(site_address, 'no address'))
   FROM public.agreements_on_file WHERE id LIKE '%:00000000-0000-0000-0000-000004390112'),
  '39d2 | no key | no address');
SELECT psb.same('a paper that names no site reads none on its line',
  (SELECT concat_ws(' | ', COALESCE(right(site_development_id::text, 4), 'no development'), COALESCE(site_address_key, 'no key'), COALESCE(site_address, 'no address'))
   FROM public.agreements_on_file WHERE id LIKE '%:00000000-0000-0000-0000-000004390113'),
  'no development | no key | no address');
SELECT psb.same('the list filters by a site in one read',
  (SELECT count(*)::text FROM public.agreements_on_file WHERE site_address_key = '300 example court springfield'), '1');

DO $$ BEGIN RAISE NOTICE 'paper_site PASSED'; END $$;
ROLLBACK;
