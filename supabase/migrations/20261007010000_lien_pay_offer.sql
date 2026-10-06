SET lock_timeout = '3s';

-- The pay offer (v2.4700): a discount on each bill if it is paid in full by a day, offered on
-- the owner's pay page behind a § 53.056 notice. The leader turns it on where the notice is
-- approved (the desk item carries the choice); when the run is recorded the `lien-pay-offer`
-- function puts a Stripe credit note on every enclosed Stripe bill (the invoice row carries the
-- money side), the webhook records the agreed write-down when a bill is paid in full, and the
-- nightly sweep takes the credit back from any bill still open after the day. The ledger's
-- amount changes only when the bill is paid, so an affidavit always swears the full balance.

-- The choice, on the notice being approved.
ALTER TABLE public.job_lien_desk_items
  ADD COLUMN IF NOT EXISTS offer_pct smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_by date,
  ADD COLUMN IF NOT EXISTS offer_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_set_at timestamptz;

ALTER TABLE public.job_lien_desk_items DROP CONSTRAINT IF EXISTS job_lien_desk_items_offer_pct_check;
ALTER TABLE public.job_lien_desk_items
  ADD CONSTRAINT job_lien_desk_items_offer_pct_check CHECK (offer_pct >= 0 AND offer_pct <= 50);
ALTER TABLE public.job_lien_desk_items DROP CONSTRAINT IF EXISTS job_lien_desk_items_offer_day_check;
ALTER TABLE public.job_lien_desk_items
  ADD CONSTRAINT job_lien_desk_items_offer_day_check CHECK (offer_pct = 0 OR offer_by IS NOT NULL);

COMMENT ON COLUMN public.job_lien_desk_items.offer_pct IS
  'The pay offer (v2.4700): percent off each enclosed bill paid in full by offer_by; 0 = no offer. Set by a master or dev only (the guard trigger).';
COMMENT ON COLUMN public.job_lien_desk_items.offer_by IS
  'The pay offer''s last day: a bill paid in full by this day is offer_pct less. Never later than a week before the affidavit must be filed (client rule).';

-- The money side, on each bill.
ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS lien_offer_pct smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lien_offer_by date,
  ADD COLUMN IF NOT EXISTS lien_offer_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_offer_filing_id uuid REFERENCES public.job_lien_filings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_offer_credit_note_id text,
  ADD COLUMN IF NOT EXISTS lien_offer_credit_cents integer,
  ADD COLUMN IF NOT EXISTS lien_offer_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS lien_offer_taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS lien_offer_ended_at timestamptz;

COMMENT ON COLUMN public.jobs_ledger_invoices.lien_offer_credit_note_id IS
  'The pay offer (v2.4700): the Stripe credit note that lowers what Stripe asks for while the offer is live. taken_at = paid in full with it (the webhook recorded the agreed write-down); ended_at = the day passed unpaid and the nightly sweep voided it.';

-- The nightly sweep's rows: live offers, by day.
CREATE INDEX IF NOT EXISTS jobs_ledger_invoices_lien_offer_live_idx
  ON public.jobs_ledger_invoices (lien_offer_by)
  WHERE lien_offer_credit_note_id IS NOT NULL AND lien_offer_taken_at IS NULL AND lien_offer_ended_at IS NULL;

-- The guard, from its newest definition (20260915140258): an offer is set or changed by a
-- master or dev only, and the row remembers who and when.
CREATE OR REPLACE FUNCTION public.job_lien_desk_items_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_newly_approved boolean;
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
  -- v2.4700: the pay offer is the leader's to give.
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

COMMENT ON FUNCTION public.job_lien_desk_items_guard() IS
  'Lien desk approval guard (v2.3405): a leader approval needs a master or dev; the spoken word needs its note and channel; v2.3469: a rule approval needs a recorded § 53.056 notice to the GC first; v2.4700: the pay offer (offer_pct / offer_by) is set by a master or dev only, stamped offer_set_by / _at.';
