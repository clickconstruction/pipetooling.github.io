SET lock_timeout = '3s';

-- A lien notice signed with the leader's code carries his full name (v2.7395, Taunya's ask of 2026-11-15).
--
-- sign_lien_desk_item_with_code (v2.5788, 20261023150000) stamped signer_printed_name from users.name, the short
-- name the app talks in: "Malachi". The paper prints that name in the cursive face above the rule, over a line
-- that reads "Malachi Whites, Master Plumber (#RMP41130)". The waiver's checker (check_lien_sign_code, v2.5924,
-- 20261026193000) already names a leader by his "Full name and title" (users.notes) up to the first comma and a
-- dev by his account name; that migration's notes say the desk's function was left printing users.name. This is
-- that function with the waiver's rule, and nothing else changed:
--
--   * the printed name: a leader's notes before the first comma, else his account name, else his email; a dev's
--     account name, else his email (a dev's notes are licence numbers, not a title line);
--   * the two messages that name him (no code set, a wrong code) keep the short name they had.
--
-- No notice had been signed in the app when this was written, by code or any other way, so no row is rewritten.
-- CREATE OR REPLACE keeps the function's owner and its grants (authenticated only, 20261023150000).
CREATE OR REPLACE FUNCTION public.sign_lien_desk_item_with_code(p_item_id uuid, p_signer_id uuid, p_code text, p_fields_hash text, p_approve boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_signer_role text;
  v_signer_name text;
  v_signer_short text;
  v_row public.user_sign_codes%ROWTYPE;
  v_now timestamptz := now();
  v_tries integer;
  v_locked_until timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'training mode: nothing is signed' USING ERRCODE = '42501';
  END IF;
  SELECT u.role INTO v_caller_role FROM public.users u WHERE u.id = v_caller;
  IF v_caller_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RAISE EXCEPTION 'only the office or a leader opens a lien notice for signing' USING ERRCODE = '42501';
  END IF;
  -- v2.7395: the name the mark prints is his full name (the waiver's rule); the short one stays for the messages.
  SELECT u.role,
         COALESCE(NULLIF(btrim(u.name), ''), u.email),
         CASE WHEN u.role = 'dev' THEN COALESCE(NULLIF(btrim(u.name), ''), u.email)
              ELSE COALESCE(NULLIF(btrim(regexp_replace(COALESCE(NULLIF(btrim(u.notes), ''), NULLIF(btrim(u.name), ''), u.email), ',.*$', '')), ''), NULLIF(btrim(u.name), ''), u.email) END
    INTO v_signer_role, v_signer_short, v_signer_name
    FROM public.users u WHERE u.id = p_signer_id AND u.archived_at IS NULL;
  IF v_signer_role IS DISTINCT FROM 'dev' AND v_signer_role IS DISTINCT FROM 'master_technician' THEN
    RAISE EXCEPTION 'only a master or dev signs a lien notice' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.job_lien_desk_items i WHERE i.id = p_item_id) THEN
    RAISE EXCEPTION 'lien notice not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_code !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'format', 'message', 'A signing code is 4 to 6 digits.');
  END IF;
  SELECT * INTO v_row FROM public.user_sign_codes WHERE user_id = p_signer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'none', 'message', v_signer_short || ' has not set a signing code yet. He sets it under Settings, Your account.');
  END IF;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > v_now THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_row.locked_until, 'message', 'Five wrong codes. The code is locked for a few minutes.');
  END IF;
  IF encode(sha256(convert_to(v_row.code_salt || p_code, 'UTF8')), 'hex') <> v_row.code_hash THEN
    v_tries := v_row.failed_tries + 1;
    v_locked_until := CASE WHEN v_tries >= 5 THEN v_now + interval '15 minutes' ELSE NULL END;
    UPDATE public.user_sign_codes SET failed_tries = v_tries, locked_until = v_locked_until WHERE user_id = p_signer_id;
    RETURN jsonb_build_object('ok', false, 'reason', CASE WHEN v_locked_until IS NULL THEN 'wrong' ELSE 'locked' END, 'tries_left', GREATEST(0, 5 - v_tries), 'locked_until', v_locked_until,
      'message', CASE WHEN v_locked_until IS NULL THEN 'That is not ' || v_signer_short || '''s code.' ELSE 'Five wrong codes. The code is locked for fifteen minutes.' END);
  END IF;
  UPDATE public.user_sign_codes SET failed_tries = 0, locked_until = NULL, last_used_at = v_now WHERE user_id = p_signer_id;
  PERFORM set_config('lien.code_verified_for', p_signer_id::text, true);
  UPDATE public.job_lien_desk_items
     SET status = CASE WHEN p_approve THEN 'approved' ELSE status END,
         approval_mode = CASE WHEN p_approve THEN 'leader' ELSE approval_mode END,
         approved_by = CASE WHEN p_approve THEN p_signer_id ELSE approved_by END,
         approved_at = CASE WHEN p_approve THEN v_now ELSE approved_at END,
         signed_at = v_now,
         signed_by = p_signer_id,
         signed_on_device_of = CASE WHEN v_caller = p_signer_id THEN NULL ELSE v_caller END,
         signer_printed_name = v_signer_name,
         signer_signature_mode = 'code',
         signer_signature_storage_path = NULL,
         signed_fields_hash = NULLIF(btrim(COALESCE(p_fields_hash, '')), ''),
         signed_recorded_by = NULL,
         signed_witness_how = NULL,
         signed_leader_confirmed_at = NULL
   WHERE id = p_item_id;
  PERFORM set_config('lien.code_verified_for', '', true);
  RETURN jsonb_build_object('ok', true, 'signed_at', v_now, 'printed_name', v_signer_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sign_lien_desk_item_with_code(uuid, uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_lien_desk_item_with_code(uuid, uuid, text, text, boolean) TO authenticated;
