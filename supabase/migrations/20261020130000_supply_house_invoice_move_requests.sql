SET lock_timeout = '3s';

-- The move window (punch list #132 PR 3): a supply house moves a charge onto a
-- job account only while the invoice is current (not yet due). When the office
-- asks the house to move one — by email from the app, or on the phone — the ask
-- is written here, and the flag on the invoice flips only when someone attests
-- the house confirmed it. One open (unconfirmed) ask per invoice at a time.

CREATE TABLE IF NOT EXISTS public.supply_house_invoice_move_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  via text NOT NULL
    CONSTRAINT supply_house_invoice_move_requests_via_check CHECK (via IN ('email', 'phone')),
  -- The rep address the emailed ask went to (snapshot; '' on a phone ask).
  sent_to text NOT NULL DEFAULT '',
  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supply_house_invoice_move_requests IS
  'The move window (punch list #132 PR 3): asks to a supply house to move a charge onto the job account — the house honors these only while the invoice is current. via email = sent from the app to the house''s job-accounts rep (sent_to), via phone = the office called. confirmed_* = someone attested the house moved it (the invoice''s on_job_account flips with it). An unconfirmed ask is a follow-up owed.';

CREATE INDEX IF NOT EXISTS supply_house_invoice_move_requests_invoice_idx
  ON public.supply_house_invoice_move_requests (invoice_id);

-- One OPEN ask per invoice; confirmed history stays.
CREATE UNIQUE INDEX IF NOT EXISTS supply_house_invoice_move_requests_open_uniq
  ON public.supply_house_invoice_move_requests (invoice_id)
  WHERE confirmed_at IS NULL;

ALTER TABLE public.supply_house_invoice_move_requests ENABLE ROW LEVEL SECURITY;

-- The office set that works Accounts payable — same hands as the invoices themselves.
DROP POLICY IF EXISTS supply_house_invoice_move_requests_select_office ON public.supply_house_invoice_move_requests;
CREATE POLICY supply_house_invoice_move_requests_select_office
  ON public.supply_house_invoice_move_requests FOR SELECT TO authenticated
  USING (public.is_office_staff());

DROP POLICY IF EXISTS supply_house_invoice_move_requests_insert_office ON public.supply_house_invoice_move_requests;
CREATE POLICY supply_house_invoice_move_requests_insert_office
  ON public.supply_house_invoice_move_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS supply_house_invoice_move_requests_update_office ON public.supply_house_invoice_move_requests;
CREATE POLICY supply_house_invoice_move_requests_update_office
  ON public.supply_house_invoice_move_requests FOR UPDATE TO authenticated
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS supply_house_invoice_move_requests_delete_office ON public.supply_house_invoice_move_requests;
CREATE POLICY supply_house_invoice_move_requests_delete_office
  ON public.supply_house_invoice_move_requests FOR DELETE TO authenticated
  USING (public.is_office_staff());

-- Stamps, server-side so every client writes the same thing: updated_at always;
-- who asked when the row is born; who confirmed the moment confirmed_at lands.
CREATE OR REPLACE FUNCTION public.supply_house_invoice_move_requests_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND NEW.requested_by IS NULL THEN
    NEW.requested_by := auth.uid();
  END IF;
  IF NEW.confirmed_at IS NOT NULL AND NEW.confirmed_by IS NULL THEN
    NEW.confirmed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supply_house_invoice_move_requests_stamp ON public.supply_house_invoice_move_requests;
CREATE TRIGGER supply_house_invoice_move_requests_stamp
  BEFORE INSERT OR UPDATE ON public.supply_house_invoice_move_requests
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_invoice_move_requests_stamp();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
