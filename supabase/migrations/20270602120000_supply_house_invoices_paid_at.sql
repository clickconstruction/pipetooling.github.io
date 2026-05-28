-- Add paid_at timestamp to supply_house_invoices so the Supply Houses tab
-- can show when each invoice was marked paid. Kept in sync via a trigger
-- on is_paid transitions so all UI write paths (single toggle, bulk apply,
-- edit-invoice save) "just work" without app-side changes.

ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.supply_house_invoices.paid_at IS
  'Timestamp when is_paid flipped from false to true. NULL when unpaid. '
  'Maintained by sync_supply_house_invoice_paid_at trigger. '
  'Backfilled from updated_at for previously paid rows.';

-- Best-effort backfill for legacy rows: use updated_at when available,
-- otherwise created_at, otherwise now().
UPDATE public.supply_house_invoices
SET paid_at = COALESCE(updated_at, created_at, NOW())
WHERE is_paid = true
  AND paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_supply_house_invoices_paid_at
  ON public.supply_house_invoices(paid_at);

-- Trigger function: stamp paid_at on is_paid transitions.
-- - false -> true: set paid_at = now() (unless explicitly provided)
-- - true  -> false: clear paid_at
-- - no is_paid change: leave paid_at untouched (so editing amount/link
--   does not bump the paid date)
-- - INSERT with is_paid=true and paid_at NULL: set paid_at = now()
CREATE OR REPLACE FUNCTION public.sync_supply_house_invoice_paid_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_paid = true AND NEW.paid_at IS NULL THEN
      NEW.paid_at = NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_paid = true AND OLD.is_paid = false THEN
      IF NEW.paid_at IS NULL OR NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at THEN
        NEW.paid_at = NOW();
      END IF;
    ELSIF NEW.is_paid = false AND OLD.is_paid = true THEN
      NEW.paid_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_supply_house_invoice_paid_at() SET search_path = public;

DROP TRIGGER IF EXISTS sync_supply_house_invoice_paid_at_trigger
  ON public.supply_house_invoices;

CREATE TRIGGER sync_supply_house_invoice_paid_at_trigger
  BEFORE INSERT OR UPDATE ON public.supply_house_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_supply_house_invoice_paid_at();
