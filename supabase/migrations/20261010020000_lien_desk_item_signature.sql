SET lock_timeout = '3s';

-- Lien desk signing, PR 1 of 3 (v2.5077): the leader's electronic signature on a desk item. The
-- § 53.056 / § 53.057 notice, counsel's letter and letter two print it above the rule where the
-- blank line used to be. One press of Sign and approve ▸ under his own sign-in places his name in
-- the cursive face (mode 'type'); he may draw instead (mode 'draw', the PNG stored under
-- desk/<item id>/ in the lien-release-documents bucket). The signature binds to the notice as
-- drafted: signed_fields_hash is the hash of `fields` at signing, so a later edit reads as unsigned.
-- Additive: seven nullable columns on an existing table, no new table, so no read-only or
-- digital-twin fences to re-apply. The guard trigger gains one rule: a signature is the leader's
-- own act (see below).

ALTER TABLE public.job_lien_desk_items
  ADD COLUMN IF NOT EXISTS signed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS signed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_on_device_of uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signer_printed_name text NULL,
  ADD COLUMN IF NOT EXISTS signer_signature_mode text NULL,
  ADD COLUMN IF NOT EXISTS signer_signature_storage_path text NULL,
  ADD COLUMN IF NOT EXISTS signed_fields_hash text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_lien_desk_items_signer_signature_mode_check') THEN
    ALTER TABLE public.job_lien_desk_items
      ADD CONSTRAINT job_lien_desk_items_signer_signature_mode_check CHECK (signer_signature_mode IS NULL OR signer_signature_mode IN ('type', 'draw'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_lien_desk_items.signed_at IS
  'Lien desk signing (v2.5077): when the leader signed the notice. NULL = unsigned; the run holds an unsigned notice.';
COMMENT ON COLUMN public.job_lien_desk_items.signed_by IS
  'Lien desk signing (v2.5077): the leader whose signature it is — always a master or dev, enforced by the guard.';
COMMENT ON COLUMN public.job_lien_desk_items.signed_on_device_of IS
  'Lien desk signing (v2.5077): the signed-in user when the leader drew on someone else''s screen (Leader here); NULL when he signed under his own sign-in.';
COMMENT ON COLUMN public.job_lien_desk_items.signer_printed_name IS
  'Lien desk signing (v2.5077): the name the mark prints — the cursive name for a pressed signature, the name under the ink for a drawn one.';
COMMENT ON COLUMN public.job_lien_desk_items.signer_signature_mode IS
  'Lien desk signing (v2.5077): type = one press placed the name in cursive under his own sign-in; draw = he drew it.';
COMMENT ON COLUMN public.job_lien_desk_items.signer_signature_storage_path IS
  'Lien desk signing (v2.5077): the drawn PNG in the lien-release-documents bucket (desk/<item id>/<uuid>.png); NULL for a pressed signature.';
COMMENT ON COLUMN public.job_lien_desk_items.signed_fields_hash IS
  'Lien desk signing (v2.5077): hash of `fields` at signing. The client reads the signature only while the hash still matches, so an edit after signing asks for his hand again.';

-- The guard, with the signature rule added (v2.5077). Everything else is as 20261007010000 left it.
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
  v_newly_signed := NEW.signed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.signed_at IS DISTINCT FROM NEW.signed_at);
  IF v_newly_signed THEN
    IF NEW.signed_by IS NULL OR NEW.signer_signature_mode IS NULL OR NEW.signer_printed_name IS NULL OR btrim(NEW.signer_printed_name) = '' THEN
      RAISE EXCEPTION 'a signed lien notice names who signed, how, and the name the mark prints' USING ERRCODE = '23514';
    END IF;
    SELECT u.role INTO v_signer_role FROM public.users u WHERE u.id = NEW.signed_by;
    IF v_signer_role IS DISTINCT FROM 'dev' AND v_signer_role IS DISTINCT FROM 'master_technician' THEN
      RAISE EXCEPTION 'only a master or dev signs a lien notice' USING ERRCODE = '42501';
    END IF;
    IF auth.uid() IS NOT NULL AND NEW.signed_by IS DISTINCT FROM auth.uid() THEN
      IF NEW.signed_on_device_of IS DISTINCT FROM auth.uid() OR NEW.signer_signature_mode IS DISTINCT FROM 'draw' THEN
        RAISE EXCEPTION 'a lien notice is signed by the leader under his own sign-in, or drawn by him on this screen' USING ERRCODE = '42501';
      END IF;
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
