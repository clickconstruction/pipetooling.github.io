SET lock_timeout = '3s';

-- The leader's signing code reaches the Release of Lien window (v2.5924). v2.5788 gave a master a
-- 4-to-6-digit code (user_sign_codes) and v2.5791 let him sign a lien NOTICE on anyone's screen with
-- it; the fragment left the waiver window as the follow-up. This migration is that follow-up's
-- database side: one shared checker over user_sign_codes, and sign_lien_release_with_code — the
-- waiver twin of sign_lien_desk_item_with_code. The code is checked in the database and never
-- leaves it; five wrong tries lock it fifteen minutes (the same counter as the desk's — one code,
-- one lock); the right code stamps the job_lien_releases row signed in mode 'code', naming the
-- signer and whose screen he typed it on. The table's mode CHECK (v2.2616) admitted only 'type' and
-- 'draw', so it is widened to 'code' here, as the desk's was (v2.5788); there is no guard trigger,
-- so the RPC is the gate.

-- ---------- the mode CHECK admits 'code' ----------
ALTER TABLE public.job_lien_releases DROP CONSTRAINT IF EXISTS job_lien_releases_signature_mode_check;
ALTER TABLE public.job_lien_releases
  ADD CONSTRAINT job_lien_releases_signature_mode_check CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw', 'code'));

COMMENT ON COLUMN public.job_lien_releases.signer_signature_mode IS
  'Release of Lien signing: type = the signer placed his name in cursive under his own sign-in; draw = he drew it on the pad (his own screen or a present leader on another''s). Code (v2.5924): he typed his own signing code on the signed-in user''s screen (signed_on_device_of), and sign_lien_release_with_code checked it.';

-- ---------- the shared checker ----------
-- Verifies one code against user_sign_codes with the desk's exact lockout rules, and owns the
-- counter writes. Called only from SECURITY DEFINER signing functions; clients cannot execute it.
CREATE OR REPLACE FUNCTION public.check_lien_sign_code(p_signer_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signer_name text;
  v_row public.user_sign_codes%ROWTYPE;
  v_now timestamptz := now();
  v_tries integer;
  v_locked_until timestamptz;
BEGIN
  SELECT COALESCE(NULLIF(btrim(u.name), ''), u.email) INTO v_signer_name
    FROM public.users u WHERE u.id = p_signer_id AND u.archived_at IS NULL;
  IF v_signer_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'none', 'message', 'No such signer.');
  END IF;
  IF p_code !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'format', 'message', 'A signing code is 4 to 6 digits.');
  END IF;
  SELECT * INTO v_row FROM public.user_sign_codes WHERE user_id = p_signer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'none', 'message', v_signer_name || ' has not set a signing code yet. He sets it under Settings, Your account.');
  END IF;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_row.locked_until, 'message', 'Five wrong codes. The code is locked for a few minutes.');
  END IF;
  IF encode(sha256(convert_to(v_row.code_salt || p_code, 'UTF8')), 'hex') <> v_row.code_hash THEN
    v_tries := v_row.failed_tries + 1;
    v_locked_until := CASE WHEN v_tries >= 5 THEN v_now + interval '15 minutes' ELSE NULL END;
    UPDATE public.user_sign_codes SET failed_tries = v_tries, locked_until = v_locked_until WHERE user_id = p_signer_id;
    RETURN jsonb_build_object('ok', false, 'reason', CASE WHEN v_locked_until IS NULL THEN 'wrong' ELSE 'locked' END, 'tries_left', GREATEST(0, 5 - v_tries), 'locked_until', v_locked_until,
      'message', CASE WHEN v_locked_until IS NULL THEN 'That is not ' || v_signer_name || '''s code.' ELSE 'Five wrong codes. The code is locked for fifteen minutes.' END);
  END IF;
  UPDATE public.user_sign_codes SET failed_tries = 0, locked_until = NULL, last_used_at = v_now WHERE user_id = p_signer_id;
  RETURN jsonb_build_object('ok', true, 'printed_name', v_signer_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_lien_sign_code(uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------- the signature: his code on a waiver, on any screen ----------
-- The caller is the signed-in user at the screen (the office set or a leader); the signer is the
-- leader whose code it is. The right code stamps the release signed as the signer's own act, in
-- mode 'code', naming whose screen. The window's client stores the signed PDF afterward,
-- best-effort, exactly as the pad's path does — the row stamp is the signature of record.
CREATE OR REPLACE FUNCTION public.sign_lien_release_with_code(p_release_id uuid, p_signer_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_signer_role text;
  v_check jsonb;
  v_status text;
  v_voided timestamptz;
  v_now timestamptz := now();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'training mode: nothing is signed' USING ERRCODE = '42501';
  END IF;
  SELECT u.role INTO v_caller_role FROM public.users u WHERE u.id = v_caller;
  IF v_caller_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RAISE EXCEPTION 'only the office or a leader opens a release for signing' USING ERRCODE = '42501';
  END IF;
  SELECT u.role INTO v_signer_role FROM public.users u WHERE u.id = p_signer_id AND u.archived_at IS NULL;
  IF v_signer_role IS DISTINCT FROM 'dev' AND v_signer_role IS DISTINCT FROM 'master_technician' THEN
    RAISE EXCEPTION 'only a master or dev signs a release of lien' USING ERRCODE = '42501';
  END IF;
  SELECT r.status, r.voided_at INTO v_status, v_voided FROM public.job_lien_releases r WHERE r.id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'release not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_voided IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'error', 'message', 'This waiver was voided. Make a new one.');
  END IF;
  IF v_status NOT IN ('issued', 'awaiting_signature') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'error', 'message', 'This waiver is not waiting for a signature.');
  END IF;
  v_check := public.check_lien_sign_code(p_signer_id, p_code);
  IF NOT COALESCE((v_check ->> 'ok')::boolean, false) THEN
    RETURN v_check;
  END IF;
  UPDATE public.job_lien_releases
     SET status = 'signed',
         signed_at = v_now,
         signer_printed_name = v_check ->> 'printed_name',
         signer_signature_mode = 'code',
         signer_signature_storage_path = NULL,
         signer_consented_at = v_now,
         signer_user_id = p_signer_id,
         signed_on_device_of = CASE WHEN v_caller = p_signer_id THEN NULL ELSE v_caller END
   WHERE id = p_release_id;
  RETURN jsonb_build_object('ok', true, 'signed_at', v_now, 'printed_name', v_check ->> 'printed_name');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sign_lien_release_with_code(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_lien_release_with_code(uuid, uuid, text) TO authenticated;
