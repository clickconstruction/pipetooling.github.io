SET lock_timeout = '3s';

-- Lien desk signing, signed with a pen (v2.5366, the pen train PR 1). A packet prints, the leader signs the
-- papers with a pen, the office mails them; back from the post office, Record the mailing held the
-- envelopes as unsigned with no way to say he had already signed the paper. Every packet printed
-- before the signing rule (20261010020000) sits in the same spot. This adds the third way a notice
-- is signed: on the paper as printed, written down by the office. A signature is the record, not
-- the mark: the row names who signed, when, who wrote it down and how they know, and the frame's
-- record ID already printed on the paper ties the page to the row. Additive: three nullable
-- columns on an existing table and a wider check, no new table, so no fences to re-apply. The
-- guard gains the pen rule; everything else is as 20261010020000 left it.

ALTER TABLE public.job_lien_desk_items
  ADD COLUMN IF NOT EXISTS signed_recorded_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_witness_how text NULL,
  ADD COLUMN IF NOT EXISTS signed_leader_confirmed_at timestamptz NULL;

ALTER TABLE public.job_lien_desk_items DROP CONSTRAINT IF EXISTS job_lien_desk_items_signer_signature_mode_check;
ALTER TABLE public.job_lien_desk_items
  ADD CONSTRAINT job_lien_desk_items_signer_signature_mode_check CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw', 'pen'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_lien_desk_items_signed_witness_how_check') THEN
    ALTER TABLE public.job_lien_desk_items
      ADD CONSTRAINT job_lien_desk_items_signed_witness_how_check CHECK (signed_witness_how IS NULL OR signed_witness_how IN ('watched', 'told', 'page'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_lien_desk_items.signer_signature_mode IS
  'Lien desk signing (v2.5077): type = one press placed the name in cursive under his own sign-in; draw = he drew it. Pen (the pen train): he signed the paper as printed with a pen, and the office wrote it down.';
COMMENT ON COLUMN public.job_lien_desk_items.signed_recorded_by IS
  'Pen signature (the pen train): the signed-in office user who wrote down that the leader signed the paper. NULL for an electronic signature.';
COMMENT ON COLUMN public.job_lien_desk_items.signed_witness_how IS
  'Pen signature (the pen train): how the office knows — watched = they watched him sign; told = he told them; page = the signed page is in front of them (its photo in signer_signature_storage_path when there is one).';
COMMENT ON COLUMN public.job_lien_desk_items.signed_leader_confirmed_at IS
  'Pen signature (the pen train): when the leader pressed Yes, I signed these on his phone. NULL = not yet; nothing waits on it, it strengthens the record.';

-- The guard, with the pen rule added. Everything else is as 20261010020000 left it.
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
BEGIN
  NEW.updated_at := now();
  v_newly_approved := NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved');
  IF v_newly_approved THEN
    IF NEW.approval_mode IS NULL THEN
      RAISE EXCEPTION 'approval_mode is required when approving' USING ERRCODE = '23514';
    END IF;
    IF NEW.approval_mode = 'leader' THEN
      SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
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
    IF NEW.approved_by IS NULL THEN NEW.approved_by := auth.uid(); END IF;
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
    ELSIF auth.uid() IS NOT NULL AND NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      IF NEW.signed_on_device_of IS DISTINCT FROM auth.uid() OR NEW.signer_signature_mode IS DISTINCT FROM 'draw' THEN
        RAISE EXCEPTION 'a lien notice is signed by the leader under his own sign-in, or drawn by him on this screen' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  -- The pen train: only the leader who signed confirms a pen signature, from his own sign-in.
  v_newly_confirmed := NEW.signed_leader_confirmed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_leader_confirmed_at IS DISTINCT FROM NEW.signed_leader_confirmed_at);
  IF v_newly_confirmed THEN
    IF NEW.signer_signature_mode IS DISTINCT FROM 'pen' THEN
      RAISE EXCEPTION 'only a pen signature is confirmed; an electronic one is his own act already' USING ERRCODE = '23514';
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
