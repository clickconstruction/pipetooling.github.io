SET lock_timeout = '3s';

-- Paid invoices keep their billed date.
--
-- v1 of jobs_ledger_invoices_billed_at_fn nulled billed_at whenever an
-- invoice's status was anything but 'billed' — including the billed → paid
-- transition. Every one of the 172 paid invoices in prod has billed_at NULL
-- because of this: the app stamped the date at billing time and the trigger
-- erased it the moment the invoice was paid. That erasure is why the
-- pay-speed model (get_billed_customer_pay_speeds) was starving — its
-- samples require billed_at on the paid invoice.
--
-- v2 semantics:
--   INSERT  billed        → COALESCE(billed_at, now())   (unchanged)
--   INSERT  paid          → keep the provided billed_at  (backfills/imports)
--   INSERT  ready_to_bill → NULL                          (unchanged)
--   UPDATE  → billed      → COALESCE(billed_at, now())   (unchanged)
--   UPDATE  → ready_to_bill → NULL                        (send-back resets, unchanged)
--   UPDATE  → paid        → billed_at untouched           (THE FIX)

CREATE OR REPLACE FUNCTION public.jobs_ledger_invoices_billed_at_fn() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'billed' THEN
      NEW.billed_at := COALESCE(NEW.billed_at, now());
    ELSIF NEW.status = 'ready_to_bill' THEN
      NEW.billed_at := NULL;
    END IF;
    -- status = 'paid': keep whatever billed_at the insert carries.
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'billed' AND OLD.status IS DISTINCT FROM 'billed' THEN
      NEW.billed_at := COALESCE(NEW.billed_at, now());
    ELSIF NEW.status = 'ready_to_bill' THEN
      NEW.billed_at := NULL;
    END IF;
    -- status = 'paid': billed_at untouched — paying a bill doesn't unbill it.
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_invoices_billed_at_fn() IS
  'Stamps billed_at when an invoice becomes billed and clears it on send-back to ready_to_bill. v2 (2026-08-24): paid invoices KEEP billed_at — v1 erased it on the billed→paid transition, which destroyed the pay-speed history.';
