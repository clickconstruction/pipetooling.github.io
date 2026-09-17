SET lock_timeout = '3s';

-- Sub sheet payments: move or remove one, with a trace (v2.3562, PR 1 of the payment
-- move/remove train — Taunya, 2026-09-17: "delete a payment that was applied to the wrong job").
--
-- Until now a sub payment could only be edited or hard-deleted from inside the Edit dialog, and
-- nothing could carry it to the sheet it belonged on. This adds one small ledger of what happened
-- to a payment — moved (from → to), removed (with a snapshot so it can be restored), restored —
-- and three SECURITY INVOKER functions that do each in one statement. The live payment row keeps
-- its shape, so every reader of people_labor_job_payments (the ledger, the portal, Crew P&L,
-- the Day book) is untouched: a moved payment simply has a new job_id, a removed one is gone
-- and lives on here until it is restored.

CREATE TABLE IF NOT EXISTS public.people_labor_job_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  -- The live row this event is about: the moved row; the removed row (gone) / the restored row (new).
  payment_id uuid,
  -- moved: the sheet it left · removed / restored: the sheet it was on.
  from_job_id uuid REFERENCES public.people_labor_jobs(id) ON DELETE CASCADE,
  -- moved: the sheet it went to.
  to_job_id uuid REFERENCES public.people_labor_jobs(id) ON DELETE CASCADE,
  -- Snapshot of the payment at the time (a removal restores from it).
  amount numeric(12,2) NOT NULL,
  memo text,
  payment_date date,
  hidden_from_sub boolean NOT NULL DEFAULT false,
  sequence_order integer,
  reason text,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text,
  -- On a 'removed' event: the 'restored' event that undid it (null while it can still be undone).
  restored_event_id uuid REFERENCES public.people_labor_job_payment_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_labor_job_payment_events_kind_check CHECK (kind IN ('moved', 'removed', 'restored'))
);

CREATE INDEX IF NOT EXISTS people_labor_job_payment_events_from_idx ON public.people_labor_job_payment_events (from_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS people_labor_job_payment_events_to_idx ON public.people_labor_job_payment_events (to_job_id, created_at DESC);

COMMENT ON TABLE public.people_labor_job_payment_events IS
  'v2.3562: what happened to a sub sheet payment — moved (from_job_id → to_job_id), removed (snapshot kept; restored_event_id set once undone), restored. Both sheets draw the grey trace line from it; the sub portal too.';

ALTER TABLE public.people_labor_job_payment_events ENABLE ROW LEVEL SECURITY;

-- The office reads and writes; the functions below run as the caller, so these policies are
-- what gates every move, removal and restore.
DROP POLICY IF EXISTS "Office staff can read sub payment events" ON public.people_labor_job_payment_events;
CREATE POLICY "Office staff can read sub payment events" ON public.people_labor_job_payment_events FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can write sub payment events" ON public.people_labor_job_payment_events;
CREATE POLICY "Office staff can write sub payment events" ON public.people_labor_job_payment_events FOR INSERT
  WITH CHECK (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can update sub payment events" ON public.people_labor_job_payment_events;
CREATE POLICY "Office staff can update sub payment events" ON public.people_labor_job_payment_events FOR UPDATE
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());

-- Move a payment (or backcharge) to another sheet in one statement: the row keeps its id,
-- amount, memo, date and portal visibility; it takes the last slot on the destination; both
-- sheets get the trace through the one event row.
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

-- Remove a payment with a reason: the row is deleted (so every reader stays honest) and the
-- event keeps a full snapshot, which restore_labor_job_payment puts back.
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
    (kind, payment_id, from_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, reason, actor_user_id, actor_name)
  VALUES
    ('removed', p_payment_id, v_pay.job_id, v_pay.amount, v_pay.memo, v_pay.payment_date, COALESCE(v_pay.hidden_from_sub, false), v_pay.sequence_order, NULLIF(BTRIM(p_reason), ''), auth.uid(), v_actor_name)
  RETURNING id INTO v_event;
  DELETE FROM public.people_labor_job_payments WHERE id = p_payment_id;
  RETURN v_event;
END;
$$;

-- Undo a removal within 30 days: a new payment row from the snapshot, on the sheet it left,
-- at the end of that sheet's list; the removed event points at the restored one.
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
  INSERT INTO public.people_labor_job_payments (job_id, amount, memo, payment_date, hidden_from_sub, sequence_order)
  VALUES (v_ev.from_job_id, v_ev.amount, v_ev.memo, v_ev.payment_date, v_ev.hidden_from_sub, v_next)
  RETURNING id INTO v_new;
  INSERT INTO public.people_labor_job_payment_events
    (kind, payment_id, from_job_id, amount, memo, payment_date, hidden_from_sub, sequence_order, reason, actor_user_id, actor_name)
  VALUES
    ('restored', v_new, v_ev.from_job_id, v_ev.amount, v_ev.memo, v_ev.payment_date, v_ev.hidden_from_sub, v_next, v_ev.reason, auth.uid(), v_actor_name)
  RETURNING id INTO v_restored;
  UPDATE public.people_labor_job_payment_events SET restored_event_id = v_restored WHERE id = p_event_id;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.move_labor_job_payment(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_labor_job_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_labor_job_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_labor_job_payment(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_labor_job_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_labor_job_payment(uuid) TO authenticated;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
