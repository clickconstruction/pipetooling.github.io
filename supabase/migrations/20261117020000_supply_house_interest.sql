SET lock_timeout = '3s';

-- Supply house payments: interest and late fees (the owner, 2026-11-16: "occasionally when we wait
-- more than 30 days interest will be applied to our bills and we may have to pay that as well").
--
-- His call on how it is kept: a bill of its own, tied to the bill that ran late, and kept off the
-- job's cost. Typed as a loose amount it would vanish into a payment's total. As a bill, the year
-- can say what paying late cost, at which house and on which bill.
--
-- So an interest charge is an ordinary row of supply_house_invoices, an invoice above zero that is
-- owed, aged and paid like any other, with two more facts on it:
--   is_interest      it is interest or a late fee, not materials
--   late_invoice_id  the bill of the same house that ran late, when the person says which
-- It stays document_kind 'invoice', so every reader and the invoice form treat it as the payable
-- bill it is, and a save from an older client cannot turn it into something else.
--
-- "Kept off the job's cost" is held by the database: an interest row takes no job and no bid, and a
-- bill that is on a job cannot be marked interest until the job is taken off.
--
-- record_supply_house_payment gains p_interest: the charge is made as its bill and paid by the same
-- payment, in the one statement. Every other argument is as it was, so the client of v2.7455 keeps
-- working.
--
-- Needs 20261116230000. Additive and idempotent.

ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS is_interest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_invoice_id uuid REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supply_house_invoices.is_interest IS
  'Interest or a late fee the house charged, kept as a bill of its own. It is owed and paid like any bill and is never put on a job or a bid.';
COMMENT ON COLUMN public.supply_house_invoices.late_invoice_id IS
  'On an interest row: the same house''s bill that ran late, when known. A deleted bill leaves it NULL.';

CREATE INDEX IF NOT EXISTS supply_house_invoices_interest_idx
  ON public.supply_house_invoices (supply_house_id, invoice_date) WHERE is_interest;

-- Only an invoice is interest, and only interest names a late bill. Drop-then-add keeps this idempotent.
ALTER TABLE public.supply_house_invoices DROP CONSTRAINT IF EXISTS supply_house_invoices_interest_check;
ALTER TABLE public.supply_house_invoices
  ADD CONSTRAINT supply_house_invoices_interest_check
  CHECK ((NOT is_interest OR document_kind = 'invoice') AND (late_invoice_id IS NULL OR (is_interest AND late_invoice_id <> id)));

-- The late bill is a bill of the same house that is not interest itself, and an interest row is on
-- no job and no bid. A check cannot read another row, so a guard does.
CREATE OR REPLACE FUNCTION public.supply_house_invoices_interest_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.late_invoice_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supply_house_invoices i
     WHERE i.id = NEW.late_invoice_id AND i.supply_house_id = NEW.supply_house_id AND i.document_kind = 'invoice' AND NOT i.is_interest
  ) THEN
    RAISE EXCEPTION 'interest is tied only to a bill from the same supply house' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.is_interest AND TG_OP = 'UPDATE' AND NOT OLD.is_interest AND (
    EXISTS (SELECT 1 FROM public.supply_house_invoice_job_allocations a WHERE a.invoice_id = NEW.id)
    OR EXISTS (SELECT 1 FROM public.supply_house_invoice_bid_allocations b WHERE b.invoice_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'bill % is on a job; take the job off before marking it interest, since interest is kept off every job''s cost', NEW.invoice_number USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.supply_house_invoices_interest_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supply_house_invoices_interest_guard ON public.supply_house_invoices;
CREATE TRIGGER supply_house_invoices_interest_guard
  BEFORE INSERT OR UPDATE OF is_interest, late_invoice_id, supply_house_id ON public.supply_house_invoices
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_invoices_interest_guard();

-- Interest takes no job and no bid: one guard on both allocation tables.
CREATE OR REPLACE FUNCTION public.supply_house_interest_allocation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.supply_house_invoices i WHERE i.id = NEW.invoice_id AND i.is_interest) THEN
    RAISE EXCEPTION 'interest and late fees are not put on a job: they are kept off every job''s cost' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.supply_house_interest_allocation_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supply_house_interest_allocation_guard ON public.supply_house_invoice_job_allocations;
CREATE TRIGGER supply_house_interest_allocation_guard
  BEFORE INSERT OR UPDATE OF invoice_id ON public.supply_house_invoice_job_allocations
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_interest_allocation_guard();

DROP TRIGGER IF EXISTS supply_house_interest_allocation_guard ON public.supply_house_invoice_bid_allocations;
CREATE TRIGGER supply_house_interest_allocation_guard
  BEFORE INSERT OR UPDATE OF invoice_id ON public.supply_house_invoice_bid_allocations
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_interest_allocation_guard();

-- ── Record a payment, with interest ─────────────────────────────────────────────────────────────

-- As 20261116230000, with one more argument:
--   p_interest { "amount": number, "late_invoice_id": uuid?, "invoice_number": text? }: the house
--              added interest or a late fee. It is made as a bill of its own, marked interest and
--              tied to the late bill, and paid whole by this payment.
-- The old ten-argument function is dropped first: two functions of one name would leave the API
-- unable to choose between them.
DROP FUNCTION IF EXISTS public.record_supply_house_payment(uuid, date, numeric, jsonb, text, text, text, text, boolean, jsonb);

CREATE OR REPLACE FUNCTION public.record_supply_house_payment(
  p_supply_house_id uuid,
  p_paid_on date,
  p_amount numeric,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_method text DEFAULT NULL,
  p_method_ref text DEFAULT NULL,
  p_receipt_link text DEFAULT NULL,
  p_memo text DEFAULT NULL,
  p_keep_on_account boolean DEFAULT false,
  p_from_account jsonb DEFAULT '[]'::jsonb,
  p_interest jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_method text := NULLIF(BTRIM(p_method), '');
  v_lines jsonb := COALESCE(p_lines, '[]'::jsonb);
  v_from jsonb := COALESCE(p_from_account, '[]'::jsonb);
  v_line jsonb;
  v_invoice uuid;
  v_line_amount numeric(12,2);
  v_from_payment uuid;
  v_unplaced numeric(12,2);
  v_placed numeric(12,2) := 0;
  v_from_total numeric(12,2) := 0;
  v_count integer := 0;
  v_pay uuid;
  v_name text;
  v_interest numeric(12,2) := 0;
  v_interest_bill uuid;
  v_late uuid;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'only the office records a payment to a supply house' USING ERRCODE = '42501';
  END IF;
  IF p_paid_on IS NULL THEN RAISE EXCEPTION 'a payment needs the day it was sent' USING ERRCODE = '22023'; END IF;
  IF v_amount < 0 THEN RAISE EXCEPTION 'the amount sent cannot be below zero' USING ERRCODE = '22023'; END IF;
  IF v_method IS NOT NULL AND v_method NOT IN ('card', 'ach', 'check', 'cash', 'other') THEN
    RAISE EXCEPTION 'how it was sent is one of card, ach, check, cash or other' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_typeof(v_from) <> 'array' THEN
    RAISE EXCEPTION 'the bills are a list' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = p_supply_house_id) THEN
    RAISE EXCEPTION 'that supply house was not found' USING ERRCODE = 'P0002';
  END IF;

  -- One house's payments at a time: what is open on a bill is read before it is written.
  PERFORM pg_advisory_xact_lock(hashtextextended('supply_house_payment:' || p_supply_house_id::text, 0));

  -- Money already on account goes on its bills first.
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_from) LOOP
    v_from_payment := NULLIF(v_line->>'payment_id', '')::uuid;
    v_invoice := NULLIF(v_line->>'invoice_id', '')::uuid;
    v_line_amount := ROUND((v_line->>'amount')::numeric, 2);
    IF v_from_payment IS NULL OR v_invoice IS NULL THEN
      RAISE EXCEPTION 'money on account names its payment and its bill' USING ERRCODE = '22023';
    END IF;
    IF v_line_amount IS NULL OR v_line_amount <= 0 THEN
      RAISE EXCEPTION 'money on account is placed in amounts above zero' USING ERRCODE = '22023';
    END IF;
    SELECT p.amount - COALESCE((SELECT SUM(l.amount) FROM public.supply_house_payment_lines l WHERE l.payment_id = p.id), 0)
      INTO v_unplaced
      FROM public.supply_house_payments p
     WHERE p.id = v_from_payment AND p.supply_house_id = p_supply_house_id AND p.removed_at IS NULL
       FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'that payment was not found at this supply house' USING ERRCODE = 'P0002'; END IF;
    IF v_line_amount > v_unplaced + 0.005 THEN
      RAISE EXCEPTION 'that payment has % on account and % was asked for', v_unplaced, v_line_amount USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount) VALUES (v_from_payment, v_invoice, v_line_amount);
    v_from_total := v_from_total + v_line_amount;
  END LOOP;

  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_line_amount := ROUND((v_line->>'amount')::numeric, 2);
    IF NULLIF(v_line->>'invoice_id', '') IS NULL THEN RAISE EXCEPTION 'each line names its bill' USING ERRCODE = '22023'; END IF;
    IF v_line_amount IS NULL OR v_line_amount = 0 THEN RAISE EXCEPTION 'each bill''s amount is not zero' USING ERRCODE = '22023'; END IF;
    v_placed := v_placed + v_line_amount;
    v_count := v_count + 1;
  END LOOP;

  -- Interest or a late fee: a bill of its own, paid whole by this payment.
  IF p_interest IS NOT NULL AND jsonb_typeof(p_interest) = 'object' THEN
    v_interest := ROUND(COALESCE((p_interest->>'amount')::numeric, 0), 2);
    IF v_interest <= 0 THEN
      RAISE EXCEPTION 'interest or a late fee needs an amount above zero' USING ERRCODE = '22023';
    END IF;
    v_late := NULLIF(p_interest->>'late_invoice_id', '')::uuid;
    v_placed := v_placed + v_interest;
    v_count := v_count + 1;
  END IF;

  IF v_amount = 0 AND v_count = 0 THEN
    IF v_from_total = 0 THEN RAISE EXCEPTION 'a payment needs an amount or a bill' USING ERRCODE = '22023'; END IF;
    RETURN jsonb_build_object('payment_id', NULL, 'lines', 0, 'placed', 0, 'on_account', 0, 'placed_from_account', v_from_total);
  END IF;
  IF v_placed > v_amount + 0.005 THEN
    RAISE EXCEPTION 'the bills ticked come to % and % was sent', v_placed, v_amount USING ERRCODE = '22023';
  END IF;
  IF v_placed < v_amount - 0.005 AND NOT COALESCE(p_keep_on_account, false) THEN
    RAISE EXCEPTION 'put every dollar on a bill, or keep the % left on account', v_amount - v_placed USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.supply_house_payments
    (supply_house_id, paid_on, amount, method, method_ref, receipt_link, memo, source, created_by, created_by_name)
  VALUES
    (p_supply_house_id, p_paid_on, v_amount, v_method,
     CASE WHEN v_method IS NULL THEN NULL ELSE NULLIF(BTRIM(p_method_ref), '') END,
     NULLIF(BTRIM(p_receipt_link), ''), NULLIF(BTRIM(p_memo), ''), 'recorded', auth.uid(), v_name)
  RETURNING id INTO v_pay;

  -- Credit memos first: each line is checked as it lands, and a payment never places more than it sent.
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) ORDER BY (value->>'amount')::numeric LOOP
    INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount)
    VALUES (v_pay, (v_line->>'invoice_id')::uuid, ROUND((v_line->>'amount')::numeric, 2));
  END LOOP;

  IF v_interest > 0 THEN
    INSERT INTO public.supply_house_invoices (supply_house_id, invoice_number, invoice_date, due_date, amount, document_kind, is_interest, late_invoice_id)
    VALUES (p_supply_house_id, COALESCE(NULLIF(BTRIM(p_interest->>'invoice_number'), ''), 'Interest ' || to_char(p_paid_on, 'YYYY-MM-DD')), p_paid_on, p_paid_on, v_interest, 'invoice', true, v_late)
    RETURNING id INTO v_interest_bill;
    INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount) VALUES (v_pay, v_interest_bill, v_interest);
  END IF;

  RETURN jsonb_build_object('payment_id', v_pay, 'lines', v_count, 'placed', v_placed, 'on_account', v_amount - v_placed, 'placed_from_account', v_from_total, 'interest_invoice_id', v_interest_bill);
END;
$$;

REVOKE ALL ON FUNCTION public.record_supply_house_payment(uuid, date, numeric, jsonb, text, text, text, text, boolean, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_supply_house_payment(uuid, date, numeric, jsonb, text, text, text, text, boolean, jsonb, jsonb) TO authenticated;
