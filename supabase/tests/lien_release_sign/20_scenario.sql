-- His signing code signs a Release of Lien (the waiver signing train, v2.5924, migration *_lien_release_sign_code):
-- the office has the waiver open at its own screen, the leader types his code, and the database checks it and stamps
-- the row signed in mode 'code', naming whose screen. A wrong code counts down and five lock it; a draft, a voided or
-- a signed waiver, a signer who is not a leader, training mode and a field user are refused; the checker stays
-- closed to clients. The fixture is made as postgres; the presses run through RLS; everything rolls back.
-- Raises on the first failed assertion; ends with "lien_release_sign PASSED". See scripts/pgtest-lien-release-sign.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: Malachi (the leader, with a code), Rosa (the office), a dev in training mode, Luis (a primary) and Dee (a
-- dev who has set no code).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000f5a01', 'malachi@release.test'),
  ('00000000-0000-0000-0000-0000000f5a02', 'rosa@release.test'),
  ('00000000-0000-0000-0000-0000000f5a03', 'trainee@release.test'),
  ('00000000-0000-0000-0000-0000000f5a04', 'luis@release.test'),
  ('00000000-0000-0000-0000-0000000f5a05', 'dee@release.test');
-- Malachi's users.name is short; the waiver names a leader by his notes before the comma (v2.5231).
INSERT INTO public.users (id, email, name, notes, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000f5a01', 'malachi@release.test', 'Malachi W', 'Malachi Whites, Master Plumber', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f5a02', 'rosa@release.test', 'Rosa', NULL, 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000f5a03', 'trainee@release.test', 'Release Trainee', NULL, 'dev', true, false),
  ('00000000-0000-0000-0000-0000000f5a04', 'luis@release.test', 'Release Luis', NULL, 'primary', false, false),
  ('00000000-0000-0000-0000-0000000f5a05', 'dee@release.test', 'Release Dee', 'PLUM APP: 184614, A/C TEC: 160601', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, notes = EXCLUDED.notes, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Malachi's code is 2468, stored the way set_lien_sign_code stores it: a salt and the sha256 of salt and code.
INSERT INTO public.user_sign_codes (user_id, code_hash, code_salt) VALUES
  ('00000000-0000-0000-0000-0000000f5a01', encode(sha256(convert_to('bed-salt' || '2468', 'UTF8')), 'hex'), 'bed-salt');

-- Take 5 Seguin and five waivers: one issued (signed at Rosa's screen), one awaiting his signature (signed at his
-- own), one voided, one still a draft, and one for the lock.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000f5b09', 'Release Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000f5b01', '00000000-0000-0000-0000-0000000f5a01', '00000000-0000-0000-0000-0000000f5b09', '878', 'Take 5- Seguin', 'Southern Post', 'gc', 38625, 34825, 'billed');
INSERT INTO public.job_lien_releases (id, job_id, form_type, amount, status, created_by, voided_at) VALUES
  ('00000000-0000-0000-0000-0000000f5c01', '00000000-0000-0000-0000-0000000f5b01', 'unconditional_progress', 3800, 'issued', '00000000-0000-0000-0000-0000000f5a02', NULL),
  ('00000000-0000-0000-0000-0000000f5c02', '00000000-0000-0000-0000-0000000f5b01', 'conditional_progress', 3800, 'awaiting_signature', '00000000-0000-0000-0000-0000000f5a02', NULL),
  ('00000000-0000-0000-0000-0000000f5c03', '00000000-0000-0000-0000-0000000f5b01', 'unconditional_final', 3800, 'issued', '00000000-0000-0000-0000-0000000f5a02', now()),
  ('00000000-0000-0000-0000-0000000f5c04', '00000000-0000-0000-0000-0000000f5b01', 'conditional_final', 3800, 'draft', '00000000-0000-0000-0000-0000000f5a02', NULL),
  ('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5b01', 'unconditional_progress', 3800, 'issued', '00000000-0000-0000-0000-0000000f5a02', NULL);

CREATE SCHEMA lrs;
CREATE FUNCTION lrs.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION lrs.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION lrs.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- One press of Sign it with his code, as words: "ok <printed name>", the reason with the tries left, or the
-- message of a refusal or a missing code.
CREATE FUNCTION lrs.sign(p_release uuid, p_signer uuid, p_code text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r jsonb;
BEGIN
  r := public.sign_lien_release_with_code(p_release, p_signer, p_code);
  IF (r ->> 'ok')::boolean THEN RETURN 'ok ' || (r ->> 'printed_name'); END IF;
  IF r ->> 'reason' IN ('error', 'none') THEN RETURN (r ->> 'reason') || ': ' || (r ->> 'message'); END IF;
  RETURN (r ->> 'reason') || coalesce(' ' || (r ->> 'tries_left'), '');
END $$;
GRANT USAGE ON SCHEMA lrs TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lrs TO anon, authenticated, service_role;
-- A waiver's signature as words, read as postgres: status, mode, printed name, the signer and whose screen.
CREATE FUNCTION lrs.row_of(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT r.status || ' / ' || coalesce(r.signer_signature_mode, '-') || ' / ' || coalesce(r.signer_printed_name, '-')
    || ' / signer ' || coalesce((SELECT u.name FROM public.users u WHERE u.id = r.signer_user_id), '-')
    || ' / on ' || CASE WHEN r.signed_at IS NULL THEN '-'
         ELSE coalesce((SELECT u.name FROM public.users u WHERE u.id = r.signed_on_device_of), 'his own screen') END
    || ' / consented ' || (r.signer_consented_at IS NOT NULL)::text
  FROM public.job_lien_releases r WHERE r.id = p
$$;

-- 1 · At Rosa's screen: a code too short, a wrong one counting down, then his code signs it as his own act.
SELECT lrs.as_user('00000000-0000-0000-0000-0000000f5a02');
SET LOCAL ROLE authenticated;
SELECT lrs.same('a code too short is refused and counts no try',
  lrs.sign('00000000-0000-0000-0000-0000000f5c01', '00000000-0000-0000-0000-0000000f5a01', '12'), 'format');
SELECT lrs.same('a wrong code counts down',
  lrs.sign('00000000-0000-0000-0000-0000000f5c01', '00000000-0000-0000-0000-0000000f5a01', '1111'), 'wrong 4');
SELECT lrs.same('his code signs it, in the name the waiver gives him',
  lrs.sign('00000000-0000-0000-0000-0000000f5c01', '00000000-0000-0000-0000-0000000f5a01', '2468'), 'ok Malachi Whites');
SELECT lrs.same('the office reads it signed through its own policy',
  (SELECT status FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-0000000f5c01'), 'signed');
RESET ROLE;
SELECT lrs.same('the row is his signature in mode code, on Rosa''s screen',
  lrs.row_of('00000000-0000-0000-0000-0000000f5c01'), 'signed / code / Malachi Whites / signer Malachi W / on Rosa / consented true');
SELECT lrs.same('the right code clears the count and stamps its use',
  (SELECT failed_tries::text || ' ' || (last_used_at IS NOT NULL)::text FROM public.user_sign_codes WHERE user_id = '00000000-0000-0000-0000-0000000f5a01'), '0 true');
SELECT lrs.same('the job''s activity reads the signature once',
  (SELECT count(*)::text FROM public.job_activity_events WHERE event_type = 'lien_release_signed' AND detail ->> 'source_id' = '00000000-0000-0000-0000-0000000f5c01'), '1');

-- 2 · What is not waiting for a signature, and who is not a signer.
SELECT lrs.as_user('00000000-0000-0000-0000-0000000f5a02');
SET LOCAL ROLE authenticated;
SELECT lrs.same('a signed waiver is not signed twice',
  lrs.sign('00000000-0000-0000-0000-0000000f5c01', '00000000-0000-0000-0000-0000000f5a01', '2468'), 'error: This waiver is not waiting for a signature.');
SELECT lrs.same('a voided waiver is not signed',
  lrs.sign('00000000-0000-0000-0000-0000000f5c03', '00000000-0000-0000-0000-0000000f5a01', '2468'), 'error: This waiver was voided. Make a new one.');
SELECT lrs.same('a draft is not signed',
  lrs.sign('00000000-0000-0000-0000-0000000f5c04', '00000000-0000-0000-0000-0000000f5a01', '2468'), 'error: This waiver is not waiting for a signature.');
SELECT lrs.same('a dev with no code set is told so, by his name and not his license notes',
  lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a05', '2468'),
  'none: Release Dee has not set a signing code yet. He sets it under Settings, Your account.');
SELECT lrs.refused('the office cannot sign as itself',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a02', '2468')$q$,
  'only a master or dev signs a release of lien');
SELECT lrs.refused('a release that is not there',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f5c99', '00000000-0000-0000-0000-0000000f5a01', '2468')$q$,
  'release not found');
RESET ROLE;

-- 3 · At his own screen: no other screen is named.
SELECT lrs.as_user('00000000-0000-0000-0000-0000000f5a01');
SET LOCAL ROLE authenticated;
SELECT lrs.same('he signs a waiver awaiting him at his own desk',
  lrs.sign('00000000-0000-0000-0000-0000000f5c02', '00000000-0000-0000-0000-0000000f5a01', '2468'), 'ok Malachi Whites');
RESET ROLE;
SELECT lrs.same('his own screen names no device',
  lrs.row_of('00000000-0000-0000-0000-0000000f5c02'), 'signed / code / Malachi Whites / signer Malachi W / on his own screen / consented true');

-- 4 · Training mode and the field are refused before any code is read.
SELECT lrs.as_user('00000000-0000-0000-0000-0000000f5a03');
SET LOCAL ROLE authenticated;
SELECT lrs.refused('training mode signs nothing',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '2468')$q$,
  'training mode: nothing is signed');
RESET ROLE;
SELECT lrs.as_user('00000000-0000-0000-0000-0000000f5a04');
SET LOCAL ROLE authenticated;
SELECT lrs.refused('a primary does not open a release for signing',
  $q$SELECT public.sign_lien_release_with_code('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '2468')$q$,
  'only the office or a leader opens a release for signing');
RESET ROLE;

-- 5 · Five wrong codes lock it, and then even his code waits.
SELECT lrs.as_user('00000000-0000-0000-0000-0000000f5a02');
SET LOCAL ROLE authenticated;
SELECT lrs.same('the first wrong code', lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '1111'), 'wrong 4');
SELECT lrs.same('the second wrong code', lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '1112'), 'wrong 3');
SELECT lrs.same('the third wrong code', lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '1113'), 'wrong 2');
SELECT lrs.same('the fourth wrong code', lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '1114'), 'wrong 1');
SELECT lrs.same('the fifth wrong code locks it', lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '1115'), 'locked 0');
SELECT lrs.same('a locked code does not sign, even right',
  lrs.sign('00000000-0000-0000-0000-0000000f5c05', '00000000-0000-0000-0000-0000000f5a01', '2468'), 'locked');
RESET ROLE;
SELECT lrs.same('the locked waiver is still waiting',
  lrs.row_of('00000000-0000-0000-0000-0000000f5c05'), 'issued / - / - / signer - / on - / consented false');

-- 6 · As shipped: the checker is closed to every client, the signing function open to the signed-in only.
SELECT lrs.same('who runs what', (
  has_function_privilege('anon', 'public.check_lien_sign_code(uuid, text)', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.check_lien_sign_code(uuid, text)', 'EXECUTE')::text || '/'
    || has_function_privilege('anon', 'public.sign_lien_release_with_code(uuid, uuid, text)', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.sign_lien_release_with_code(uuid, uuid, text)', 'EXECUTE')::text),
  'false/false/false/true');
SELECT lrs.same('the mode CHECK admits code',
  (SELECT (position('''code''' IN pg_get_constraintdef(oid)) > 0)::text FROM pg_constraint WHERE conname = 'job_lien_releases_signature_mode_check'), 'true');

DO $$ BEGIN RAISE NOTICE 'lien_release_sign PASSED'; END $$;
ROLLBACK;
