SET lock_timeout = '3s';

-- Lien desk signing by code (v2.5788, punch list #150, PR 1 of 2). The owner, 2026-10-23: a dev who presses
-- Approve on the desk opens the notice with the master's line under it and no way to act but to carry the
-- laptop to him. The master should be able to put his name on the notice on any screen, proving it is him
-- with a short code only he knows, set by himself in Settings → Your account (4 to 6 digits), never sent to
-- his phone. What makes it a signature is still the record: the code is his alone, the database checks it,
-- the row names whose screen he typed it on, and his own sign-in may stand behind it or disown it later
-- (the pen train's Yes, I signed it / Not what I signed). The office never sees the code or its hash.
--
-- This migration: the codes table (hash + salt, no client access at all), four SECURITY DEFINER functions
-- (set, clear, status, sign), the mode CHECK widened to 'code', and the guard taught the rule: a 'code'
-- signature is accepted only inside sign_lien_desk_item_with_code, which names the verified signer in a
-- transaction-local setting the guard reads. Five wrong codes lock the code for fifteen minutes.

CREATE TABLE IF NOT EXISTS public.user_sign_codes (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  code_salt text NOT NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  failed_tries integer NOT NULL DEFAULT 0,
  locked_until timestamptz NULL,
  last_used_at timestamptz NULL
);

COMMENT ON TABLE public.user_sign_codes IS
  'Lien desk signing by code (v2.5788): a leader''s signing code, salted sha256 only. No policies: every read and write goes through the four lien_sign_code / sign_lien_desk_item_with_code functions.';

ALTER TABLE public.user_sign_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_sign_codes FROM PUBLIC, anon, authenticated;

ALTER TABLE public.job_lien_desk_items DROP CONSTRAINT IF EXISTS job_lien_desk_items_signer_signature_mode_check;
ALTER TABLE public.job_lien_desk_items
  ADD CONSTRAINT job_lien_desk_items_signer_signature_mode_check CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw', 'pen', 'code'));

COMMENT ON COLUMN public.job_lien_desk_items.signer_signature_mode IS
  'Lien desk signing (v2.5077): type = one press placed the name in cursive under his own sign-in; draw = he drew it. Pen (the pen train): he signed the paper as printed with a pen, and the office wrote it down. Code (v2.5788): he typed his own signing code on the signed-in user''s screen (signed_on_device_of), and the database checked it.';

-- ---------- the code: set, clear, status ----------

CREATE OR REPLACE FUNCTION public.set_lien_sign_code(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_salt text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'training mode: the signing code is not changed' USING ERRCODE = '42501';
  END IF;
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' THEN
    RAISE EXCEPTION 'only a master or dev has a signing code; only they sign a lien notice' USING ERRCODE = '42501';
  END IF;
  IF p_code !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'a signing code is 4 to 6 digits' USING ERRCODE = '23514';
  END IF;
  v_salt := gen_random_uuid()::text;
  INSERT INTO public.user_sign_codes (user_id, code_hash, code_salt, set_at, failed_tries, locked_until)
  VALUES (auth.uid(), encode(sha256(convert_to(v_salt || p_code, 'UTF8')), 'hex'), v_salt, now(), 0, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET code_hash = EXCLUDED.code_hash, code_salt = EXCLUDED.code_salt, set_at = now(), failed_tries = 0, locked_until = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_lien_sign_code()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'training mode: the signing code is not changed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_sign_codes WHERE user_id = auth.uid();
END;
$$;

-- Whether a leader has a code, when he set it, and whether it is locked: for his own card and for the desk
-- at someone else's screen. Never the code, never the hash. The office set and the leader himself may ask.
CREATE OR REPLACE FUNCTION public.lien_sign_code_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row public.user_sign_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
    IF v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
      RAISE EXCEPTION 'only the office or a leader asks about a signing code' USING ERRCODE = '42501';
    END IF;
  END IF;
  SELECT * INTO v_row FROM public.user_sign_codes WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('set', false);
  END IF;
  RETURN jsonb_build_object(
    'set', true,
    'set_at', v_row.set_at,
    'last_used_at', v_row.last_used_at,
    'locked_until', CASE WHEN v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN v_row.locked_until ELSE NULL END
  );
END;
$$;

-- ---------- the signature: his code on any screen ----------

-- The one write behind the desk's code field. The caller is the signed-in user at the screen (the office set
-- or a leader); the signer is the job's master; the code is checked here against the salted hash and never
-- leaves the database. Wrong code: the counter rises and the answer says how many tries are left; the fifth
-- locks the code for fifteen minutes (the answer says until when). Right code: the row is signed in mode
-- 'code', naming the signer, whose screen, the hash of the draft as signed; with p_approve the notice is
-- approved as the signer's own act (approved_by = the signer). The guard sees the verified signer through the
-- transaction-local setting lien.code_verified_for and accepts nothing in mode 'code' without it.
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
  SELECT u.role, COALESCE(NULLIF(btrim(u.name), ''), u.email) INTO v_signer_role, v_signer_name
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

REVOKE EXECUTE ON FUNCTION public.set_lien_sign_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lien_sign_code(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_lien_sign_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_lien_sign_code() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.lien_sign_code_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lien_sign_code_status(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sign_lien_desk_item_with_code(uuid, uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_lien_desk_item_with_code(uuid, uuid, text, text, boolean) TO authenticated;

-- ---------- the guard, with the code rule ----------
-- Replaced whole, as every signing migration does; everything else is as 20261013100000 left it.
CREATE OR REPLACE FUNCTION public.job_lien_desk_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_signer_role text;
  v_newly_approved boolean;
  v_newly_signed boolean;
  v_newly_confirmed boolean;
  v_gc uuid;
  v_prior boolean;
  v_offer_changed boolean;
  v_code_signer uuid;
BEGIN
  NEW.updated_at := now();
  -- v2.5788: the leader's signing code. sign_lien_desk_item_with_code verified it in this transaction and
  -- named him here; a direct write never carries the setting, so mode 'code' is refused outside that function.
  v_code_signer := NULLIF(current_setting('lien.code_verified_for', true), '')::uuid;
  v_newly_approved := NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved');
  IF v_newly_approved THEN
    IF NEW.approval_mode IS NULL THEN
      RAISE EXCEPTION 'approval_mode is required when approving' USING ERRCODE = '23514';
    END IF;
    IF NEW.approval_mode = 'leader' THEN
      -- v2.5788: with his code verified, the approval is the signer's act on whoever's screen; else the caller's own.
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = COALESCE(v_code_signer, auth.uid());
      IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' THEN
        RAISE EXCEPTION 'only a master or dev approves a lien notice; record the spoken word instead' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.approval_mode = 'word' THEN
      IF btrim(NEW.word_note) = '' OR NEW.word_channel = '' THEN
        RAISE EXCEPTION 'a notice sent on the leader''s word needs who said it, when, and how' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.approval_mode = 'rule' AND NEW.kind = 'notice_53_056' THEN
      -- v2.3469: the rule only takes effect after a first notice to this GC was recorded.
      SELECT j.gc_customer_id INTO v_gc FROM public.jobs_ledger j WHERE j.id = NEW.job_id;
      SELECT EXISTS (
        SELECT 1
        FROM public.job_lien_filings f
        JOIN public.jobs_ledger j2 ON j2.id = f.job_id
        WHERE f.kind = 'notice_53_056'
          AND f.voided_at IS NULL
          AND v_gc IS NOT NULL
          AND j2.gc_customer_id = v_gc
      ) INTO v_prior;
      IF NOT v_prior THEN
        RAISE EXCEPTION 'the first notice to a GC comes to the leader; a standing rule starts with the second' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
    IF NEW.approved_by IS NULL THEN NEW.approved_by := COALESCE(v_code_signer, auth.uid()); END IF;
  END IF;
  -- v2.5077: a signature is the leader's own act. It is his when the row's signer is a master or dev
  -- and either the write is under his own sign-in (one press, or his own drawing) or he drew it on
  -- the signed-in user's screen (Leader here), which the row says. The office can never place his name.
  -- The pen train: or he signed the paper as printed with a pen, and the signed-in office user wrote
  -- it down — the row names who wrote it (signed_recorded_by) and how they know (signed_witness_how).
  v_newly_signed := NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS DISTINCT FROM NEW.signed_at);
  IF v_newly_signed THEN
    IF NEW.signed_by IS NULL OR NEW.signer_signature_mode IS NULL OR NEW.signer_printed_name IS NULL OR btrim(NEW.signer_printed_name) = '' THEN
      RAISE EXCEPTION 'a signed lien notice names who signed, how, and the name the mark prints' USING ERRCODE = '23514';
    END IF;
    SELECT u.role INTO v_signer_role FROM public.users u WHERE u.id = NEW.signed_by;
    IF v_signer_role IS DISTINCT FROM 'dev' AND v_signer_role IS DISTINCT FROM 'master_technician' THEN
      RAISE EXCEPTION 'only a master or dev signs a lien notice' USING ERRCODE = '42501';
    END IF;
    IF NEW.signer_signature_mode = 'pen' THEN
      IF NEW.signed_witness_how IS NULL THEN
        RAISE EXCEPTION 'a pen signature says how the office knows: they watched him sign, he told them, or the signed page is in hand' USING ERRCODE = '23514';
      END IF;
      IF NEW.signed_recorded_by IS NULL THEN NEW.signed_recorded_by := auth.uid(); END IF;
      IF auth.uid() IS NOT NULL AND NEW.signed_recorded_by IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'a pen signature is written down by the signed-in user' USING ERRCODE = '42501';
      END IF;
      NEW.signed_on_device_of := NULL;
    ELSIF NEW.signer_signature_mode = 'code' THEN
      IF v_code_signer IS NULL OR v_code_signer IS DISTINCT FROM NEW.signed_by THEN
        RAISE EXCEPTION 'a signature by code is placed through sign_lien_desk_item_with_code, with the leader''s own code' USING ERRCODE = '42501';
      END IF;
    ELSIF auth.uid() IS NOT NULL AND NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      IF NEW.signed_on_device_of IS DISTINCT FROM auth.uid() OR NEW.signer_signature_mode IS DISTINCT FROM 'draw' THEN
        RAISE EXCEPTION 'a lien notice is signed by the leader under his own sign-in, or drawn by him on this screen' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  -- The pen train: only the leader who signed confirms a pen signature, from his own sign-in. v2.5788: a code
  -- signature too — it was placed on someone else's screen, and his own sign-in may stand behind it or disown it.
  v_newly_confirmed := NEW.signed_leader_confirmed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_leader_confirmed_at IS DISTINCT FROM NEW.signed_leader_confirmed_at);
  IF v_newly_confirmed THEN
    IF NEW.signer_signature_mode IS DISTINCT FROM 'pen' AND NEW.signer_signature_mode IS DISTINCT FROM 'code' THEN
      RAISE EXCEPTION 'only a pen or code signature is confirmed; a press or a drawing under his own sign-in is his own act already' USING ERRCODE = '23514';
    END IF;
    IF auth.uid() IS NOT NULL AND NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'only the leader who signed the paper confirms it, from his own sign-in' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- v2.4713: the pay offer is the leader's to give.
  v_offer_changed := (TG_OP = 'INSERT' AND NEW.offer_pct <> 0)
    OR (TG_OP = 'UPDATE' AND (OLD.offer_pct IS DISTINCT FROM NEW.offer_pct OR OLD.offer_by IS DISTINCT FROM NEW.offer_by));
  IF v_offer_changed THEN
    IF auth.uid() IS NOT NULL THEN
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
      IF v_role IS DISTINCT FROM 'dev' AND v_role IS DISTINCT FROM 'master_technician' THEN
        RAISE EXCEPTION 'only a master or dev offers a discount on a lien notice' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.offer_pct = 0 THEN
      NEW.offer_by := NULL;
      NEW.offer_set_by := NULL;
      NEW.offer_set_at := NULL;
    ELSE
      NEW.offer_set_by := COALESCE(auth.uid(), NEW.offer_set_by);
      NEW.offer_set_at := now();
    END IF;
  END IF;
  IF NEW.status = 'held' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'held') THEN
    IF NEW.held_at IS NULL THEN NEW.held_at := now(); END IF;
    IF NEW.held_by IS NULL THEN NEW.held_by := auth.uid(); END IF;
  END IF;
  IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN NEW.sent_at := now(); END IF;
  RETURN NEW;
END;
$$;

-- A new table: the training-mode fences and the twin fence take it (each creates only what is missing).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
