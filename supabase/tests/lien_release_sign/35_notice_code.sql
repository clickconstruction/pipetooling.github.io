-- His signing code signs a lien NOTICE in his full name (v2.7395, migration *_lien_notice_code_full_name).
-- sign_lien_desk_item_with_code stamped the short users.name on the paper; it now names a leader by his "Full name
-- and title" up to the first comma, as the waiver's checker does, and a dev by his account name. The two messages
-- that name him keep the short name. The fixture is made as postgres; the presses run as the signed-in user;
-- everything rolls back. Raises on the first failed assertion; ends with "lien_notice_code PASSED".
-- See scripts/pgtest-lien-release-sign.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: Malachi (a leader with a title line and a code), Rosa (the office), Dee (a dev with licence notes and a
-- code), Quinn (a leader with no title line and a code) and Sam (a leader with a title line and no code).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000f7a01', 'malachi@notice.test'),
  ('00000000-0000-0000-0000-0000000f7a02', 'rosa@notice.test'),
  ('00000000-0000-0000-0000-0000000f7a03', 'dee@notice.test'),
  ('00000000-0000-0000-0000-0000000f7a04', 'quinn@notice.test'),
  ('00000000-0000-0000-0000-0000000f7a05', 'sam@notice.test');
INSERT INTO public.users (id, email, name, notes, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000f7a01', 'malachi@notice.test', 'Malachi', 'Malachi Whites, Master Plumber (#RMP41130)', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f7a02', 'rosa@notice.test', 'Rosa', NULL, 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000f7a03', 'dee@notice.test', 'Notice Dee', 'PLUM APP: 184614, A/C TEC: 160601', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000f7a04', 'quinn@notice.test', 'Quinn Ortiz', NULL, 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000f7a05', 'sam@notice.test', 'Sam', 'Sam Rivera, Journeyman Plumber', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, notes = EXCLUDED.notes, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Codes stored the way set_lien_sign_code stores them: a salt and the sha256 of salt and code.
INSERT INTO public.user_sign_codes (user_id, code_hash, code_salt) VALUES
  ('00000000-0000-0000-0000-0000000f7a01', encode(sha256(convert_to('bed-salt' || '2468', 'UTF8')), 'hex'), 'bed-salt'),
  ('00000000-0000-0000-0000-0000000f7a03', encode(sha256(convert_to('bed-salt' || '1357', 'UTF8')), 'hex'), 'bed-salt'),
  ('00000000-0000-0000-0000-0000000f7a04', encode(sha256(convert_to('bed-salt' || '9753', 'UTF8')), 'hex'), 'bed-salt');

-- Five jobs, each with one notice awaiting approval (job_lien_desk_items_live_uniq: one live item per job and kind).
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000f7b09', 'Notice Plumbing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, customer_name, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000f7b01', '00000000-0000-0000-0000-0000000f7a01', '00000000-0000-0000-0000-0000000f7b09', '87901', 'ZZ Test Notice Job 1', 'ZZ Test GC', 'gc', 38625, 34825, 'billed'),
  ('00000000-0000-0000-0000-0000000f7b02', '00000000-0000-0000-0000-0000000f7a01', '00000000-0000-0000-0000-0000000f7b09', '87902', 'ZZ Test Notice Job 2', 'ZZ Test GC', 'gc', 38625, 34825, 'billed'),
  ('00000000-0000-0000-0000-0000000f7b03', '00000000-0000-0000-0000-0000000f7a04', '00000000-0000-0000-0000-0000000f7b09', '87903', 'ZZ Test Notice Job 3', 'ZZ Test GC', 'gc', 38625, 34825, 'billed'),
  ('00000000-0000-0000-0000-0000000f7b04', '00000000-0000-0000-0000-0000000f7a05', '00000000-0000-0000-0000-0000000f7b09', '87904', 'ZZ Test Notice Job 4', 'ZZ Test GC', 'gc', 38625, 34825, 'billed'),
  ('00000000-0000-0000-0000-0000000f7b05', '00000000-0000-0000-0000-0000000f7a01', '00000000-0000-0000-0000-0000000f7b09', '87905', 'ZZ Test Notice Job 5', 'ZZ Test GC', 'gc', 38625, 34825, 'billed');
INSERT INTO public.job_lien_desk_items (id, job_id, kind, months, status, drafted_by, submitted_at) VALUES
  ('00000000-0000-0000-0000-0000000f7c01', '00000000-0000-0000-0000-0000000f7b01', 'notice_53_056', '{2026-08}', 'awaiting_approval', '00000000-0000-0000-0000-0000000f7a02', now()),
  ('00000000-0000-0000-0000-0000000f7c02', '00000000-0000-0000-0000-0000000f7b02', 'notice_53_056', '{2026-08}', 'awaiting_approval', '00000000-0000-0000-0000-0000000f7a02', now()),
  ('00000000-0000-0000-0000-0000000f7c03', '00000000-0000-0000-0000-0000000f7b03', 'notice_53_056', '{2026-08}', 'awaiting_approval', '00000000-0000-0000-0000-0000000f7a02', now()),
  ('00000000-0000-0000-0000-0000000f7c04', '00000000-0000-0000-0000-0000000f7b04', 'notice_53_056', '{2026-08}', 'awaiting_approval', '00000000-0000-0000-0000-0000000f7a02', now()),
  ('00000000-0000-0000-0000-0000000f7c05', '00000000-0000-0000-0000-0000000f7b05', 'notice_53_056', '{2026-08}', 'awaiting_approval', '00000000-0000-0000-0000-0000000f7a02', now());

CREATE SCHEMA lnc;
CREATE FUNCTION lnc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION lnc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- One press with his code, as words: "ok <printed name>", or the reason and the message.
CREATE FUNCTION lnc.sign(p_item uuid, p_signer uuid, p_code text, p_approve boolean) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  r jsonb;
BEGIN
  r := public.sign_lien_desk_item_with_code(p_item, p_signer, p_code, 'bed-hash', p_approve);
  IF (r ->> 'ok')::boolean THEN RETURN 'ok ' || (r ->> 'printed_name'); END IF;
  RETURN (r ->> 'reason') || ': ' || (r ->> 'message');
END $$;
GRANT USAGE ON SCHEMA lnc TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lnc TO anon, authenticated, service_role;
-- A notice's signature as words, read as postgres: status, how it was approved, mode, the name the mark prints,
-- the signer's short name and whose screen.
CREATE FUNCTION lnc.row_of(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT i.status || ' / ' || coalesce(i.approval_mode, '-') || ' / ' || coalesce(i.signer_signature_mode, '-') || ' / ' || coalesce(i.signer_printed_name, '-')
    || ' / signer ' || coalesce((SELECT u.name FROM public.users u WHERE u.id = i.signed_by), '-')
    || ' / on ' || CASE WHEN i.signed_at IS NULL THEN '-'
         ELSE coalesce((SELECT u.name FROM public.users u WHERE u.id = i.signed_on_device_of), 'his own screen') END
  FROM public.job_lien_desk_items i WHERE i.id = p
$$;

-- 1 · At Rosa's screen: a wrong code names him by the short name, then his code signs in his full name.
SELECT lnc.as_user('00000000-0000-0000-0000-0000000f7a02');
SET LOCAL ROLE authenticated;
SELECT lnc.same('a wrong code is told by the short name',
  lnc.sign('00000000-0000-0000-0000-0000000f7c01', '00000000-0000-0000-0000-0000000f7a01', '1111', true), 'wrong: That is not Malachi''s code.');
SELECT lnc.same('his code signs and approves it in his full name',
  lnc.sign('00000000-0000-0000-0000-0000000f7c01', '00000000-0000-0000-0000-0000000f7a01', '2468', true), 'ok Malachi Whites');
SELECT lnc.same('a dev signs by his account name, not his licence notes',
  lnc.sign('00000000-0000-0000-0000-0000000f7c02', '00000000-0000-0000-0000-0000000f7a03', '1357', true), 'ok Notice Dee');
SELECT lnc.same('a leader with no title line signs by his account name',
  lnc.sign('00000000-0000-0000-0000-0000000f7c03', '00000000-0000-0000-0000-0000000f7a04', '9753', true), 'ok Quinn Ortiz');
SELECT lnc.same('a leader with no code set is told so, by the short name',
  lnc.sign('00000000-0000-0000-0000-0000000f7c04', '00000000-0000-0000-0000-0000000f7a05', '2468', true),
  'none: Sam has not set a signing code yet. He sets it under Settings, Your account.');
RESET ROLE;
SELECT lnc.same('the row is his full name in mode code, approved as his own act, on Rosa''s screen',
  lnc.row_of('00000000-0000-0000-0000-0000000f7c01'), 'approved / leader / code / Malachi Whites / signer Malachi / on Rosa');
SELECT lnc.same('the dev''s row carries his account name',
  lnc.row_of('00000000-0000-0000-0000-0000000f7c02'), 'approved / leader / code / Notice Dee / signer Notice Dee / on Rosa');
SELECT lnc.same('the notice with no code set is still waiting',
  lnc.row_of('00000000-0000-0000-0000-0000000f7c04'), 'awaiting_approval / - / - / - / signer - / on -');

-- 2 · At his own screen, signing only: the status is left alone and no other screen is named.
SELECT lnc.as_user('00000000-0000-0000-0000-0000000f7a01');
SET LOCAL ROLE authenticated;
SELECT lnc.same('he signs without approving at his own desk',
  lnc.sign('00000000-0000-0000-0000-0000000f7c05', '00000000-0000-0000-0000-0000000f7a01', '2468', false), 'ok Malachi Whites');
RESET ROLE;
SELECT lnc.same('his own screen names no device and the notice still awaits approval',
  lnc.row_of('00000000-0000-0000-0000-0000000f7c05'), 'awaiting_approval / - / code / Malachi Whites / signer Malachi / on his own screen');

-- 3 · As shipped: the function is open to the signed-in only, as 20261023150000 left it.
SELECT lnc.same('who runs it', (
  has_function_privilege('anon', 'public.sign_lien_desk_item_with_code(uuid, uuid, text, text, boolean)', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.sign_lien_desk_item_with_code(uuid, uuid, text, text, boolean)', 'EXECUTE')::text),
  'false/true');

DO $$ BEGIN RAISE NOTICE 'lien_notice_code PASSED'; END $$;
ROLLBACK;
