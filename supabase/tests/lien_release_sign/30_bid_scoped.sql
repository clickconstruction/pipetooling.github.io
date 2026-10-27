-- A bid's waiver (the waiver signing train's PR C, v2.5958, migration *_lien_release_bid_scoped): Bids → Lien Release
-- records a waiver on the bid, and the leader standing at an estimator's screen signs it with his code. An estimator
-- reads, makes and updates a bid's waivers and never a job's; his waiver starts unsigned and keeps the paper it was made
-- with, but for the leader's code; the code signs it through sign_lien_release_with_code, which he may call on a bid's
-- waiver only; a twin and a trainee are refused; the office reads and signs a bid's waiver as before, a primary reads
-- none; the job's feed skips a bid's waiver and names the conditional final form as itself; a waiver has exactly one
-- home. The fixture is made as postgres; the presses run through RLS; everything rolls back.
-- Raises on the first failed assertion; ends with "lien_release_bid PASSED". See scripts/pgtest-lien-release-sign.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: Malachi (the leader, with a code), Wendi (an estimator), Rosa (the office), an estimator twin, an estimator in
-- training mode, and Luis (a primary).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000f6a01', 'malachi@bidwaiver.test'),
  ('00000000-0000-0000-0000-0000000f6a02', 'wendi@bidwaiver.test'),
  ('00000000-0000-0000-0000-0000000f6a03', 'rosa@bidwaiver.test'),
  ('00000000-0000-0000-0000-0000000f6a04', 'twin@bidwaiver.test'),
  ('00000000-0000-0000-0000-0000000f6a05', 'trainee@bidwaiver.test'),
  ('00000000-0000-0000-0000-0000000f6a06', 'luis@bidwaiver.test');
INSERT INTO public.users (id, email, name, notes, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000f6a01', 'malachi@bidwaiver.test', 'Malachi W', 'Malachi Whites, Master Plumber', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f6a02', 'wendi@bidwaiver.test', 'Wendi', NULL, 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000f6a03', 'rosa@bidwaiver.test', 'Rosa', NULL, 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000f6a04', 'twin@bidwaiver.test', 'Estimator Twin', NULL, 'estimator', false, true),
  ('00000000-0000-0000-0000-0000000f6a05', 'trainee@bidwaiver.test', 'Estimator Trainee', NULL, 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000f6a06', 'luis@bidwaiver.test', 'Luis', NULL, 'primary', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, notes = EXCLUDED.notes, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.user_sign_codes (user_id, code_hash, code_salt) VALUES
  ('00000000-0000-0000-0000-0000000f6a01', encode(sha256(convert_to('bed-salt' || '2468', 'UTF8')), 'hex'), 'bed-salt');

-- Take 5 Seguin as a bid (Wendi's), and as job 878 with a conditional final waiver of its own; one more waiver on the bid,
-- made by the office, waits for a code.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000f6b01', 'Bid waiver Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000f6c01', '00000000-0000-0000-0000-0000000f6a01', 'Southern Post');
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000f6d01', '00000000-0000-0000-0000-0000000f6a03', '00000000-0000-0000-0000-0000000f6a02', '00000000-0000-0000-0000-0000000f6b01', 'Take 5 Seguin', '00000000-0000-0000-0000-0000000f6c01');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000f6e01', '00000000-0000-0000-0000-0000000f6a01', '00000000-0000-0000-0000-0000000f6b01', '878', 'Take 5- Seguin', 'Southern Post', 'gc', 38625, 34825, 'billed');
INSERT INTO public.job_lien_releases (id, job_id, form_type, amount, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f6f01', '00000000-0000-0000-0000-0000000f6e01', 'conditional_final', 3800, 'issued', '00000000-0000-0000-0000-0000000f6a03');
INSERT INTO public.job_lien_releases (id, bid_id, form_type, amount, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f6f13', '00000000-0000-0000-0000-0000000f6d01', 'unconditional_final', 38625, 'issued', '00000000-0000-0000-0000-0000000f6a03');

CREATE SCHEMA lrb;
CREATE FUNCTION lrb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION lrb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads), or as no one for the fixture's own writes.
CREATE FUNCTION lrb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION lrb.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- One press of Sign it with his code, as words: "ok <printed name>", or the reason and its message.
CREATE FUNCTION lrb.sign(p_release uuid, p_signer uuid, p_code text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r jsonb;
BEGIN
  r := public.sign_lien_release_with_code(p_release, p_signer, p_code);
  IF (r ->> 'ok')::boolean THEN RETURN 'ok ' || (r ->> 'printed_name'); END IF;
  RETURN (r ->> 'reason') || ': ' || coalesce(r ->> 'message', '');
END $$;
GRANT USAGE ON SCHEMA lrb TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lrb TO anon, authenticated, service_role;

-- 1 · Wendi makes the bid's waivers and reads them, and nothing of the job's.
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a02');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_lien_releases (id, bid_id, job_id, form_type, amount, status, fields, minted_at, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f6f11', '00000000-0000-0000-0000-0000000f6d01', NULL, 'unconditional_progress', 34825, 'issued', '{"signerName": "Malachi Whites"}', now(), '00000000-0000-0000-0000-0000000f6a02'),
  ('00000000-0000-0000-0000-0000000f6f12', '00000000-0000-0000-0000-0000000f6d01', NULL, 'conditional_progress', 30400, 'issued', '{}', now(), '00000000-0000-0000-0000-0000000f6a02');
SELECT lrb.same('Wendi reads the bid''s waivers',
  (SELECT count(*)::text FROM public.job_lien_releases WHERE bid_id = '00000000-0000-0000-0000-0000000f6d01'), '3');
SELECT lrb.same('and no job''s', (SELECT count(*)::text FROM public.job_lien_releases WHERE job_id IS NOT NULL), '0');
SELECT lrb.refused('a job''s waiver is not hers to make',
  $q$INSERT INTO public.job_lien_releases (job_id, form_type, amount, status, created_by) VALUES ('00000000-0000-0000-0000-0000000f6e01', 'conditional_progress', 100, 'issued', '00000000-0000-0000-0000-0000000f6a02')$q$,
  'row-level security');
SELECT lrb.refused('a waiver made as someone else',
  $q$INSERT INTO public.job_lien_releases (bid_id, form_type, amount, status, created_by) VALUES ('00000000-0000-0000-0000-0000000f6d01', 'conditional_progress', 100, 'issued', '00000000-0000-0000-0000-0000000f6a03')$q$,
  'row-level security');
SELECT lrb.refused('a waiver signed from the start',
  $q$INSERT INTO public.job_lien_releases (bid_id, form_type, amount, status, signed_at, signer_user_id, signer_printed_name, signer_signature_mode, created_by) VALUES ('00000000-0000-0000-0000-0000000f6d01', 'unconditional_progress', 100, 'signed', now(), '00000000-0000-0000-0000-0000000f6a01', 'Malachi Whites', 'type', '00000000-0000-0000-0000-0000000f6a02')$q$,
  'A waiver made on a bid starts unsigned.');
SELECT lrb.refused('a signature written in by hand',
  $q$UPDATE public.job_lien_releases SET status = 'signed', signed_at = now(), signer_user_id = '00000000-0000-0000-0000-0000000f6a01', signer_printed_name = 'Malachi Whites', signer_signature_mode = 'type' WHERE id = '00000000-0000-0000-0000-0000000f6f11'$q$,
  'keeps the paper it was made with');
SELECT lrb.refused('the paper changed after it was made',
  $q$UPDATE public.job_lien_releases SET amount = 1 WHERE id = '00000000-0000-0000-0000-0000000f6f11'$q$,
  'keeps the paper it was made with');
SELECT lrb.refused('put on the job too',
  $q$UPDATE public.job_lien_releases SET job_id = '00000000-0000-0000-0000-0000000f6e01' WHERE id = '00000000-0000-0000-0000-0000000f6f12'$q$,
  'row-level security');
UPDATE public.job_lien_releases SET sent_to_customer_at = now(), sent_channel = 'manual', sent_by = '00000000-0000-0000-0000-0000000f6a02'
  WHERE id = '00000000-0000-0000-0000-0000000f6f12';
SELECT lrb.same('she stamps a print sent',
  (SELECT (sent_to_customer_at IS NOT NULL)::text FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f6f12'), 'true');
UPDATE public.job_lien_releases SET sent_to_customer_at = now() WHERE id = '00000000-0000-0000-0000-0000000f6f01';
RESET ROLE;
SELECT lrb.as_nobody();
SELECT lrb.same('the job''s waiver is not hers to touch',
  (SELECT (sent_to_customer_at IS NULL)::text FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f6f01'), 'true');

-- 2 · Malachi's code signs her waiver at her screen.
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a02');
SET LOCAL ROLE authenticated;
SELECT lrb.same('his code signs the bid''s waiver at Wendi''s screen',
  lrb.sign('00000000-0000-0000-0000-0000000f6f11', '00000000-0000-0000-0000-0000000f6a01', '2468'), 'ok Malachi Whites');
SELECT lrb.same('the signing setting is cleared after the stamp', coalesce(current_setting('lien.release_code_signing', true), ''), '');
UPDATE public.job_lien_releases SET signed_pdf_path = '00000000-0000-0000-0000-0000000f6f11/signed.pdf' WHERE id = '00000000-0000-0000-0000-0000000f6f11';
SELECT lrb.refused('nor unsigned again by hand',
  $q$UPDATE public.job_lien_releases SET status = 'issued' WHERE id = '00000000-0000-0000-0000-0000000f6f11'$q$,
  'keeps the paper it was made with');
SELECT lrb.refused('a job''s waiver is not opened from a bid seat',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f6f01', '00000000-0000-0000-0000-0000000f6a01', '2468')$q$,
  'only the office or a leader opens a release for signing');
RESET ROLE;
SELECT lrb.as_nobody();
SELECT lrb.same('the record: his code, his waiver name, her screen, the stored copy',
  (SELECT r.status || ' / ' || r.signer_signature_mode || ' / ' || r.signer_printed_name || ' / on ' || u.name || ' / ' || r.signed_pdf_path
     FROM public.job_lien_releases r JOIN public.users u ON u.id = r.signed_on_device_of
    WHERE r.id = '00000000-0000-0000-0000-0000000f6f11'),
  'signed / code / Malachi Whites / on Wendi / 00000000-0000-0000-0000-0000000f6f11/signed.pdf');
SELECT lrb.same('a bid''s waiver writes no job event',
  (SELECT count(*)::text FROM public.job_activity_events WHERE detail ->> 'source_id' LIKE '00000000-0000-0000-0000-0000000f6f1%' OR detail ->> 'release_id' LIKE '00000000-0000-0000-0000-0000000f6f1%'), '0');

-- 3 · A twin and a trainee are refused.
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a04');
SET LOCAL ROLE authenticated;
SELECT lrb.refused('a twin makes no waiver',
  $q$INSERT INTO public.job_lien_releases (bid_id, form_type, amount, status, created_by) VALUES ('00000000-0000-0000-0000-0000000f6d01', 'conditional_progress', 100, 'issued', '00000000-0000-0000-0000-0000000f6a04')$q$,
  'row-level security');
SELECT lrb.refused('nor opens one for a code',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f6f13', '00000000-0000-0000-0000-0000000f6a01', '2468')$q$,
  'only the office or a leader opens a release for signing');
RESET ROLE;
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a05');
SET LOCAL ROLE authenticated;
SELECT lrb.refused('training mode makes no waiver',
  $q$INSERT INTO public.job_lien_releases (bid_id, form_type, amount, status, created_by) VALUES ('00000000-0000-0000-0000-0000000f6d01', 'conditional_progress', 100, 'issued', '00000000-0000-0000-0000-0000000f6a05')$q$,
  'Read-only (training) mode');
SELECT lrb.refused('nor signs one',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f6f13', '00000000-0000-0000-0000-0000000f6a01', '2468')$q$,
  'training mode: nothing is signed');
RESET ROLE;

-- 4 · The office reads and signs a bid's waiver as before; a primary reads none.
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a03');
SET LOCAL ROLE authenticated;
SELECT lrb.same('the office reads the bid''s waivers',
  (SELECT count(*)::text FROM public.job_lien_releases WHERE bid_id = '00000000-0000-0000-0000-0000000f6d01'), '3');
SELECT lrb.same('and signs one with his code',
  lrb.sign('00000000-0000-0000-0000-0000000f6f13', '00000000-0000-0000-0000-0000000f6a01', '2468'), 'ok Malachi Whites');
RESET ROLE;
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a06');
SET LOCAL ROLE authenticated;
SELECT lrb.same('a primary reads no bid''s waiver',
  (SELECT count(*)::text FROM public.job_lien_releases WHERE bid_id = '00000000-0000-0000-0000-0000000f6d01'), '0');
SELECT lrb.refused('nor asks about anyone''s code',
  $q$SELECT public.lien_sign_code_status('00000000-0000-0000-0000-0000000f6a01')$q$,
  'only the office or a leader asks about a signing code');
RESET ROLE;

-- 5 · Wendi asks whether the leader has a code, and about no one else's.
SELECT lrb.as_user('00000000-0000-0000-0000-0000000f6a02');
SET LOCAL ROLE authenticated;
SELECT lrb.same('Wendi learns Malachi has a code', public.lien_sign_code_status('00000000-0000-0000-0000-0000000f6a01') ->> 'set', 'true');
SELECT lrb.refused('but not whether the office has one',
  $q$SELECT public.lien_sign_code_status('00000000-0000-0000-0000-0000000f6a03')$q$,
  'only the office or a leader asks about a signing code');
RESET ROLE;

-- 6 · A waiver has exactly one home, and the job's feed names the conditional final form as itself.
SELECT lrb.as_nobody();
SELECT lrb.refused('a waiver with no home',
  $q$INSERT INTO public.job_lien_releases (form_type, amount) VALUES ('conditional_progress', 1)$q$,
  'job_lien_releases_job_or_bid_check');
SELECT lrb.refused('a waiver with two',
  $q$INSERT INTO public.job_lien_releases (job_id, bid_id, form_type, amount) VALUES ('00000000-0000-0000-0000-0000000f6e01', '00000000-0000-0000-0000-0000000f6d01', 'conditional_progress', 1)$q$,
  'job_lien_releases_job_or_bid_check');
SELECT lrb.same('the job''s feed names the conditional final form',
  (SELECT summary FROM public.job_activity_events WHERE event_type = 'lien_release_issued' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000f6f01'),
  'Release of lien issued — Conditional · final $3,800.00');

DO $$ BEGIN RAISE NOTICE 'lien_release_bid PASSED'; END $$;
ROLLBACK;
