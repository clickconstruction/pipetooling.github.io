-- Print for a notary (the waiver signing train, v2.5925, migration *_lien_release_notary): the office prints a waiver
-- with the Texas jurat block and the row holds at out_for_notary; the stamped copy comes back and its Drive link signs
-- the row in mode notary_paper; a paper that never reached the notary steps back to issued. Both are writes the
-- Release of Lien window makes through the office's own policies, and the table's CHECKs must let them land. The
-- fixture is made as postgres; the presses run through RLS; everything rolls back. Raises on the first failed
-- assertion; ends with "lien_release_notary PASSED". See scripts/pgtest-lien-release-sign.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000f7a01', 'malachi@notary.test'),
  ('00000000-0000-0000-0000-0000000f7a02', 'rosa@notary.test');
INSERT INTO public.users (id, email, name, notes, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000f7a01', 'malachi@notary.test', 'Malachi W', 'Malachi Whites, Master Plumber', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f7a02', 'rosa@notary.test', 'Rosa', NULL, 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, notes = EXCLUDED.notes, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Take 5 Seguin with two issued waivers: one goes to the notary and comes back, one never reaches him.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000f7b09', 'Notary Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000f7b01', '00000000-0000-0000-0000-0000000f7a01', '00000000-0000-0000-0000-0000000f7b09', '878', 'Take 5- Seguin', 'Southern Post', 'gc', 38625, 34825, 'billed');
INSERT INTO public.job_lien_releases (id, job_id, form_type, amount, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f7c01', '00000000-0000-0000-0000-0000000f7b01', 'conditional_final', 3800, 'issued', '00000000-0000-0000-0000-0000000f7a02'),
  ('00000000-0000-0000-0000-0000000f7c02', '00000000-0000-0000-0000-0000000f7b01', 'unconditional_progress', 34825, 'issued', '00000000-0000-0000-0000-0000000f7a02');

CREATE SCHEMA lrn;
CREATE FUNCTION lrn.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lrn.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION lrn.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA lrn TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lrn TO anon, authenticated, service_role;

-- 1 · Rosa prints both for a notary: each holds at out_for_notary with the day it printed.
SELECT lrn.as_user('00000000-0000-0000-0000-0000000f7a02');
SET LOCAL ROLE authenticated;
UPDATE public.job_lien_releases SET status = 'out_for_notary', notary_printed_at = now()
  WHERE id IN ('00000000-0000-0000-0000-0000000f7c01', '00000000-0000-0000-0000-0000000f7c02') AND status IN ('issued', 'draft');
SELECT lrn.same('both hold out for the notary',
  (SELECT string_agg(status || ' ' || (notary_printed_at IS NOT NULL)::text, ', ' ORDER BY id) FROM public.job_lien_releases WHERE job_id = '00000000-0000-0000-0000-0000000f7b01'),
  'out_for_notary true, out_for_notary true');

-- 2 · The stamped copy comes back: its link signs the first in mode notary_paper.
UPDATE public.job_lien_releases
   SET notary_copy_url = 'https://drive.google.com/file/d/notarized-878/view', status = 'signed', signed_at = now(),
       signer_printed_name = 'Malachi Whites', signer_signature_mode = 'notary_paper', signer_signature_storage_path = NULL,
       signer_user_id = '00000000-0000-0000-0000-0000000f7a01'
 WHERE id = '00000000-0000-0000-0000-0000000f7c01' AND status = 'out_for_notary';
SELECT lrn.same('the copy''s link signs it before a notary',
  (SELECT status || ' / ' || signer_signature_mode || ' / ' || signer_printed_name || ' / ' || notary_copy_url FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f7c01'),
  'signed / notary_paper / Malachi Whites / https://drive.google.com/file/d/notarized-878/view');

-- 3 · The second never reached the notary: it steps back to issued for his ink or his code.
UPDATE public.job_lien_releases SET status = 'issued' WHERE id = '00000000-0000-0000-0000-0000000f7c02' AND status = 'out_for_notary';
SELECT lrn.same('a paper that never reached the notary steps back',
  (SELECT status FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f7c02'), 'issued');

-- 4 · The CHECKs still hold everything else out.
SELECT lrn.refused('a status the window never writes',
  $q$UPDATE public.job_lien_releases SET status = 'notarized' WHERE id = '00000000-0000-0000-0000-0000000f7c02'$q$,
  'job_lien_releases_status_check');
SELECT lrn.refused('a mode the window never writes',
  $q$UPDATE public.job_lien_releases SET signer_signature_mode = 'stamp' WHERE id = '00000000-0000-0000-0000-0000000f7c02'$q$,
  'job_lien_releases_signature_mode_check');
RESET ROLE;

-- 5 · The job's activity reads the signature, by the waiver's name for him.
SELECT lrn.same('the job''s feed reads the notary signature',
  (SELECT summary FROM public.job_activity_events WHERE event_type = 'lien_release_signed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000f7c01'),
  'Release of lien signed by Malachi Whites');

DO $$ BEGIN RAISE NOTICE 'lien_release_notary PASSED'; END $$;
ROLLBACK;
