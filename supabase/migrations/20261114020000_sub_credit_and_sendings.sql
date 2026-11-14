SET lock_timeout = '3s';

-- A sub's credit, and one sending across several sheets (punch list #347; the owner, 2026-11-13:
-- "overpayment -> credit").
--
-- Until now the Record payment window refused an amount past what a sheet still owed, and a sheet
-- paid past its total read "Over" with nowhere for the extra to go. Card #350 found the other half
-- of the same shape: one check that pays several sheets was typed as one payment per sheet, with
-- nothing saying they were one check.
--
-- Three additive pieces:
--   1. sub_payment_sendings: one row per money movement to a sub, with a number that is never
--      reused (a sequence, so a rolled-back insert leaves a gap and never a repeat). A payment row
--      points at its sending. It holds no amount: what was sent is the sum of its rows and the
--      credit kept with it, so an edit to a row can never leave the two out of step.
--   2. sub_credit_entries: a small ledger per person. Above zero is credit kept (the part of a
--      sending past what the sheets needed). Below zero is credit used (a payment row made from the
--      credit on another sheet, method 'credit'). A person's credit is the sum.
--   3. Guards, so the ledger cannot drift: a payment that carries a credit stays on its sheet, a
--      payment made from a credit keeps its amount, a removal puts used credit back and refuses to
--      take away credit that was already spent, and an undo re-creates what the removal took.
--
-- Every payment row recorded before this has no sending and no entry, and reads as it did.
-- The sub portal reads its payment columns by name and names none of these.
-- Idempotent: safe to apply twice.

-- ── 1. Sendings ─────────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.sub_payment_sending_number_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.sub_payment_sendings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint NOT NULL DEFAULT nextval('public.sub_payment_sending_number_seq'),
  -- The roster person the money went to, when the sheet's sub is on the roster.
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sub_payment_sendings_number_key UNIQUE (number)
);

ALTER SEQUENCE public.sub_payment_sending_number_seq OWNED BY public.sub_payment_sendings.number;

COMMENT ON TABLE public.sub_payment_sendings IS
  'v2.7235: one money movement to a sub (one check, one Zelle), which may pay several sheets. number is never reused. It stores no amount: sent = the sum of its people_labor_job_payments rows plus the sub_credit_entries kept with it.';

ALTER TABLE public.sub_payment_sendings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read sub payment sendings" ON public.sub_payment_sendings;
CREATE POLICY "Office staff can read sub payment sendings" ON public.sub_payment_sendings FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can write sub payment sendings" ON public.sub_payment_sendings;
CREATE POLICY "Office staff can write sub payment sendings" ON public.sub_payment_sendings FOR INSERT
  WITH CHECK (public.is_office_staff());

GRANT SELECT, INSERT ON public.sub_payment_sendings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.sub_payment_sending_number_seq TO authenticated;

ALTER TABLE public.people_labor_job_payments
  ADD COLUMN IF NOT EXISTS sending_id uuid REFERENCES public.sub_payment_sendings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.people_labor_job_payments.sending_id IS
  'The sending this row is part of (v2.7235). Rows that share one were one check or one transfer. NULL on a row recorded before sendings, and on a payment made from a credit.';

CREATE INDEX IF NOT EXISTS people_labor_job_payments_sending_idx
  ON public.people_labor_job_payments (sending_id) WHERE sending_id IS NOT NULL;

-- 'credit' joins the methods: a payment made from a credit, where no money left the bank.
ALTER TABLE public.people_labor_job_payments DROP CONSTRAINT IF EXISTS people_labor_job_payments_method_check;
ALTER TABLE public.people_labor_job_payments
  ADD CONSTRAINT people_labor_job_payments_method_check
  CHECK (method IS NULL OR method IN ('check', 'zelle', 'mercury', 'cashapp', 'apple_pay', 'cash', 'client_direct', 'other', 'credit'));

-- ── 2. The credit ledger ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sub_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  -- Above zero: credit kept. Below zero: credit used.
  amount numeric(12,2) NOT NULL,
  -- Kept: the payment row the extra came in with. Used: the payment row the credit paid for.
  -- The entry goes when its row goes, so a removed use puts the credit back.
  payment_id uuid REFERENCES public.people_labor_job_payments(id) ON DELETE CASCADE,
  sending_id uuid REFERENCES public.sub_payment_sendings(id) ON DELETE SET NULL,
  note text,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sub_credit_entries_amount_check CHECK (amount <> 0)
);

CREATE INDEX IF NOT EXISTS sub_credit_entries_person_idx ON public.sub_credit_entries (person_id, created_at);
-- A payment row carries at most one entry.
CREATE UNIQUE INDEX IF NOT EXISTS sub_credit_entries_payment_key ON public.sub_credit_entries (payment_id) WHERE payment_id IS NOT NULL;

COMMENT ON TABLE public.sub_credit_entries IS
  'v2.7235: a sub''s credit as a ledger. amount above zero is credit kept from a sending that was more than its sheets needed; below zero is credit used on a sheet (that payment row has method credit). A person''s credit is the sum of their rows.';

ALTER TABLE public.sub_credit_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read sub credit entries" ON public.sub_credit_entries;
CREATE POLICY "Office staff can read sub credit entries" ON public.sub_credit_entries FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can write sub credit entries" ON public.sub_credit_entries;
CREATE POLICY "Office staff can write sub credit entries" ON public.sub_credit_entries FOR INSERT
  WITH CHECK (public.is_office_staff());

GRANT SELECT, INSERT ON public.sub_credit_entries TO authenticated;

-- The removal's snapshot carries the sending and the credit, so its undo puts both back.
ALTER TABLE public.people_labor_job_payment_events
  ADD COLUMN IF NOT EXISTS sending_id uuid,
  ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS credit_person_id uuid;

COMMENT ON COLUMN public.people_labor_job_payment_events.credit_amount IS
  'Snapshot (v2.7235) of the credit entry the removed payment carried: above zero it had kept that much credit, below zero it was made from that much. NULL when it carried none.';

-- One person's credit ledger at a time: a use and a removal read the balance before they write.
CREATE OR REPLACE FUNCTION public.sub_credit_lock(p_person_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('sub_credit:' || p_person_id::text, 0));
$$;

-- ── 3. Record a sending ─────────────────────────────────────────────────────────────────────────

-- One money movement, in one statement: a payment row per sheet, all tied to one numbered
-- sending, and whatever was sent past those sheets kept as the person's credit.
-- p_lines is [{ "job_id": uuid, "amount": number }, ...], each amount above zero.
CREATE OR REPLACE FUNCTION public.record_sub_sending(
  p_person_id uuid,
  p_lines jsonb,
  p_credit numeric DEFAULT 0,
  p_payment_date date DEFAULT NULL,
  p_method text DEFAULT NULL,
  p_method_ref text DEFAULT NULL,
  p_memo text DEFAULT NULL,
  p_hidden_from_sub boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_credit numeric(12,2) := ROUND(COALESCE(p_credit, 0), 2);
  v_sending uuid;
  v_number bigint;
  v_line jsonb;
  v_job uuid;
  v_amount numeric(12,2);
  v_next integer;
  v_pay uuid;
  v_first uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'a sending needs at least one sheet' USING ERRCODE = '22023';
  END IF;
  IF v_credit < 0 THEN RAISE EXCEPTION 'a credit cannot be below zero' USING ERRCODE = '22023'; END IF;
  IF v_credit > 0 AND p_person_id IS NULL THEN
    RAISE EXCEPTION 'a credit needs a person on the roster to belong to' USING ERRCODE = '22023';
  END IF;
  IF p_method = 'credit' THEN
    RAISE EXCEPTION 'a sending is money that left; use apply_sub_credit to pay from a credit' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sub_payment_sendings (person_id) VALUES (p_person_id) RETURNING id, number INTO v_sending, v_number;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_job := NULLIF(v_line->>'job_id', '')::uuid;
    v_amount := ROUND((v_line->>'amount')::numeric, 2);
    IF v_job IS NULL THEN RAISE EXCEPTION 'each line names its sheet' USING ERRCODE = '22023'; END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'each sheet''s amount must be above zero' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.people_labor_jobs WHERE id = v_job) THEN
      RAISE EXCEPTION 'sheet % not found', v_job USING ERRCODE = 'P0002';
    END IF;
    SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next FROM public.people_labor_job_payments WHERE job_id = v_job;
    INSERT INTO public.people_labor_job_payments
      (job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, method, method_ref, sending_id)
    VALUES
      (v_job, v_amount, NULLIF(BTRIM(p_memo), ''), p_payment_date, COALESCE(p_hidden_from_sub, false), v_next,
       NULLIF(BTRIM(p_method), ''), CASE WHEN NULLIF(BTRIM(p_method), '') IS NULL THEN NULL ELSE NULLIF(BTRIM(p_method_ref), '') END, v_sending)
    RETURNING id INTO v_pay;
    IF v_first IS NULL THEN v_first := v_pay; END IF;
    v_ids := v_ids || v_pay;
  END LOOP;

  IF v_credit > 0 THEN
    INSERT INTO public.sub_credit_entries (person_id, amount, payment_id, sending_id)
    VALUES (p_person_id, v_credit, v_first, v_sending);
  END IF;

  RETURN jsonb_build_object('sending_id', v_sending, 'number', v_number, 'payment_ids', to_jsonb(v_ids), 'credit', v_credit);
END;
$$;

-- Pay a sheet from a person's credit: a payment row with method 'credit' and the entry that takes
-- it off their credit, together. Refused past the credit they have.
CREATE OR REPLACE FUNCTION public.apply_sub_credit(
  p_person_id uuid,
  p_job_id uuid,
  p_amount numeric,
  p_payment_date date DEFAULT NULL,
  p_memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(12,2) := ROUND(p_amount, 2);
  v_balance numeric(12,2);
  v_next integer;
  v_pay uuid;
BEGIN
  IF p_person_id IS NULL THEN RAISE EXCEPTION 'a credit belongs to a person' USING ERRCODE = '22023'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'the amount must be above zero' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people_labor_jobs WHERE id = p_job_id) THEN
    RAISE EXCEPTION 'sheet % not found', p_job_id USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.sub_credit_lock(p_person_id);
  SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.sub_credit_entries WHERE person_id = p_person_id;
  IF v_amount > v_balance THEN
    RAISE EXCEPTION 'their credit is % and % was asked for', v_balance, v_amount USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next FROM public.people_labor_job_payments WHERE job_id = p_job_id;
  INSERT INTO public.people_labor_job_payments (job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, method)
  VALUES (p_job_id, v_amount, NULLIF(BTRIM(p_memo), ''), p_payment_date, false, v_next, 'credit')
  RETURNING id INTO v_pay;
  INSERT INTO public.sub_credit_entries (person_id, amount, payment_id) VALUES (p_person_id, -v_amount, v_pay);
  RETURN v_pay;
END;
$$;

-- ── 4. Guards ───────────────────────────────────────────────────────────────────────────────────

-- A payment made from a credit keeps its amount, its method and its sheet, and a payment that kept
-- a credit keeps its sheet: either change would leave the credit ledger saying something else.
-- SECURITY DEFINER so the check reads the entries whoever makes the edit.
CREATE OR REPLACE FUNCTION public.guard_sub_credit_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry numeric(12,2);
BEGIN
  SELECT amount INTO v_entry FROM public.sub_credit_entries WHERE payment_id = OLD.id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    RAISE EXCEPTION 'this payment carries a credit and stays on its sheet' USING ERRCODE = '22023';
  END IF;
  IF v_entry < 0 AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.method IS DISTINCT FROM OLD.method) THEN
    RAISE EXCEPTION 'a payment made from a credit keeps its amount; remove it to put the credit back' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_sub_credit_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_sub_credit_payment ON public.people_labor_job_payments;
CREATE TRIGGER guard_sub_credit_payment
  BEFORE UPDATE OF amount, method, job_id ON public.people_labor_job_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_sub_credit_payment();

-- Move: as 20260917140000, and refused for a payment that carries a credit, with the reason in
-- plain words before the trigger would say it.
CREATE OR REPLACE FUNCTION public.move_labor_job_payment(p_payment_id uuid, p_to_job_id uuid, p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.people_labor_job_payments%ROWTYPE;
  v_next integer;
  v_event uuid;
  v_actor_name text;
BEGIN
  SELECT * INTO v_pay FROM public.people_labor_job_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment % not found', p_payment_id USING ERRCODE = 'P0002'; END IF;
  IF v_pay.job_id = p_to_job_id THEN RAISE EXCEPTION 'payment is already on that sheet' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people_labor_jobs WHERE id = p_to_job_id) THEN
    RAISE EXCEPTION 'destination sheet % not found', p_to_job_id USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sub_credit_entries WHERE payment_id = p_payment_id) THEN
    RAISE EXCEPTION 'this payment carries a credit and stays on its sheet; remove it and record it again' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next FROM public.people_labor_job_payments WHERE job_id = p_to_job_id;
  SELECT name INTO v_actor_name FROM public.users WHERE id = auth.uid();
  UPDATE public.people_labor_job_payments SET job_id = p_to_job_id, sequence_order = v_next WHERE id = p_payment_id;
  INSERT INTO public.people_labor_job_payment_events
    (kind, payment_id, from_job_id, to_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, reason, actor_user_id, actor_name)
  VALUES
    ('moved', p_payment_id, v_pay.job_id, p_to_job_id, v_pay.amount, v_pay.memo, v_pay.payment_date, COALESCE(v_pay.hidden_from_sub, false), v_pay.sequence_order, NULLIF(BTRIM(p_reason), ''), auth.uid(), v_actor_name)
  RETURNING id INTO v_event;
  RETURN v_event;
END;
$$;

-- Remove: as 20261113180000, with the sending and the credit in the snapshot. Removing a payment
-- made from a credit puts the credit back (its entry goes with the row). Removing a payment that
-- kept a credit takes the credit away, and is refused once part of that credit has been used.
CREATE OR REPLACE FUNCTION public.remove_labor_job_payment(p_payment_id uuid, p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.people_labor_job_payments%ROWTYPE;
  v_event uuid;
  v_actor_name text;
  v_credit numeric(12,2);
  v_person uuid;
  v_balance numeric(12,2);
BEGIN
  SELECT * INTO v_pay FROM public.people_labor_job_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment % not found', p_payment_id USING ERRCODE = 'P0002'; END IF;
  SELECT amount, person_id INTO v_credit, v_person FROM public.sub_credit_entries WHERE payment_id = p_payment_id;
  IF v_credit > 0 THEN
    PERFORM public.sub_credit_lock(v_person);
    SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.sub_credit_entries WHERE person_id = v_person;
    IF v_balance - v_credit < 0 THEN
      RAISE EXCEPTION 'this payment kept a credit of % and part of it has been used; remove the payment made from the credit first', v_credit USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT name INTO v_actor_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.people_labor_job_payment_events
    (kind, payment_id, from_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, method, method_ref, sending_id, credit_amount, credit_person_id, reason, actor_user_id, actor_name)
  VALUES
    ('removed', p_payment_id, v_pay.job_id, v_pay.amount, v_pay.memo, v_pay.payment_date, COALESCE(v_pay.hidden_from_sub, false), v_pay.sequence_order, v_pay.method, v_pay.method_ref, v_pay.sending_id, v_credit, v_person, NULLIF(BTRIM(p_reason), ''), auth.uid(), v_actor_name)
  RETURNING id INTO v_event;
  DELETE FROM public.people_labor_job_payments WHERE id = p_payment_id;
  RETURN v_event;
END;
$$;

-- Undo a removal: as 20261113180000, and the row comes back with its sending and its credit entry.
-- A payment made from a credit comes back only while the credit is still there to pay for it.
CREATE OR REPLACE FUNCTION public.restore_labor_job_payment(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ev public.people_labor_job_payment_events%ROWTYPE;
  v_next integer;
  v_new uuid;
  v_restored uuid;
  v_actor_name text;
  v_balance numeric(12,2);
  v_sending uuid;
BEGIN
  SELECT * INTO v_ev FROM public.people_labor_job_payment_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_ev.kind <> 'removed' THEN RAISE EXCEPTION 'removal % not found', p_event_id USING ERRCODE = 'P0002'; END IF;
  IF v_ev.restored_event_id IS NOT NULL THEN RAISE EXCEPTION 'already restored' USING ERRCODE = '22023'; END IF;
  IF v_ev.created_at < now() - interval '30 days' THEN RAISE EXCEPTION 'too old to restore' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people_labor_jobs WHERE id = v_ev.from_job_id) THEN
    RAISE EXCEPTION 'the sheet is gone' USING ERRCODE = 'P0002';
  END IF;
  IF v_ev.credit_amount < 0 THEN
    PERFORM public.sub_credit_lock(v_ev.credit_person_id);
    SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.sub_credit_entries WHERE person_id = v_ev.credit_person_id;
    IF v_balance + v_ev.credit_amount < 0 THEN
      RAISE EXCEPTION 'this payment was made from a credit that has been used since; record it again' USING ERRCODE = '22023';
    END IF;
  END IF;
  SELECT id INTO v_sending FROM public.sub_payment_sendings WHERE id = v_ev.sending_id;
  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next FROM public.people_labor_job_payments WHERE job_id = v_ev.from_job_id;
  SELECT name INTO v_actor_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.people_labor_job_payments (job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, method, method_ref, sending_id)
  VALUES (v_ev.from_job_id, v_ev.amount, v_ev.memo, v_ev.payment_date, v_ev.hidden_from_sub, v_next, v_ev.method, v_ev.method_ref, v_sending)
  RETURNING id INTO v_new;
  IF v_ev.credit_amount IS NOT NULL AND v_ev.credit_person_id IS NOT NULL THEN
    INSERT INTO public.sub_credit_entries (person_id, amount, payment_id, sending_id)
    VALUES (v_ev.credit_person_id, v_ev.credit_amount, v_new, CASE WHEN v_ev.credit_amount > 0 THEN v_sending END);
  END IF;
  INSERT INTO public.people_labor_job_payment_events
    (kind, payment_id, from_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, method, method_ref, sending_id, credit_amount, credit_person_id, reason, actor_user_id, actor_name)
  VALUES
    ('restored', v_new, v_ev.from_job_id, v_ev.amount, v_ev.memo, v_ev.payment_date, v_ev.hidden_from_sub, v_next, v_ev.method, v_ev.method_ref, v_sending, v_ev.credit_amount, v_ev.credit_person_id, v_ev.reason, auth.uid(), v_actor_name)
  RETURNING id INTO v_restored;
  UPDATE public.people_labor_job_payment_events SET restored_event_id = v_restored WHERE id = p_event_id;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.sub_credit_lock(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_sub_sending(uuid, jsonb, numeric, date, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_sub_credit(uuid, uuid, numeric, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_labor_job_payment(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_labor_job_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_labor_job_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sub_credit_lock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sub_sending(uuid, jsonb, numeric, date, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sub_credit(uuid, uuid, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_labor_job_payment(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_labor_job_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_labor_job_payment(uuid) TO authenticated;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
