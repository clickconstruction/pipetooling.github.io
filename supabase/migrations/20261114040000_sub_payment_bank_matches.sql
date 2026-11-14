SET lock_timeout = '3s';

-- A sub payment is matched to the bank line it left on (punch list #347, PR 5; the owner,
-- 2026-11-13: "so I can quickly reconcile payments we have made to people", and "build it all").
--
-- PR 4 gave each payment a tick a person sets by hand. This is the tick with its proof: the Mercury
-- transaction the money left on. The Subs Ledger offers the bank lines with the same amount within
-- three days, a person presses one, and the payment is linked and ticked together.
--
-- One table, payment → transaction. A payment has one bank line. A bank line may carry several
-- payment rows: the rows of one sending, or rows typed one per sheet before sendings existed. What
-- is linked to one bank line can never add up to more than the line.
--
-- A match and a tick go together: matching ticks, and clearing the tick (by hand, or by an edit to
-- the amount or the date) clears the match. So a matched payment is always a checked one.
--
-- Needs 20261114020000 (sendings, the credit) and 20261114030000 (the tick). Idempotent.

CREATE TABLE IF NOT EXISTS public.sub_payment_bank_matches (
  payment_id uuid PRIMARY KEY REFERENCES public.people_labor_job_payments(id) ON DELETE CASCADE,
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  matched_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  matched_by_name text,
  matched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sub_payment_bank_matches_transaction_idx ON public.sub_payment_bank_matches (mercury_transaction_id);

COMMENT ON TABLE public.sub_payment_bank_matches IS
  'v2.7239: the Mercury transaction a sub payment left on. One row per payment row; the rows of one sending share a transaction. Written by match_sub_payment, removed by unmatch_sub_payment and whenever the payment''s tick is cleared.';

ALTER TABLE public.sub_payment_bank_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read sub payment bank matches" ON public.sub_payment_bank_matches;
CREATE POLICY "Office staff can read sub payment bank matches" ON public.sub_payment_bank_matches FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can write sub payment bank matches" ON public.sub_payment_bank_matches;
CREATE POLICY "Office staff can write sub payment bank matches" ON public.sub_payment_bank_matches FOR INSERT
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can update sub payment bank matches" ON public.sub_payment_bank_matches;
CREATE POLICY "Office staff can update sub payment bank matches" ON public.sub_payment_bank_matches FOR UPDATE
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can delete sub payment bank matches" ON public.sub_payment_bank_matches;
CREATE POLICY "Office staff can delete sub payment bank matches" ON public.sub_payment_bank_matches FOR DELETE
  USING (public.is_office_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_payment_bank_matches TO authenticated;

-- Match a payment, and every row of its sending, to one outgoing bank line, and tick them.
-- The caller must be able to read the bank line: the transactions table's own policies decide that.
CREATE OR REPLACE FUNCTION public.match_sub_payment(p_payment_id uuid, p_transaction_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.people_labor_job_payments%ROWTYPE;
  v_tx_amount numeric;
  v_tx_status text;
  v_name text;
  v_ids uuid[];
  v_mine numeric(12,2);
  v_others numeric(12,2);
  v_count integer;
BEGIN
  SELECT * INTO v_pay FROM public.people_labor_job_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment % not found', p_payment_id USING ERRCODE = 'P0002'; END IF;
  IF v_pay.amount < 0 OR v_pay.method = 'credit' THEN
    RAISE EXCEPTION 'this line moved no money, so there is no bank line to match it to' USING ERRCODE = '22023';
  END IF;
  SELECT amount, status INTO v_tx_amount, v_tx_status FROM public.mercury_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'that bank line was not found, or this login cannot read the bank' USING ERRCODE = 'P0002'; END IF;
  IF v_tx_amount >= 0 THEN RAISE EXCEPTION 'that bank line is money in, not a payment out' USING ERRCODE = '22023'; END IF;
  IF v_tx_status IN ('failed', 'cancelled') THEN RAISE EXCEPTION 'that bank line % and moved no money', v_tx_status USING ERRCODE = '22023'; END IF;

  -- The payment and every row of the same sending that moved money.
  SELECT array_agg(p.id) INTO v_ids
    FROM public.people_labor_job_payments p
   WHERE (p.id = p_payment_id OR (v_pay.sending_id IS NOT NULL AND p.sending_id = v_pay.sending_id))
     AND p.amount > 0 AND p.method IS DISTINCT FROM 'credit';

  -- What these rows sent: their amounts and the credit kept with them.
  SELECT COALESCE(SUM(p.amount), 0) + COALESCE((SELECT SUM(e.amount) FROM public.sub_credit_entries e WHERE e.payment_id = ANY (v_ids) AND e.amount > 0), 0)
    INTO v_mine
    FROM public.people_labor_job_payments p WHERE p.id = ANY (v_ids);
  -- What is already on this bank line from other payments.
  SELECT COALESCE(SUM(p.amount), 0) + COALESCE((SELECT SUM(e.amount) FROM public.sub_credit_entries e JOIN public.sub_payment_bank_matches m2 ON m2.payment_id = e.payment_id WHERE m2.mercury_transaction_id = p_transaction_id AND e.amount > 0 AND NOT (e.payment_id = ANY (v_ids))), 0)
    INTO v_others
    FROM public.sub_payment_bank_matches m
    JOIN public.people_labor_job_payments p ON p.id = m.payment_id
   WHERE m.mercury_transaction_id = p_transaction_id AND NOT (p.id = ANY (v_ids));
  IF v_mine + v_others > ABS(v_tx_amount) + 0.005 THEN
    RAISE EXCEPTION 'that bank line is % and the payments on it would come to %', ROUND(ABS(v_tx_amount), 2), v_mine + v_others USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.sub_payment_bank_matches (payment_id, mercury_transaction_id, matched_by, matched_by_name)
  SELECT unnest(v_ids), p_transaction_id, auth.uid(), v_name
  ON CONFLICT (payment_id) DO UPDATE
    SET mercury_transaction_id = EXCLUDED.mercury_transaction_id, matched_by = EXCLUDED.matched_by, matched_by_name = EXCLUDED.matched_by_name, matched_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.people_labor_job_payments
     SET checked_at = COALESCE(checked_at, now()), checked_by = COALESCE(checked_by, auth.uid()), checked_by_name = COALESCE(checked_by_name, v_name)
   WHERE id = ANY (v_ids);
  RETURN v_count;
END;
$$;

-- Tick or clear: as 20261114030000, and clearing a tick clears the match with it.
CREATE OR REPLACE FUNCTION public.set_sub_payment_checked(p_payment_id uuid, p_checked boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.people_labor_job_payments%ROWTYPE;
  v_name text;
  v_count integer;
BEGIN
  SELECT * INTO v_pay FROM public.people_labor_job_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment % not found', p_payment_id USING ERRCODE = 'P0002'; END IF;
  IF v_pay.amount < 0 THEN RAISE EXCEPTION 'a back-charge moved no money and is not checked against the bank' USING ERRCODE = '22023'; END IF;
  IF v_pay.method = 'credit' THEN RAISE EXCEPTION 'a payment made from a credit moved no money and is not checked against the bank' USING ERRCODE = '22023'; END IF;
  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  IF NOT COALESCE(p_checked, false) THEN
    DELETE FROM public.sub_payment_bank_matches m
     USING public.people_labor_job_payments p
     WHERE m.payment_id = p.id
       AND (p.id = p_payment_id OR (v_pay.sending_id IS NOT NULL AND p.sending_id = v_pay.sending_id));
  END IF;
  UPDATE public.people_labor_job_payments p
     SET checked_at = CASE WHEN COALESCE(p_checked, false) THEN now() ELSE NULL END,
         checked_by = CASE WHEN COALESCE(p_checked, false) THEN auth.uid() ELSE NULL END,
         checked_by_name = CASE WHEN COALESCE(p_checked, false) THEN v_name ELSE NULL END
   WHERE (p.id = p_payment_id OR (v_pay.sending_id IS NOT NULL AND p.sending_id = v_pay.sending_id))
     AND p.amount > 0
     AND p.method IS DISTINCT FROM 'credit';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Take a payment off its bank line: the match goes, and the tick with it.
CREATE OR REPLACE FUNCTION public.unmatch_sub_payment(p_payment_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.set_sub_payment_checked(p_payment_id, false);
$$;

-- An edit to a ticked payment's amount or date clears the tick (20261114030000). The match goes
-- with it. SECURITY DEFINER so the match is cleared whoever makes the edit.
CREATE OR REPLACE FUNCTION public.clear_sub_payment_check_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.checked_at IS NOT NULL
     AND NEW.checked_at IS NOT DISTINCT FROM OLD.checked_at
     AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.payment_date IS DISTINCT FROM OLD.payment_date) THEN
    NEW.checked_at := NULL;
    NEW.checked_by := NULL;
    NEW.checked_by_name := NULL;
    DELETE FROM public.sub_payment_bank_matches WHERE payment_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_sub_payment_check_on_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_sub_payment(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unmatch_sub_payment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_sub_payment_checked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_sub_payment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmatch_sub_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sub_payment_checked(uuid, boolean) TO authenticated;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
