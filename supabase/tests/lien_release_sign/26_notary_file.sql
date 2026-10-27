-- The notarized PDF itself (v2.5985, migration *_lien_release_notary_copy_file): a waiver held out for a notary is
-- signed by the PDF that came back, stored in the release's own folder of the private lien-release-documents bucket,
-- and a waiver already signed by its Drive link takes the file too. The office writes both through its own policies;
-- a field user's write lands on nothing; the CHECK holds the path to a PDF directly in the release's own folder, on a
-- waiver signed before a notary. The upload is played against the bucket's documented out-of-band policies
-- (docs/migrations/20260902001517_lien_release_signing_foundation.md, made here inside the transaction): the object
-- path the window names is one they admit for the job's master and refuse for a master off the job. The fixture is made
-- as postgres; the presses run through RLS; everything rolls back. Raises on the first failed assertion; ends with
-- "lien_release_notary_file PASSED". See scripts/pgtest-lien-release-sign.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: Malachi (the job's master), Rosa (the office), Dale (a master off the job) and Luis (a primary).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000f8a01', 'malachi@notaryfile.test'),
  ('00000000-0000-0000-0000-0000000f8a02', 'rosa@notaryfile.test'),
  ('00000000-0000-0000-0000-0000000f8a03', 'dale@notaryfile.test'),
  ('00000000-0000-0000-0000-0000000f8a04', 'luis@notaryfile.test');
INSERT INTO public.users (id, email, name, notes, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000f8a01', 'malachi@notaryfile.test', 'Malachi W', 'Malachi Whites, Master Plumber', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f8a02', 'rosa@notaryfile.test', 'Rosa', NULL, 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000f8a03', 'dale@notaryfile.test', 'Dale', NULL, 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f8a04', 'luis@notaryfile.test', 'Luis', NULL, 'primary', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, notes = EXCLUDED.notes, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Take 5 Seguin with three waivers: one held out for the notary, one signed by its Drive link, one signed by his code.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000f8b09', 'Notary File Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000f8b01', '00000000-0000-0000-0000-0000000f8a01', '00000000-0000-0000-0000-0000000f8b09', '878', 'Take 5- Seguin', 'Southern Post', 'gc', 38625, 34825, 'billed');
INSERT INTO public.job_lien_releases (id, job_id, form_type, amount, status, created_by, notary_printed_at, signed_at, signer_printed_name, signer_signature_mode, signer_user_id, notary_copy_url) VALUES
  ('00000000-0000-0000-0000-0000000f8c01', '00000000-0000-0000-0000-0000000f8b01', 'conditional_final', 3800, 'out_for_notary', '00000000-0000-0000-0000-0000000f8a02', now(), NULL, NULL, NULL, '00000000-0000-0000-0000-0000000f8a01', NULL),
  ('00000000-0000-0000-0000-0000000f8c02', '00000000-0000-0000-0000-0000000f8b01', 'unconditional_progress', 34825, 'signed', '00000000-0000-0000-0000-0000000f8a02', now(), now(), 'Malachi Whites', 'notary_paper', '00000000-0000-0000-0000-0000000f8a01', 'https://drive.google.com/file/d/notarized-878/view'),
  ('00000000-0000-0000-0000-0000000f8c03', '00000000-0000-0000-0000-0000000f8b01', 'conditional_progress', 1200, 'signed', '00000000-0000-0000-0000-0000000f8a02', NULL, now(), 'Malachi Whites', 'code', '00000000-0000-0000-0000-0000000f8a01', NULL);

CREATE SCHEMA lrf;
CREATE FUNCTION lrf.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lrf.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION lrf.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA lrf TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lrf TO anon, authenticated, service_role;

-- The bucket and the two policies an upload meets, as documented (prod made them out of band; this bed has neither).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('lien-release-documents', 'lien-release-documents', false, 5242880, array['image/png', 'application/pdf'])
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY lien_release_docs_office_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lien-release-documents' AND (public.is_dev() OR public.is_assistant() OR EXISTS (
    SELECT 1 FROM public.job_lien_releases r JOIN public.jobs_ledger jl ON jl.id = r.job_id
    WHERE (storage.foldername(name))[1] = r.id::text AND jl.master_user_id = auth.uid())));
CREATE POLICY lien_release_docs_office_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lien-release-documents' AND (public.is_dev() OR public.is_assistant() OR EXISTS (
    SELECT 1 FROM public.job_lien_releases r JOIN public.jobs_ledger jl ON jl.id = r.job_id
    WHERE (storage.foldername(name))[1] = r.id::text AND jl.master_user_id = auth.uid())));

-- 1 · Malachi stores the PDF in the held waiver's own folder, under the name the window gives it; Dale, a master off
--     the job, stores nothing there.
SELECT lrf.as_user('00000000-0000-0000-0000-0000000f8a01');
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name) VALUES ('lien-release-documents', '00000000-0000-0000-0000-0000000f8c01/notary-copy-1793116800000.pdf');
SELECT lrf.same('the job''s master stores the PDF in the waiver''s own folder',
  (SELECT count(*)::text FROM storage.objects WHERE name = '00000000-0000-0000-0000-0000000f8c01/notary-copy-1793116800000.pdf'), '1');
RESET ROLE;
SELECT lrf.as_user('00000000-0000-0000-0000-0000000f8a03');
SET LOCAL ROLE authenticated;
SELECT lrf.refused('a master off the job stores nothing in its folder',
  $q$INSERT INTO storage.objects (bucket_id, name) VALUES ('lien-release-documents', '00000000-0000-0000-0000-0000000f8c01/notary-copy-1793116800001.pdf')$q$,
  'row-level security');
RESET ROLE;

-- 2 · The PDF signs the held waiver before a notary, through the office's own policy, with no link.
SELECT lrf.as_user('00000000-0000-0000-0000-0000000f8a01');
SET LOCAL ROLE authenticated;
UPDATE public.job_lien_releases
   SET notary_copy_path = '00000000-0000-0000-0000-0000000f8c01/notary-copy-1793116800000.pdf', status = 'signed', signed_at = now(),
       signer_printed_name = 'Malachi Whites', signer_signature_mode = 'notary_paper', signer_signature_storage_path = NULL,
       signer_user_id = '00000000-0000-0000-0000-0000000f8a01'
 WHERE id = '00000000-0000-0000-0000-0000000f8c01' AND status = 'out_for_notary';
SELECT lrf.same('the PDF signs the held waiver before a notary',
  (SELECT status || ' / ' || signer_signature_mode || ' / ' || notary_copy_path || ' / ' || coalesce(notary_copy_url, 'no link') FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f8c01'),
  'signed / notary_paper / 00000000-0000-0000-0000-0000000f8c01/notary-copy-1793116800000.pdf / no link');
RESET ROLE;

-- 3 · Rosa files the PDF on the waiver signed by its Drive link: only the path moves, the link stays.
SELECT lrf.as_user('00000000-0000-0000-0000-0000000f8a02');
SET LOCAL ROLE authenticated;
UPDATE public.job_lien_releases SET notary_copy_path = '00000000-0000-0000-0000-0000000f8c02/notary-copy-1793116800002.pdf'
 WHERE id = '00000000-0000-0000-0000-0000000f8c02' AND status = 'signed' AND signer_signature_mode = 'notary_paper';
SELECT lrf.same('a waiver signed by its link takes the PDF too',
  (SELECT status || ' / ' || notary_copy_path || ' / ' || notary_copy_url FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f8c02'),
  'signed / 00000000-0000-0000-0000-0000000f8c02/notary-copy-1793116800002.pdf / https://drive.google.com/file/d/notarized-878/view');

-- 4 · The CHECK holds everything else out: another waiver's folder, a file that is not a PDF, a folder deeper, and a
--     waiver his code signed.
SELECT lrf.refused('a path in another waiver''s folder',
  $q$UPDATE public.job_lien_releases SET notary_copy_path = '00000000-0000-0000-0000-0000000f8c01/notary-copy-1.pdf' WHERE id = '00000000-0000-0000-0000-0000000f8c02'$q$,
  'job_lien_releases_notary_copy_path_check');
SELECT lrf.refused('a file that is not a PDF',
  $q$UPDATE public.job_lien_releases SET notary_copy_path = '00000000-0000-0000-0000-0000000f8c02/notary-copy-1.png' WHERE id = '00000000-0000-0000-0000-0000000f8c02'$q$,
  'job_lien_releases_notary_copy_path_check');
SELECT lrf.refused('a path a folder deeper',
  $q$UPDATE public.job_lien_releases SET notary_copy_path = '00000000-0000-0000-0000-0000000f8c02/x/notary-copy-1.pdf' WHERE id = '00000000-0000-0000-0000-0000000f8c02'$q$,
  'job_lien_releases_notary_copy_path_check');
SELECT lrf.refused('a waiver his code signed carries no notarized copy',
  $q$UPDATE public.job_lien_releases SET notary_copy_path = '00000000-0000-0000-0000-0000000f8c03/notary-copy-1.pdf' WHERE id = '00000000-0000-0000-0000-0000000f8c03'$q$,
  'job_lien_releases_notary_copy_path_check');
RESET ROLE;

-- 5 · Luis, a field user, writes nothing on the job's waivers: his update finds no row.
SELECT lrf.as_user('00000000-0000-0000-0000-0000000f8a04');
SET LOCAL ROLE authenticated;
UPDATE public.job_lien_releases SET notary_copy_path = NULL WHERE id = '00000000-0000-0000-0000-0000000f8c02';
RESET ROLE;
SELECT lrf.same('a field user changes nothing',
  (SELECT notary_copy_path FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f8c02'),
  '00000000-0000-0000-0000-0000000f8c02/notary-copy-1793116800002.pdf');

-- 6 · The job's feed reads the PDF's signature, by the waiver's name for him.
SELECT lrf.same('the job''s feed reads the notary signature',
  (SELECT summary FROM public.job_activity_events WHERE event_type = 'lien_release_signed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000f8c01'),
  'Release of lien signed by Malachi Whites');

DO $$ BEGIN RAISE NOTICE 'lien_release_notary_file PASSED'; END $$;
ROLLBACK;
