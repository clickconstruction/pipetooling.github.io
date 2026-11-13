SET lock_timeout = '3s';

-- A sub payment says how it was sent (v2.7176; the owner, 2026-11-13: make the sub's payment window
-- "more similar to the record payment modal ... in People Pay stubs", where "How it was sent" is a
-- row of chips. He had typed "cheque" into the memo, which the sub reads on their portal).
--
-- Two columns on the payment row: the method, and that method's own number (a check number, a
-- Cash App id, a confirmation). Both are empty on every row recorded before this, and stay empty
-- when no chip is picked. The list is the client's SUB_PAY_METHODS
-- (src/lib/subWorkOrders/subPaymentWindow.ts): a check and Zelle lead, since that is how subs are
-- paid. It is its own list, not pay_stub_payments.source_kind, whose kinds are tied to the pay-send
-- functions.
--
-- The sub portal reads its payment columns by name (supabase/functions/sub-portal) and names
-- neither of these, so the portal shows what it showed before.
--
-- The same two columns go on the event snapshot, and the removal and its undo carry them, so a
-- payment removed and restored comes back with its method. A move re-points the live row and
-- needs nothing. Additive and idempotent.

ALTER TABLE public.people_labor_job_payments
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS method_ref text;

COMMENT ON COLUMN public.people_labor_job_payments.method IS
  'How the payment was sent (v2.7176): check, zelle, mercury, cashapp, apple_pay, cash, client_direct, other. NULL when nobody said. Not shown on the sub portal.';
COMMENT ON COLUMN public.people_labor_job_payments.method_ref IS
  'The method''s own number as typed: a check number, a Cash App transaction id, a confirmation number. Not shown on the sub portal.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'people_labor_job_payments_method_check') THEN
    ALTER TABLE public.people_labor_job_payments
      ADD CONSTRAINT people_labor_job_payments_method_check
      CHECK (method IS NULL OR method IN ('check', 'zelle', 'mercury', 'cashapp', 'apple_pay', 'cash', 'client_direct', 'other'));
  END IF;
END
$$;

ALTER TABLE public.people_labor_job_payment_events
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS method_ref text;

COMMENT ON COLUMN public.people_labor_job_payment_events.method IS
  'Snapshot of the payment''s method at the time (v2.7176), so a restored removal keeps it.';
COMMENT ON COLUMN public.people_labor_job_payment_events.method_ref IS
  'Snapshot of the payment''s method number at the time (v2.7176).';

-- Remove a payment with a reason: as 20260917140000, with the method in the snapshot.
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
BEGIN
  SELECT * INTO v_pay FROM public.people_labor_job_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment % not found', p_payment_id USING ERRCODE = 'P0002'; END IF;
  SELECT name INTO v_actor_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.people_labor_job_payment_events
    (kind, payment_id, from_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, reason, actor_user_id, actor_name, method, method_ref)
  VALUES
    ('removed', p_payment_id, v_pay.job_id, v_pay.amount, v_pay.memo, v_pay.payment_date, COALESCE(v_pay.hidden_from_sub, false), v_pay.sequence_order, NULLIF(BTRIM(p_reason), ''), auth.uid(), v_actor_name, v_pay.method, v_pay.method_ref)
  RETURNING id INTO v_event;
  DELETE FROM public.people_labor_job_payments WHERE id = p_payment_id;
  RETURN v_event;
END;
$$;

-- Undo a removal within 30 days: as 20260917140000, with the method back on the new row.
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
BEGIN
  SELECT * INTO v_ev FROM public.people_labor_job_payment_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_ev.kind <> 'removed' THEN RAISE EXCEPTION 'removal % not found', p_event_id USING ERRCODE = 'P0002'; END IF;
  IF v_ev.restored_event_id IS NOT NULL THEN RAISE EXCEPTION 'already restored' USING ERRCODE = '22023'; END IF;
  IF v_ev.created_at < now() - interval '30 days' THEN RAISE EXCEPTION 'too old to restore' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people_labor_jobs WHERE id = v_ev.from_job_id) THEN
    RAISE EXCEPTION 'the sheet is gone' USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next FROM public.people_labor_job_payments WHERE job_id = v_ev.from_job_id;
  SELECT name INTO v_actor_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.people_labor_job_payments (job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, method, method_ref)
  VALUES (v_ev.from_job_id, v_ev.amount, v_ev.memo, v_ev.payment_date, v_ev.hidden_from_sub, v_next, v_ev.method, v_ev.method_ref)
  RETURNING id INTO v_new;
  INSERT INTO public.people_labor_job_payment_events
    (kind, payment_id, from_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, reason, actor_user_id, actor_name, method, method_ref)
  VALUES
    ('restored', v_new, v_ev.from_job_id, v_ev.amount, v_ev.memo, v_ev.payment_date, v_ev.hidden_from_sub, v_next, v_ev.reason, auth.uid(), v_actor_name, v_ev.method, v_ev.method_ref)
  RETURNING id INTO v_restored;
  UPDATE public.people_labor_job_payment_events SET restored_event_id = v_restored WHERE id = p_event_id;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_labor_job_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_labor_job_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_labor_job_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_labor_job_payment(uuid) TO authenticated;
