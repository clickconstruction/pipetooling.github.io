SET lock_timeout = '3s';

-- Supply house payments, the ground (the owner, 2026-11-16: the People pay way of recording a
-- payment, on supply house bills; one payment over several bills; a payment moved when the house
-- applies it to another bill).
--
-- Until now a bill was paid or not paid: supply_house_invoices.is_paid, the day in paid_at and a
-- pasted payment_link. Nothing said what was sent, how, or which bills one transfer covered.
--
-- Two additive tables:
--   1. supply_house_payments: one row per money movement to a house (the day, the amount sent, how
--      it was sent and its number, a receipt link). What is not on a bill is on account with the
--      house: amount minus the sum of its lines. Nothing stores that figure twice.
--   2. supply_house_payment_lines: where a payment's money was put, one row per bill. A line on a
--      credit memo is below zero, as the memo is, so a payment's lines add up to what was sent the
--      way a house's statement nets its credits.
--
-- is_paid and paid_at stay where they are, and every reader of them keeps working. They are kept
-- true by the lines, in both directions:
--   - lines change  -> the bill reads paid when its lines cover it, and paid_at is the payment's day;
--   - is_paid is written by hand (Mark paid, the invoice form, an older client still open) -> a
--     payment for what is open is made for it, with the day and no method, and a by-hand
--     "not paid" takes it away again. A payment typed in the window is money that was sent, so a
--     by-hand "not paid" on a bill it covers is refused with the reason.
-- A bill for $0.00 and a credit memo with no line keep their by-hand paid state: nothing was sent.
--
-- Every bill already paid gets one payment "from before" (source 'before') for its whole amount on
-- the day it was marked paid. The backfill skips a bill that already has a line, so it can run twice.
-- It runs set-based, before the two new tables have their triggers, under a lock that holds writes
-- to the bills (not reads) for the moment it takes.
--
-- Idempotent: safe to apply twice.

-- ── 1. Payments ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supply_house_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  -- The day the money was sent, a calendar day in the company's time zone.
  paid_on date NOT NULL,
  -- What was sent. Zero when a credit memo covered the bills and no money moved.
  amount numeric(12,2) NOT NULL,
  -- How it was sent. NULL: not said yet.
  method text,
  -- The method's own number: a confirmation number, a check number, the card's last four.
  method_ref text,
  receipt_link text,
  memo text,
  -- 'recorded': typed in the Record a payment window. 'mark_paid': made by a by-hand Mark paid.
  -- 'before': made by the backfill for a bill paid before payments were rows.
  source text NOT NULL DEFAULT 'recorded',
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  removed_by_name text,
  removed_reason text,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_house_payments_amount_check CHECK (amount >= 0),
  CONSTRAINT supply_house_payments_method_check CHECK (method IS NULL OR method IN ('card', 'ach', 'check', 'cash', 'other')),
  CONSTRAINT supply_house_payments_source_check CHECK (source IN ('recorded', 'mark_paid', 'before'))
);

CREATE INDEX IF NOT EXISTS supply_house_payments_house_idx ON public.supply_house_payments (supply_house_id, paid_on);

COMMENT ON TABLE public.supply_house_payments IS
  'One money movement to a supply house: the day, the amount sent, how and its number. Its lines say which bills it paid; amount minus the lines is on account with the house. source before = made by the backfill for a bill already paid; mark_paid = made by a by-hand Mark paid. A row with removed_at set counts for nothing.';

ALTER TABLE public.supply_house_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read supply house payments" ON public.supply_house_payments;
CREATE POLICY "Office staff can read supply house payments" ON public.supply_house_payments FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can insert supply house payments" ON public.supply_house_payments;
CREATE POLICY "Office staff can insert supply house payments" ON public.supply_house_payments FOR INSERT
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can update supply house payments" ON public.supply_house_payments;
CREATE POLICY "Office staff can update supply house payments" ON public.supply_house_payments FOR UPDATE
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can delete supply house payments" ON public.supply_house_payments;
CREATE POLICY "Office staff can delete supply house payments" ON public.supply_house_payments FOR DELETE
  USING (public.is_office_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_house_payments TO authenticated;

-- ── 2. Lines ────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supply_house_payment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.supply_house_payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  -- Above zero on a bill. Below zero on a credit memo, which is stored below zero too.
  amount numeric(12,2) NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_house_payment_lines_amount_check CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS supply_house_payment_lines_payment_idx ON public.supply_house_payment_lines (payment_id);
CREATE INDEX IF NOT EXISTS supply_house_payment_lines_invoice_idx ON public.supply_house_payment_lines (invoice_id);

COMMENT ON TABLE public.supply_house_payment_lines IS
  'Where a supply house payment was put: one row per bill. A bill reads paid when the lines of its live payments cover its amount. A line on a credit memo is below zero. A payment''s lines never add up to more than it sent.';

ALTER TABLE public.supply_house_payment_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read supply house payment lines" ON public.supply_house_payment_lines;
CREATE POLICY "Office staff can read supply house payment lines" ON public.supply_house_payment_lines FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can insert supply house payment lines" ON public.supply_house_payment_lines;
CREATE POLICY "Office staff can insert supply house payment lines" ON public.supply_house_payment_lines FOR INSERT
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can update supply house payment lines" ON public.supply_house_payment_lines;
CREATE POLICY "Office staff can update supply house payment lines" ON public.supply_house_payment_lines FOR UPDATE
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can delete supply house payment lines" ON public.supply_house_payment_lines;
CREATE POLICY "Office staff can delete supply house payment lines" ON public.supply_house_payment_lines FOR DELETE
  USING (public.is_office_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supply_house_payment_lines TO authenticated;

-- ── 3. A bill reads paid when its lines cover it ────────────────────────────────────────────────

-- Sets one bill's is_paid and paid_at from the lines of its live payments. A bill above zero is
-- paid when its lines reach its amount; a credit memo when its lines, below zero, reach its amount.
-- A bill for nothing is left alone. Half a cent is dust, as everywhere else in the app.
--
-- While it writes the bill it sets supply_house_payments.syncing for the transaction, so the
-- trigger on the bill can tell this write from one made by hand.
-- The bill is locked FOR NO KEY UPDATE: a line's foreign key (KEY SHARE) does not wait on it.
-- SECURITY DEFINER: the books are kept whoever made the edit that led here.
CREATE OR REPLACE FUNCTION public.supply_house_invoice_sync_paid(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
  v_is_paid boolean;
  v_paid_at timestamptz;
  v_sum numeric;
  v_last date;
  v_cover boolean;
  v_stamp timestamptz;
BEGIN
  SELECT amount, is_paid, paid_at INTO v_amount, v_is_paid, v_paid_at
    FROM public.supply_house_invoices WHERE id = p_invoice_id FOR NO KEY UPDATE;
  IF NOT FOUND OR v_amount = 0 THEN RETURN; END IF;

  SELECT COALESCE(SUM(l.amount), 0), MAX(p.paid_on) INTO v_sum, v_last
    FROM public.supply_house_payment_lines l
    JOIN public.supply_house_payments p ON p.id = l.payment_id
   WHERE l.invoice_id = p_invoice_id AND p.removed_at IS NULL;

  IF v_amount > 0 THEN v_cover := v_sum >= v_amount - 0.005;
  ELSE v_cover := v_sum <= v_amount + 0.005;
  END IF;

  IF v_cover THEN
    -- Noon on the payment's day, as the invoice form writes a typed paid day.
    v_stamp := (v_last + time '12:00') AT TIME ZONE 'America/Chicago';
    IF NOT v_is_paid THEN
      PERFORM set_config('supply_house_payments.syncing', '1', true);
      UPDATE public.supply_house_invoices SET is_paid = true, paid_at = v_stamp WHERE id = p_invoice_id;
      PERFORM set_config('supply_house_payments.syncing', '', true);
    ELSIF v_paid_at IS NULL OR (v_paid_at AT TIME ZONE 'America/Chicago')::date <> v_last THEN
      PERFORM set_config('supply_house_payments.syncing', '1', true);
      UPDATE public.supply_house_invoices SET paid_at = v_stamp WHERE id = p_invoice_id;
      PERFORM set_config('supply_house_payments.syncing', '', true);
    END IF;
  ELSIF v_is_paid THEN
    PERFORM set_config('supply_house_payments.syncing', '1', true);
    UPDATE public.supply_house_invoices SET is_paid = false WHERE id = p_invoice_id;
    PERFORM set_config('supply_house_payments.syncing', '', true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_house_invoice_sync_paid(uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. A line is checked, and its bill is read again ────────────────────────────────────────────

-- Before a line lands: it stays on its payment, its bill is one of the payment's house, and its
-- sign is its bill's. The bill and the payment are locked first (FOR NO KEY UPDATE), so two lines
-- on one bill or one payment land one after the other and each check reads what the other wrote.
CREATE OR REPLACE FUNCTION public.supply_house_payment_lines_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay_house uuid;
  v_bill_house uuid;
  v_bill_amount numeric;
  v_bill_paid boolean;
  v_number text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.payment_id IS DISTINCT FROM OLD.payment_id THEN
    RAISE EXCEPTION 'a line stays on its payment' USING ERRCODE = '22023';
  END IF;
  NEW.amount := ROUND(NEW.amount, 2);
  SELECT supply_house_id, amount, invoice_number, is_paid INTO v_bill_house, v_bill_amount, v_number, v_bill_paid
    FROM public.supply_house_invoices WHERE id = NEW.invoice_id FOR NO KEY UPDATE;
  IF v_bill_house IS NULL THEN RAISE EXCEPTION 'that bill was not found' USING ERRCODE = 'P0002'; END IF;
  SELECT supply_house_id INTO v_pay_house FROM public.supply_house_payments WHERE id = NEW.payment_id FOR NO KEY UPDATE;
  IF v_pay_house IS DISTINCT FROM v_bill_house THEN
    RAISE EXCEPTION 'bill % belongs to another supply house', v_number USING ERRCODE = '22023';
  END IF;
  IF v_bill_amount = 0 THEN
    RAISE EXCEPTION 'bill % is for nothing, so no payment goes on it', v_number USING ERRCODE = '22023';
  END IF;
  IF (v_bill_amount > 0) <> (NEW.amount > 0) THEN
    RAISE EXCEPTION 'on %, a bill takes an amount above zero and a credit memo an amount below zero', v_number USING ERRCODE = '22023';
  END IF;
  -- A credit memo marked used by hand has nothing left for a payment to use.
  IF TG_OP = 'INSERT' AND v_bill_amount < 0 AND v_bill_paid AND NOT EXISTS (
    SELECT 1 FROM public.supply_house_payment_lines l
      JOIN public.supply_house_payments p ON p.id = l.payment_id
     WHERE l.invoice_id = NEW.invoice_id AND p.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'credit memo % is already marked used', v_number USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_house_payment_lines_guard() FROM PUBLIC, anon, authenticated;

-- After a line lands, changes or goes: no bill carries more than it is for, no payment places more
-- than it sent, and each bill touched is read again. A by-hand payment whose one line is gone goes
-- with it.
CREATE OR REPLACE FUNCTION public.supply_house_payment_lines_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment uuid := COALESCE(NEW.payment_id, OLD.payment_id);
  v_pay_amount numeric;
  v_removed timestamptz;
  v_source text;
  v_method text;
  v_placed numeric;
  v_bill_amount numeric;
  v_number text;
  v_on_bill numeric;
BEGIN
  SELECT amount, removed_at, source, method INTO v_pay_amount, v_removed, v_source, v_method
    FROM public.supply_house_payments WHERE id = v_payment;

  IF FOUND THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_placed FROM public.supply_house_payment_lines WHERE payment_id = v_payment;
    IF v_placed > v_pay_amount + 0.005 THEN
      RAISE EXCEPTION 'the bills on this payment would come to % and % was sent', v_placed, v_pay_amount USING ERRCODE = '22023';
    END IF;
    IF TG_OP <> 'DELETE' AND v_removed IS NULL THEN
      SELECT amount, invoice_number INTO v_bill_amount, v_number FROM public.supply_house_invoices WHERE id = NEW.invoice_id;
      SELECT COALESCE(SUM(l.amount), 0) INTO v_on_bill
        FROM public.supply_house_payment_lines l
        JOIN public.supply_house_payments p ON p.id = l.payment_id
       WHERE l.invoice_id = NEW.invoice_id AND p.removed_at IS NULL;
      IF (v_bill_amount > 0 AND v_on_bill > v_bill_amount + 0.005) OR (v_bill_amount < 0 AND v_on_bill < v_bill_amount - 0.005) THEN
        RAISE EXCEPTION 'bill % is for % and its payments would come to %', v_number, v_bill_amount, v_on_bill USING ERRCODE = '22023';
      END IF;
    END IF;
    IF TG_OP = 'DELETE' AND v_source IN ('mark_paid', 'before') AND v_method IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.supply_house_payment_lines WHERE payment_id = v_payment) THEN
      DELETE FROM public.supply_house_payments WHERE id = v_payment;
    END IF;
  END IF;

  IF TG_OP <> 'INSERT' THEN PERFORM public.supply_house_invoice_sync_paid(OLD.invoice_id); END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id) THEN
    PERFORM public.supply_house_invoice_sync_paid(NEW.invoice_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_house_payment_lines_sync() FROM PUBLIC, anon, authenticated;

-- ── 5. A payment is checked, and its bills are read again ───────────────────────────────────────

-- Its amount never drops under its lines, and it stays with its bills' house. A removed payment is
-- put back only whole: every bill it paid must still be at its house with room for its line.
CREATE OR REPLACE FUNCTION public.supply_house_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placed numeric;
  v_others numeric;
  r record;
BEGIN
  NEW.updated_at := now();
  NEW.amount := ROUND(NEW.amount, 2);
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_placed FROM public.supply_house_payment_lines WHERE payment_id = NEW.id;
    IF v_placed > NEW.amount + 0.005 THEN
      RAISE EXCEPTION 'this payment has % on its bills, so it cannot read % sent', v_placed, NEW.amount USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.supply_house_id IS DISTINCT FROM OLD.supply_house_id AND EXISTS (
    SELECT 1 FROM public.supply_house_payment_lines l
      JOIN public.supply_house_invoices i ON i.id = l.invoice_id
     WHERE l.payment_id = NEW.id AND i.supply_house_id <> NEW.supply_house_id
  ) THEN
    RAISE EXCEPTION 'a payment stays with the supply house its bills belong to' USING ERRCODE = '22023';
  END IF;
  IF OLD.removed_at IS NOT NULL AND NEW.removed_at IS NULL THEN
    FOR r IN
      SELECT i.id, i.invoice_number, i.amount, i.supply_house_id, SUM(l.amount) AS mine
        FROM public.supply_house_payment_lines l
        JOIN public.supply_house_invoices i ON i.id = l.invoice_id
       WHERE l.payment_id = NEW.id
       GROUP BY i.id
    LOOP
      IF r.supply_house_id <> NEW.supply_house_id THEN
        RAISE EXCEPTION 'bill % has moved to another supply house since this payment was removed', r.invoice_number USING ERRCODE = '22023';
      END IF;
      SELECT COALESCE(SUM(l.amount), 0) INTO v_others
        FROM public.supply_house_payment_lines l
        JOIN public.supply_house_payments p ON p.id = l.payment_id
       WHERE l.invoice_id = r.id AND p.removed_at IS NULL AND p.id <> NEW.id;
      IF r.amount = 0 OR (r.amount > 0 AND v_others + r.mine > r.amount + 0.005) OR (r.amount < 0 AND v_others + r.mine < r.amount - 0.005) THEN
        RAISE EXCEPTION 'bill % has been paid or changed since this payment was removed, so the payment cannot be put back as it was', r.invoice_number USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_house_payments_guard() FROM PUBLIC, anon, authenticated;

-- A payment removed, put back, or moved to another day: each of its bills is read again.
CREATE OR REPLACE FUNCTION public.supply_house_payments_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice uuid;
BEGIN
  IF NEW.removed_at IS DISTINCT FROM OLD.removed_at OR NEW.paid_on IS DISTINCT FROM OLD.paid_on THEN
    FOR v_invoice IN SELECT DISTINCT invoice_id FROM public.supply_house_payment_lines WHERE payment_id = NEW.id LOOP
      PERFORM public.supply_house_invoice_sync_paid(v_invoice);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_house_payments_sync() FROM PUBLIC, anon, authenticated;

-- ── 6. A bill written by hand makes, follows or takes away its payment ──────────────────────────

-- Mark paid, the invoice form's Paid status and any client that still writes is_paid land here.
-- A write made by the sync above is told apart by supply_house_payments.syncing and passes through.
--
-- A "press payment" is one a by-hand Mark paid (or the backfill) made and nobody has finished:
-- live, source mark_paid or before, no method, one line. It stands for "this bill is paid whole",
-- so it follows its bill's amount, paid day and house, and goes when the bill is marked not paid.
--
-- A typed payment is money that was sent, so a by-hand write never unmakes it:
--   - marking not paid a bill that typed payments still cover is refused, with the reason;
--   - a bill's amount lowered under its typed lines trims them, newest first, and the difference
--     waits on account with the house;
--   - a bill set to $0.00, or turned from an invoice into a credit memo, lets go of its lines;
--   - a credit memo a payment has used cannot be marked unused, lowered or turned into an invoice.
CREATE OR REPLACE FUNCTION public.supply_house_invoices_payment_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unmark boolean := TG_OP = 'UPDATE' AND OLD.is_paid AND NOT NEW.is_paid;
  v_flip boolean := TG_OP = 'UPDATE' AND OLD.amount <> 0 AND (NEW.amount = 0 OR (OLD.amount > 0) <> (NEW.amount > 0));
  v_sum numeric;
  v_count integer;
  v_press uuid;
  v_press_amount numeric;
  v_over numeric;
  v_day date;
  v_name text;
  v_pay uuid;
  r record;
BEGIN
  IF current_setting('supply_house_payments.syncing', true) = '1' THEN RETURN NULL; END IF;

  -- A bill moved to another house takes its press payment with it. A typed payment is of one house.
  IF TG_OP = 'UPDATE' AND NEW.supply_house_id IS DISTINCT FROM OLD.supply_house_id THEN
    IF EXISTS (
      SELECT 1 FROM public.supply_house_payment_lines l
        JOIN public.supply_house_payments p ON p.id = l.payment_id
       WHERE l.invoice_id = NEW.id AND p.removed_at IS NULL
         AND NOT (p.source IN ('mark_paid', 'before') AND p.method IS NULL
                  AND (SELECT count(*) FROM public.supply_house_payment_lines x WHERE x.payment_id = p.id) = 1)
    ) THEN
      RAISE EXCEPTION 'bill % has a payment on it; take the payment off before moving the bill to another supply house', NEW.invoice_number USING ERRCODE = '22023';
    END IF;
    UPDATE public.supply_house_payments p SET supply_house_id = NEW.supply_house_id
     WHERE p.removed_at IS NULL
       AND p.id IN (SELECT payment_id FROM public.supply_house_payment_lines WHERE invoice_id = NEW.id);
  END IF;

  -- A credit memo a payment has used stays a credit memo for that much.
  IF v_flip AND EXISTS (
    SELECT 1 FROM public.supply_house_payment_lines l
      JOIN public.supply_house_payments p ON p.id = l.payment_id
     WHERE l.invoice_id = NEW.id AND p.removed_at IS NULL AND l.amount < 0
  ) THEN
    RAISE EXCEPTION 'credit memo % was used on a payment; take it off the payment before changing it', NEW.invoice_number USING ERRCODE = '22023';
  END IF;

  -- Marked not paid by hand, set to nothing, or turned into the other kind of paper: its press payments go.
  IF v_unmark OR v_flip THEN
    DELETE FROM public.supply_house_payments p
     WHERE p.removed_at IS NULL AND p.source IN ('mark_paid', 'before') AND p.method IS NULL
       AND EXISTS (SELECT 1 FROM public.supply_house_payment_lines l WHERE l.payment_id = p.id AND l.invoice_id = NEW.id)
       AND (SELECT count(*) FROM public.supply_house_payment_lines x WHERE x.payment_id = p.id) = 1;
  END IF;
  IF v_flip THEN
    -- What typed payments had put on it waits on account with the house.
    DELETE FROM public.supply_house_payment_lines l
     USING public.supply_house_payments p
     WHERE p.id = l.payment_id AND l.invoice_id = NEW.id AND p.removed_at IS NULL;
    -- A paper with no payment on it keeps the paid state it was written with.
    IF NEW.amount <= 0 AND NEW.is_paid THEN
      PERFORM set_config('supply_house_payments.syncing', '1', true);
      UPDATE public.supply_house_invoices SET is_paid = true, paid_at = COALESCE(NEW.paid_at, now()) WHERE id = NEW.id AND NOT is_paid;
      PERFORM set_config('supply_house_payments.syncing', '', true);
    END IF;
  END IF;
  IF NEW.amount = 0 THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(l.amount), 0), count(*) INTO v_sum, v_count
    FROM public.supply_house_payment_lines l
    JOIN public.supply_house_payments p ON p.id = l.payment_id
   WHERE l.invoice_id = NEW.id AND p.removed_at IS NULL;

  -- A credit memo: by hand it is marked as it always was. Once a payment has used it, the payment owns it.
  IF NEW.amount < 0 THEN
    IF v_count = 0 THEN RETURN NULL; END IF;
    IF v_unmark AND v_sum <= NEW.amount + 0.005 THEN
      RAISE EXCEPTION 'credit memo % was used on a payment; open the payment to take it off', NEW.invoice_number USING ERRCODE = '22023';
    END IF;
    IF v_sum < NEW.amount - 0.005 THEN
      RAISE EXCEPTION 'credit memo % was used on a payment for %; take it off the payment before lowering it', NEW.invoice_number, -v_sum USING ERRCODE = '22023';
    END IF;
    PERFORM public.supply_house_invoice_sync_paid(NEW.id);
    RETURN NULL;
  END IF;

  -- Marked not paid by hand while typed payments still cover it: refused. The money was sent.
  IF v_unmark AND v_sum >= NEW.amount - 0.005 THEN
    RAISE EXCEPTION 'bill % was paid by a payment recorded for this supply house; remove that payment, or take the bill off it, instead of marking the bill unpaid', NEW.invoice_number USING ERRCODE = '22023';
  END IF;

  -- A press payment that is the bill's only line follows its amount and its paid day.
  IF NEW.is_paid AND v_count = 1 THEN
    SELECT p.id, p.amount INTO v_press, v_press_amount
      FROM public.supply_house_payments p
      JOIN public.supply_house_payment_lines l ON l.payment_id = p.id
     WHERE l.invoice_id = NEW.id AND p.removed_at IS NULL
       AND p.source IN ('mark_paid', 'before') AND p.method IS NULL
       AND (SELECT count(*) FROM public.supply_house_payment_lines x WHERE x.payment_id = p.id) = 1;
    IF v_press IS NOT NULL THEN
      IF NEW.amount > v_press_amount THEN
        UPDATE public.supply_house_payments SET amount = NEW.amount WHERE id = v_press;
        UPDATE public.supply_house_payment_lines SET amount = NEW.amount WHERE payment_id = v_press;
      ELSIF NEW.amount < v_press_amount THEN
        UPDATE public.supply_house_payment_lines SET amount = NEW.amount WHERE payment_id = v_press;
        UPDATE public.supply_house_payments SET amount = NEW.amount WHERE id = v_press;
      END IF;
      v_sum := NEW.amount;
      v_day := (NEW.paid_at AT TIME ZONE 'America/Chicago')::date;
      IF v_day IS NOT NULL THEN
        UPDATE public.supply_house_payments SET paid_on = v_day WHERE id = v_press AND paid_on <> v_day;
      END IF;
    END IF;
  END IF;

  -- The amount lowered under its lines: they are trimmed, newest payment first, and the difference
  -- waits on account. Each line but the last is taken off whole, so no check sees a half-way state.
  IF v_sum > NEW.amount + 0.005 THEN
    v_over := v_sum - NEW.amount;
    FOR r IN
      SELECT l.id, l.amount
        FROM public.supply_house_payment_lines l
        JOIN public.supply_house_payments p ON p.id = l.payment_id
       WHERE l.invoice_id = NEW.id AND p.removed_at IS NULL
       ORDER BY p.paid_on DESC, l.created_at DESC, l.id DESC
    LOOP
      EXIT WHEN v_over <= 0.005;
      IF r.amount <= v_over + 0.005 THEN
        DELETE FROM public.supply_house_payment_lines WHERE id = r.id;
        v_over := v_over - r.amount;
      ELSE
        UPDATE public.supply_house_payment_lines SET amount = r.amount - v_over WHERE id = r.id;
        v_over := 0;
      END IF;
    END LOOP;
    v_sum := NEW.amount;
  END IF;

  -- Marked paid by hand (or a paper that had no payment and now is a bill): a payment for what is
  -- open, on the paid day, with no method yet.
  IF NEW.is_paid AND v_sum < NEW.amount - 0.005 AND (TG_OP = 'INSERT' OR NOT OLD.is_paid OR v_count = 0) THEN
    v_day := COALESCE((NEW.paid_at AT TIME ZONE 'America/Chicago')::date, (now() AT TIME ZONE 'America/Chicago')::date);
    SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
    INSERT INTO public.supply_house_payments (supply_house_id, paid_on, amount, source, receipt_link, created_by, created_by_name)
    VALUES (NEW.supply_house_id, v_day, NEW.amount - v_sum, 'mark_paid', NULLIF(BTRIM(NEW.payment_link), ''), auth.uid(), v_name)
    RETURNING id INTO v_pay;
    INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount, created_by)
    VALUES (v_pay, NEW.id, NEW.amount - v_sum, auth.uid());
  END IF;

  PERFORM public.supply_house_invoice_sync_paid(NEW.id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_house_invoices_payment_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supply_house_invoices_payment_sync ON public.supply_house_invoices;
CREATE TRIGGER supply_house_invoices_payment_sync
  AFTER INSERT OR UPDATE OF is_paid, amount, paid_at, supply_house_id ON public.supply_house_invoices
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_invoices_payment_sync();

-- ── 7. Record a payment ─────────────────────────────────────────────────────────────────────────

-- One money movement, in one statement: the payment and a line per bill.
--   p_lines        [{ "invoice_id": uuid, "amount": number }, ...]: the new money. A credit memo's
--                  amount is below zero, so the lines add up to what was sent.
--   p_from_account [{ "payment_id": uuid, "invoice_id": uuid, "amount": number }, ...]: money an
--                  earlier payment left on account with this house, put on a bill now. It becomes a
--                  line of that earlier payment, so no money is counted twice.
-- The lines may come to less than was sent only when p_keep_on_account says the rest waits with
-- the house. With no new money and no new line, only the money on account is placed and no payment
-- row is made.
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
  p_from_account jsonb DEFAULT '[]'::jsonb
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

  RETURN jsonb_build_object('payment_id', v_pay, 'lines', v_count, 'placed', v_placed, 'on_account', v_amount - v_placed, 'placed_from_account', v_from_total);
END;
$$;

REVOKE ALL ON FUNCTION public.record_supply_house_payment(uuid, date, numeric, jsonb, text, text, text, text, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_supply_house_payment(uuid, date, numeric, jsonb, text, text, text, text, boolean, jsonb) TO authenticated;


-- ── 8. Every bill already paid gets its payment "from before" ───────────────────────────────────

-- One payment per paid bill, for the bill's whole amount, on the day it was marked paid, carrying
-- the receipt link pasted on it. A bill that already has a line is skipped, so a second run does
-- nothing. A paid credit memo and a paid bill for $0.00 keep their by-hand state and get no row.
--
-- It runs before the triggers on the two new tables exist, as two set-based inserts, so thousands
-- of bills take a moment and no bill row is read back or written. Writes to the bills wait while
-- it runs (the lock below; reads do not), so no bill is marked paid half-way through.
DO $$
BEGIN
  LOCK TABLE public.supply_house_invoices IN SHARE ROW EXCLUSIVE MODE;

  CREATE TEMP TABLE supply_house_payments_backfill ON COMMIT DROP AS
    SELECT i.id AS invoice_id, gen_random_uuid() AS payment_id, i.supply_house_id, i.amount,
           NULLIF(BTRIM(i.payment_link), '') AS receipt_link,
           COALESCE((i.paid_at AT TIME ZONE 'America/Chicago')::date, (i.updated_at AT TIME ZONE 'America/Chicago')::date, i.invoice_date) AS paid_on
      FROM public.supply_house_invoices i
     WHERE i.is_paid AND i.amount > 0
       AND NOT EXISTS (SELECT 1 FROM public.supply_house_payment_lines l WHERE l.invoice_id = i.id);

  INSERT INTO public.supply_house_payments (id, supply_house_id, paid_on, amount, source, receipt_link, created_by)
  SELECT payment_id, supply_house_id, paid_on, amount, 'before', receipt_link, NULL FROM supply_house_payments_backfill;

  INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount, created_by)
  SELECT payment_id, invoice_id, amount, NULL FROM supply_house_payments_backfill;

  DROP TABLE supply_house_payments_backfill;
END;
$$;

-- ── 9. The triggers on the two new tables, now that the backfill is in ──────────────────────────

DROP TRIGGER IF EXISTS supply_house_payment_lines_guard ON public.supply_house_payment_lines;
CREATE TRIGGER supply_house_payment_lines_guard
  BEFORE INSERT OR UPDATE ON public.supply_house_payment_lines
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_payment_lines_guard();

DROP TRIGGER IF EXISTS supply_house_payment_lines_sync ON public.supply_house_payment_lines;
CREATE TRIGGER supply_house_payment_lines_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.supply_house_payment_lines
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_payment_lines_sync();

DROP TRIGGER IF EXISTS supply_house_payments_guard ON public.supply_house_payments;
CREATE TRIGGER supply_house_payments_guard
  BEFORE UPDATE ON public.supply_house_payments
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_payments_guard();

DROP TRIGGER IF EXISTS supply_house_payments_sync ON public.supply_house_payments;
CREATE TRIGGER supply_house_payments_sync
  AFTER UPDATE ON public.supply_house_payments
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_payments_sync();

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
