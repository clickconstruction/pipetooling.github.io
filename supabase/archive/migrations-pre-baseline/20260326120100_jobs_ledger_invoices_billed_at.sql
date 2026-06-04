-- When an invoice becomes billed, record billed_at; clear when leaving billed (revert / paid).

ALTER TABLE public.jobs_ledger_invoices
ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jobs_ledger_invoices.billed_at IS 'Set when status becomes billed; cleared when status is not billed. Used for aging in UI.';

UPDATE public.jobs_ledger_invoices
SET billed_at = created_at
WHERE status = 'billed' AND billed_at IS NULL;

CREATE OR REPLACE FUNCTION public.jobs_ledger_invoices_billed_at_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'billed' THEN
      NEW.billed_at := COALESCE(NEW.billed_at, now());
    ELSE
      NEW.billed_at := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'billed' AND OLD.status IS DISTINCT FROM 'billed' THEN
      NEW.billed_at := COALESCE(NEW.billed_at, now());
    ELSIF NEW.status <> 'billed' THEN
      NEW.billed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_invoices_billed_at_tr ON public.jobs_ledger_invoices;
CREATE TRIGGER jobs_ledger_invoices_billed_at_tr
  BEFORE INSERT OR UPDATE ON public.jobs_ledger_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_invoices_billed_at_fn();
