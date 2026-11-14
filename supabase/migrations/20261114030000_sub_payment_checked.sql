SET lock_timeout = '3s';

-- A sub payment is ticked against the bank (punch list #347, PR 4; the owner, 2026-11-13: "so I can
-- quickly reconcile payments we have made to people").
--
-- The Subs Ledger lists every payment by date to hold beside a bank statement. This is the mark a
-- person leaves as they go down it: who ticked a line and when, so the next sitting starts where the
-- last one stopped and "what is left to check" is a figure.
--
-- Three columns on the payment row, and one function that sets or clears them. A tick is on the
-- money movement: every row of one sending is ticked or cleared together, since one check is one
-- line at the bank. A back-charge and a payment made from a credit moved no money and take no tick.
--
-- Changing a ticked payment's amount or its Date sent clears the tick: it was checked against a
-- figure and a day the row no longer shows. A removed payment that is put back comes back unticked.
--
-- Additive and idempotent. No table is created, so no fence call is needed.

ALTER TABLE public.people_labor_job_payments
  ADD COLUMN IF NOT EXISTS checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_by_name text;

COMMENT ON COLUMN public.people_labor_job_payments.checked_at IS
  'When this payment was ticked against the bank (v2.7237). NULL is not checked. Cleared by itself when the amount or payment_date changes. Not shown on the sub portal.';
COMMENT ON COLUMN public.people_labor_job_payments.checked_by_name IS
  'The name of who ticked it, as it read then (v2.7237).';

-- Tick or clear one payment, and with it every row of the same sending.
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

REVOKE ALL ON FUNCTION public.set_sub_payment_checked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sub_payment_checked(uuid, boolean) TO authenticated;

-- A tick was made against an amount and a day. When either changes, the tick goes.
CREATE OR REPLACE FUNCTION public.clear_sub_payment_check_on_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.checked_at IS NOT NULL
     AND NEW.checked_at IS NOT DISTINCT FROM OLD.checked_at
     AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.payment_date IS DISTINCT FROM OLD.payment_date) THEN
    NEW.checked_at := NULL;
    NEW.checked_by := NULL;
    NEW.checked_by_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_sub_payment_check_on_change ON public.people_labor_job_payments;
CREATE TRIGGER clear_sub_payment_check_on_change
  BEFORE UPDATE OF amount, payment_date ON public.people_labor_job_payments
  FOR EACH ROW EXECUTE FUNCTION public.clear_sub_payment_check_on_change();
