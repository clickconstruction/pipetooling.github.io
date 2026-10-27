SET lock_timeout = '3s';

-- Bids → Lien Release records its waivers, and the leader signs one there with his code (v2.5958, the
-- waiver signing train's PR C; the owner's canvases SKC7A628yTEEsQKahKDerv and USoqD1sAgUyVszvqouk662,
-- board 3). v2.5893 drew the four § 53.284 forms on the tab and filed a print as a sent copy, but no
-- waiver was recorded on the bid, and an unconditional one held for an estimator with no way forward but
-- to fetch the leader's laptop. Here:
--   1) job_lien_releases gains bid_id: a waiver lives on a job or on a bid, exactly one of the two.
--   2) An estimator reads, makes and updates a bid's waivers, and nothing else; the office keeps its
--      policies on every row. A guard holds an estimator's waiver to the paper he made, unsigned, except
--      for the leader's code (sign_lien_release_with_code names the row in a transaction-local setting).
--   3) The job's activity feed skips a bid's waiver: it has no job.
--   4) sign_lien_release_with_code admits an estimator on a bid's waiver, where the leader's code is the
--      whole verification; the leader gate on the signer is unchanged. lien_sign_code_status answers an
--      estimator about a leader's code, so the code door knows whether one is set.

-- ---------- 1) a bid's waiver ----------
ALTER TABLE public.job_lien_releases ADD COLUMN IF NOT EXISTS bid_id uuid NULL REFERENCES public.bids(id) ON DELETE CASCADE;
ALTER TABLE public.job_lien_releases ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE public.job_lien_releases DROP CONSTRAINT IF EXISTS job_lien_releases_job_or_bid_check;
ALTER TABLE public.job_lien_releases
  ADD CONSTRAINT job_lien_releases_job_or_bid_check CHECK (num_nonnulls(job_id, bid_id) = 1);
CREATE INDEX IF NOT EXISTS job_lien_releases_bid_id_idx ON public.job_lien_releases (bid_id) WHERE bid_id IS NOT NULL;

COMMENT ON COLUMN public.job_lien_releases.bid_id IS
  'Bids → Lien Release (v2.5958): the bid a waiver was made on, before any job or bill exists. Exactly one of job_id and bid_id is set (job_lien_releases_job_or_bid_check). A bid''s waiver is minted issued from the tab and signed only by the leader''s code.';

-- ---------- 2) who works a bid's waivers ----------
-- The office set's policies (is_office_staff(), the job's master) stand as they were and already cover
-- every row. An estimator reads a bid's waivers on a bid he can see, makes them as himself, and updates
-- them (a send, a void, the stored PDF); never a job's. Training mode and twins stay out through the
-- table's restrictive blocks.
DROP POLICY IF EXISTS job_lien_releases_select_bid_estimator ON public.job_lien_releases;
CREATE POLICY job_lien_releases_select_bid_estimator ON public.job_lien_releases
  FOR SELECT TO authenticated
  USING (bid_id IS NOT NULL AND (SELECT public.is_estimator()) AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_lien_releases.bid_id));

DROP POLICY IF EXISTS job_lien_releases_insert_bid_estimator ON public.job_lien_releases;
CREATE POLICY job_lien_releases_insert_bid_estimator ON public.job_lien_releases
  FOR INSERT TO authenticated
  WITH CHECK (
    bid_id IS NOT NULL AND job_id IS NULL AND created_by = (SELECT auth.uid()) AND (SELECT public.is_estimator())
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_lien_releases.bid_id)
  );

DROP POLICY IF EXISTS job_lien_releases_update_bid_estimator ON public.job_lien_releases;
CREATE POLICY job_lien_releases_update_bid_estimator ON public.job_lien_releases
  FOR UPDATE TO authenticated
  USING (bid_id IS NOT NULL AND (SELECT public.is_estimator()) AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = job_lien_releases.bid_id))
  WITH CHECK (bid_id IS NOT NULL AND job_id IS NULL AND (SELECT public.is_estimator()));

-- An estimator's waiver starts issued and unsigned, and keeps the paper it was made with: the record of a
-- signature moves only inside sign_lien_release_with_code, which names the row in lien.release_code_signing.
-- Anyone else's writes pass untouched.
CREATE OR REPLACE FUNCTION public.job_lien_releases_estimator_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_estimator() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'issued' OR NEW.signed_at IS NOT NULL OR NEW.signer_user_id IS NOT NULL
       OR NEW.signer_printed_name IS NOT NULL OR NEW.signer_signature_mode IS NOT NULL
       OR NEW.signer_signature_storage_path IS NOT NULL OR NEW.signer_consented_at IS NOT NULL
       OR NEW.signed_on_device_of IS NOT NULL OR NEW.signed_pdf_path IS NOT NULL THEN
      RAISE EXCEPTION 'A waiver made on a bid starts unsigned. Only the leader''s code signs it.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF current_setting('lien.release_code_signing', true) IS NOT DISTINCT FROM NEW.id::text THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
     OR NEW.signer_user_id IS DISTINCT FROM OLD.signer_user_id
     OR NEW.signer_printed_name IS DISTINCT FROM OLD.signer_printed_name
     OR NEW.signer_signature_mode IS DISTINCT FROM OLD.signer_signature_mode
     OR NEW.signer_signature_storage_path IS DISTINCT FROM OLD.signer_signature_storage_path
     OR NEW.signer_consented_at IS DISTINCT FROM OLD.signer_consented_at
     OR NEW.signed_on_device_of IS DISTINCT FROM OLD.signed_on_device_of
     OR NEW.form_type IS DISTINCT FROM OLD.form_type
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.through_date IS DISTINCT FROM OLD.through_date
     OR NEW.signed_date IS DISTINCT FROM OLD.signed_date
     OR NEW.fields IS DISTINCT FROM OLD.fields
     OR NEW.bid_id IS DISTINCT FROM OLD.bid_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A bid''s waiver keeps the paper it was made with. Only the leader''s code signs it.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_lien_releases_estimator_guard_iu ON public.job_lien_releases;
CREATE TRIGGER job_lien_releases_estimator_guard_iu
  BEFORE INSERT OR UPDATE ON public.job_lien_releases
  FOR EACH ROW EXECUTE FUNCTION public.job_lien_releases_estimator_guard();

-- ---------- 3) the job's activity feed skips a bid's waiver ----------
-- Restated from its one definition (20260902001517, v2.2616) with two changes: a waiver with no job writes
-- no job event (job_activity_events needs a job), and the conditional final form (v2.4274) is named as
-- itself — it fell to the ELSE and read "Unconditional · final" on the feed.
CREATE OR REPLACE FUNCTION public.job_lien_releases_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_amount text;
  v_sid text;
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_label := CASE NEW.form_type
    WHEN 'conditional_progress' THEN 'Conditional · progress'
    WHEN 'unconditional_progress' THEN 'Unconditional · progress'
    WHEN 'conditional_final' THEN 'Conditional · final'
    ELSE 'Unconditional · final'
  END;
  v_amount := '$' || trim(to_char(NEW.amount, 'FM999,999,990.00'));

  -- Issued (minted): the first time the row exists past 'draft'.
  IF NEW.status <> 'draft' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_issued', coalesce(NEW.minted_at, now()), NEW.created_by,
      'Release of lien issued — ' || v_label || ' ' || v_amount,
      jsonb_build_object('source_id', NEW.id::text, 'form_type', NEW.form_type, 'amount', NEW.amount),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_issued' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Signature requested (re-requests get fresh source_ids).
  IF NEW.signature_requested_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.signature_requested_at IS DISTINCT FROM NEW.signature_requested_at) THEN
    v_sid := NEW.id::text || ':req:' || extract(epoch FROM NEW.signature_requested_at)::bigint::text;
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_signature_requested', NEW.signature_requested_at, NEW.signature_requested_by,
      'Signature requested — ' || v_label || ' ' || v_amount,
      jsonb_build_object('source_id', v_sid, 'release_id', NEW.id::text, 'form_type', NEW.form_type),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_signature_requested' AND e.detail ->> 'source_id' = v_sid
    );
  END IF;

  -- Signed.
  IF NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS NULL) THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_signed', NEW.signed_at, NEW.signer_user_id,
      'Release of lien signed by ' || coalesce(nullif(trim(NEW.signer_printed_name), ''), 'the signer'),
      jsonb_build_object('source_id', NEW.id::text, 'release_id', NEW.id::text, 'form_type', NEW.form_type),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_signed' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  -- Sent to customer (re-sends get fresh source_ids).
  IF NEW.sent_to_customer_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.sent_to_customer_at IS DISTINCT FROM NEW.sent_to_customer_at) THEN
    v_sid := NEW.id::text || ':sent:' || extract(epoch FROM NEW.sent_to_customer_at)::bigint::text;
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_sent', NEW.sent_to_customer_at, NEW.sent_by,
      CASE WHEN NEW.sent_channel = 'email'
        THEN 'Signed release emailed to customer — PDF attached'
        ELSE 'Release marked sent to customer' END,
      jsonb_build_object('source_id', v_sid, 'release_id', NEW.id::text, 'channel', NEW.sent_channel),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_sent' AND e.detail ->> 'source_id' = v_sid
    );
  END IF;

  -- Voided.
  IF TG_OP = 'UPDATE' AND NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT NEW.job_id, 'lien_release_voided', NEW.voided_at, NEW.voided_by,
      'Release of lien voided — ' || v_label || ' ' || v_amount,
      jsonb_build_object('source_id', NEW.id::text, 'release_id', NEW.id::text, 'form_type', NEW.form_type),
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_activity_events e
      WHERE e.event_type = 'lien_release_voided' AND e.detail ->> 'source_id' = NEW.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ---------- 4) an estimator opens a bid's waiver for the leader's code ----------
-- Restated from 20261026193000 (v2.5924). New: an estimator who is not a twin may call it on a bid's
-- waiver (never a job's), since the leader's code is the whole verification; a caller with no users row
-- is refused as the field is. The signer gate (a live master or dev), the states and the stamp are as
-- they were; the stamp names the row in lien.release_code_signing for the estimator guard, then clears it.
CREATE OR REPLACE FUNCTION public.sign_lien_release_with_code(p_release_id uuid, p_signer_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_twin boolean;
  v_signer_role text;
  v_check jsonb;
  v_status text;
  v_voided timestamptz;
  v_bid uuid;
  v_now timestamptz := now();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'training mode: nothing is signed' USING ERRCODE = '42501';
  END IF;
  SELECT u.role, COALESCE(u.is_digital_twin, false) INTO v_caller_role, v_caller_twin FROM public.users u WHERE u.id = v_caller;
  IF v_caller_role IS NULL
     OR (v_caller_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') AND (v_caller_role <> 'estimator' OR v_caller_twin)) THEN
    RAISE EXCEPTION 'only the office or a leader opens a release for signing' USING ERRCODE = '42501';
  END IF;
  SELECT u.role INTO v_signer_role FROM public.users u WHERE u.id = p_signer_id AND u.archived_at IS NULL;
  IF v_signer_role IS DISTINCT FROM 'dev' AND v_signer_role IS DISTINCT FROM 'master_technician' THEN
    RAISE EXCEPTION 'only a master or dev signs a release of lien' USING ERRCODE = '42501';
  END IF;
  SELECT r.status, r.voided_at, r.bid_id INTO v_status, v_voided, v_bid FROM public.job_lien_releases r WHERE r.id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'release not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_caller_role = 'estimator' AND v_bid IS NULL THEN
    RAISE EXCEPTION 'only the office or a leader opens a release for signing' USING ERRCODE = '42501';
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
  PERFORM set_config('lien.release_code_signing', p_release_id::text, true);
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
  PERFORM set_config('lien.release_code_signing', '', true);
  RETURN jsonb_build_object('ok', true, 'signed_at', v_now, 'printed_name', v_check ->> 'printed_name');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sign_lien_release_with_code(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_lien_release_with_code(uuid, uuid, text) TO authenticated;

-- Restated from 20261023150000 (v2.5788). New: an estimator may ask about a leader's code (a master or
-- dev), for the Bids tab's code door; a caller with no users row asks about no one's but his own.
CREATE OR REPLACE FUNCTION public.lien_sign_code_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_target_role text;
  v_row public.user_sign_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
    IF v_role = 'estimator' THEN
      SELECT u.role INTO v_target_role FROM public.users u WHERE u.id = p_user_id;
      IF v_target_role IS DISTINCT FROM 'dev' AND v_target_role IS DISTINCT FROM 'master_technician' THEN
        RAISE EXCEPTION 'only the office or a leader asks about a signing code' USING ERRCODE = '42501';
      END IF;
    ELSIF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
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

REVOKE EXECUTE ON FUNCTION public.lien_sign_code_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lien_sign_code_status(uuid) TO authenticated;
