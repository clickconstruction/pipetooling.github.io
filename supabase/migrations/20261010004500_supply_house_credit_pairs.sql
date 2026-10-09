SET lock_timeout = '3s';

-- Supply house credits (v2.5035, the owner's call of 2026-10-09): a credit pairs to the invoice it
-- credits. `credits_invoice_id` points a credit memo at the same house's invoice it takes money off;
-- the office sets it with the credit form's Credits invoice… pick, and both rows show the pairing.
-- Additive: a nullable self-reference, its index, two checks and a guard. No new table, so no
-- read-only or digital-twin fences to re-apply.

ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS credits_invoice_id uuid REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS supply_house_invoices_credits_invoice_idx
  ON public.supply_house_invoices (credits_invoice_id)
  WHERE credits_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.supply_house_invoices.credits_invoice_id IS
  'On a credit (v2.5035): the same house''s invoice it credits, picked by the office; null when unpaired. Only a credit carries it; a deleted invoice unpairs it.';

-- Only a credit points at an invoice, and never at itself. Drop-then-add keeps this idempotent.
ALTER TABLE public.supply_house_invoices
  DROP CONSTRAINT IF EXISTS supply_house_invoices_credits_invoice_check;
ALTER TABLE public.supply_house_invoices
  ADD CONSTRAINT supply_house_invoices_credits_invoice_check
  CHECK (credits_invoice_id IS NULL OR (document_kind = 'credit' AND credits_invoice_id <> id));

-- The credited row must be an invoice of the same house. A check cannot read another row, so a guard
-- does, when the pairing is set or moved.
CREATE OR REPLACE FUNCTION public.supply_house_invoices_credit_pair_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.credits_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.supply_house_invoices i
    WHERE i.id = NEW.credits_invoice_id AND i.supply_house_id = NEW.supply_house_id AND i.document_kind = 'invoice'
  ) THEN
    RAISE EXCEPTION 'A credit pairs only to an invoice from the same supply house.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.supply_house_invoices_credit_pair_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supply_house_invoices_credit_pair_guard ON public.supply_house_invoices;
CREATE TRIGGER supply_house_invoices_credit_pair_guard
  BEFORE INSERT OR UPDATE OF credits_invoice_id, supply_house_id ON public.supply_house_invoices
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_invoices_credit_pair_guard();
