SET lock_timeout = '3s';

-- Supply house payments: move a payment's money to another bill, and remove a payment with a
-- reason and a way back (the owner, 2026-11-16: "we will also often be told by a supply house that
-- they have applied our money to one bill instead of another, and we'll need the ability to move
-- payments we thought we made to apply them to different bills").
--
-- A house rarely re-applies a whole payment. It moves one invoice's worth, or part of one. So the
-- move is of an amount, from one bill to another bill of the same house, inside one payment: the
-- money, its day, its method and its number stay as they are, and only where it sits changes. A
-- move to no bill puts the amount on account; a move from no bill takes it from what the payment
-- holds on account.
--
-- One insert-only table, supply_house_payment_events, keeps what happened: who moved what from
-- where to where and why, who removed a payment and why, who put it back. Both bills of a move read
-- their line of it.
--
-- Three functions do the writing, each in one statement:
--   move_supply_house_payment      the amount moves, and its event is written
--   undo_supply_house_payment_move the same amount moves back, and both events say so
--   remove_supply_house_payment    the payment counts for nothing, with a reason (it took a direct
--   restore_supply_house_payment   update until now); put back within 30 days, only whole
--
-- Needs 20261116230000 (the payments, their lines and the triggers that keep a bill's paid state).
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.supply_house_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.supply_house_payments(id) ON DELETE CASCADE,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  -- A move: the bill the money left and the bill it went to. NULL is "on account with the house".
  from_invoice_id uuid REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL,
  to_invoice_id uuid REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL,
  -- The bills' numbers as they read then, so the trace still reads after a bill is deleted.
  from_invoice_number text,
  to_invoice_number text,
  -- A move: what moved. A removal or a putting back: what the payment had sent.
  amount numeric(12,2),
  -- A move: 'house_applied' | 'wrong_bill' | 'other' | 'undo'. A removal: the person's words.
  reason text,
  note text,
  -- A move that takes another back names it, and the one taken back names the move that did it.
  undoes_event_id uuid REFERENCES public.supply_house_payment_events(id) ON DELETE SET NULL,
  undone_by_event_id uuid REFERENCES public.supply_house_payment_events(id) ON DELETE SET NULL,
  actor_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supply_house_payment_events_kind_check CHECK (kind IN ('moved', 'removed', 'restored'))
);

CREATE INDEX IF NOT EXISTS supply_house_payment_events_payment_idx ON public.supply_house_payment_events (payment_id, created_at);
CREATE INDEX IF NOT EXISTS supply_house_payment_events_house_idx ON public.supply_house_payment_events (supply_house_id, created_at);

COMMENT ON TABLE public.supply_house_payment_events IS
  'What happened to a supply house payment after it was recorded: an amount moved from one bill to another (NULL = on account), the payment removed with a reason, the payment put back. Written only by move_supply_house_payment, undo_supply_house_payment_move, remove_supply_house_payment and restore_supply_house_payment. Never deleted by hand.';

ALTER TABLE public.supply_house_payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read supply house payment events" ON public.supply_house_payment_events;
CREATE POLICY "Office staff can read supply house payment events" ON public.supply_house_payment_events FOR SELECT
  USING (public.is_office_staff());
DROP POLICY IF EXISTS "Office staff can insert supply house payment events" ON public.supply_house_payment_events;
CREATE POLICY "Office staff can insert supply house payment events" ON public.supply_house_payment_events FOR INSERT
  WITH CHECK (public.is_office_staff());
-- An event is changed in one way only: the functions mark a move as taken back.
DROP POLICY IF EXISTS "Office staff can update supply house payment events" ON public.supply_house_payment_events;
CREATE POLICY "Office staff can update supply house payment events" ON public.supply_house_payment_events FOR UPDATE
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());

GRANT SELECT, INSERT, UPDATE ON public.supply_house_payment_events TO authenticated;

-- ── Move ────────────────────────────────────────────────────────────────────────────────────────

-- Moves p_amount of one payment from one bill to another bill of the same house. NULL for either
-- side is "on account". The triggers of 20261116230000 do the checking as each line changes: the
-- bill it goes to has room, belongs to the payment's house and is the same kind of paper, and each
-- bill touched is read again, so the one it left may read unpaid and the one it reached paid.
--
-- A whole line moves by changing its bill, so a payment is never left without a line half-way.
CREATE OR REPLACE FUNCTION public.move_supply_house_payment(
  p_payment_id uuid,
  p_from_invoice_id uuid,
  p_to_invoice_id uuid,
  p_amount numeric,
  p_reason text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_undoes_event_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_amount numeric(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_reason text := NULLIF(BTRIM(p_reason), '');
  v_pay public.supply_house_payments%ROWTYPE;
  v_have numeric(12,2);
  v_left numeric(12,2);
  v_from_number text;
  v_to_number text;
  v_name text;
  v_event uuid;
  r record;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'only the office moves a supply house payment' USING ERRCODE = '42501';
  END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'the amount to move must be above zero' USING ERRCODE = '22023'; END IF;
  IF p_from_invoice_id IS NOT DISTINCT FROM p_to_invoice_id THEN
    RAISE EXCEPTION 'the money is already there' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NOT NULL AND v_reason NOT IN ('house_applied', 'wrong_bill', 'other', 'undo') THEN
    RAISE EXCEPTION 'the reason is one of house_applied, wrong_bill or other' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pay FROM public.supply_house_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'that payment was not found' USING ERRCODE = 'P0002'; END IF;
  IF v_pay.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'this payment was removed; put it back before moving it' USING ERRCODE = '22023';
  END IF;
  -- A press payment only says its bill was paid. It has no money to hold on account.
  IF p_to_invoice_id IS NULL AND v_pay.source IN ('mark_paid', 'before') AND v_pay.method IS NULL THEN
    RAISE EXCEPTION 'this payment only says its bill was paid; mark the bill unpaid instead of taking the payment off it' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('supply_house_payment:' || v_pay.supply_house_id::text, 0));

  IF p_from_invoice_id IS NOT NULL THEN
    SELECT invoice_number INTO v_from_number FROM public.supply_house_invoices WHERE id = p_from_invoice_id;
  END IF;
  IF p_to_invoice_id IS NOT NULL THEN
    SELECT invoice_number INTO v_to_number FROM public.supply_house_invoices WHERE id = p_to_invoice_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'the bill to move it to was not found' USING ERRCODE = 'P0002'; END IF;
  END IF;

  IF p_from_invoice_id IS NULL THEN
    -- From what the payment holds on account.
    SELECT v_pay.amount - COALESCE(SUM(amount), 0) INTO v_have FROM public.supply_house_payment_lines WHERE payment_id = p_payment_id;
    IF v_amount > v_have + 0.005 THEN
      RAISE EXCEPTION 'this payment has % on account and % was asked for', v_have, v_amount USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount) VALUES (p_payment_id, p_to_invoice_id, v_amount);
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_have FROM public.supply_house_payment_lines WHERE payment_id = p_payment_id AND invoice_id = p_from_invoice_id;
    IF v_have <= 0 THEN
      RAISE EXCEPTION 'this payment has no money on that bill to move' USING ERRCODE = '22023';
    END IF;
    IF v_amount > v_have + 0.005 THEN
      RAISE EXCEPTION 'this payment has % on that bill and % was asked for', v_have, v_amount USING ERRCODE = '22023';
    END IF;
    v_left := v_amount;
    FOR r IN
      SELECT id, amount FROM public.supply_house_payment_lines
       WHERE payment_id = p_payment_id AND invoice_id = p_from_invoice_id AND amount > 0
       ORDER BY created_at DESC, id DESC
    LOOP
      EXIT WHEN v_left <= 0.005;
      IF r.amount <= v_left + 0.005 THEN
        -- The whole line goes: to the other bill, or off the payment's bills when it goes on account.
        IF p_to_invoice_id IS NULL THEN
          DELETE FROM public.supply_house_payment_lines WHERE id = r.id;
        ELSE
          UPDATE public.supply_house_payment_lines SET invoice_id = p_to_invoice_id WHERE id = r.id;
        END IF;
        v_left := v_left - r.amount;
      ELSE
        UPDATE public.supply_house_payment_lines SET amount = r.amount - v_left WHERE id = r.id;
        IF p_to_invoice_id IS NOT NULL THEN
          INSERT INTO public.supply_house_payment_lines (payment_id, invoice_id, amount) VALUES (p_payment_id, p_to_invoice_id, v_left);
        END IF;
        v_left := 0;
      END IF;
    END LOOP;
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  INSERT INTO public.supply_house_payment_events
    (payment_id, supply_house_id, kind, from_invoice_id, to_invoice_id, from_invoice_number, to_invoice_number, amount, reason, note, undoes_event_id, actor_user_id, actor_name)
  VALUES
    (p_payment_id, v_pay.supply_house_id, 'moved', p_from_invoice_id, p_to_invoice_id, v_from_number, v_to_number, v_amount, v_reason, NULLIF(BTRIM(p_note), ''), p_undoes_event_id, auth.uid(), v_name)
  RETURNING id INTO v_event;
  RETURN v_event;
END;
$$;

-- Takes a move back: the same amount, the other way, in the same payment. Refused when the money
-- has moved again since, or the bill it came from no longer has room, with the reason.
CREATE OR REPLACE FUNCTION public.undo_supply_house_payment_move(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ev public.supply_house_payment_events%ROWTYPE;
  v_back uuid;
BEGIN
  SELECT * INTO v_ev FROM public.supply_house_payment_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_ev.kind <> 'moved' THEN RAISE EXCEPTION 'that move was not found' USING ERRCODE = 'P0002'; END IF;
  IF v_ev.undone_by_event_id IS NOT NULL THEN RAISE EXCEPTION 'that move was already taken back' USING ERRCODE = '22023'; END IF;
  IF v_ev.undoes_event_id IS NOT NULL THEN RAISE EXCEPTION 'that line is a move being taken back; move the money again instead' USING ERRCODE = '22023'; END IF;
  -- A bill deleted since leaves nothing to move from or back to.
  IF (v_ev.from_invoice_number IS NOT NULL AND v_ev.from_invoice_id IS NULL) OR (v_ev.to_invoice_number IS NOT NULL AND v_ev.to_invoice_id IS NULL) THEN
    RAISE EXCEPTION 'a bill of that move is gone, so it cannot be taken back' USING ERRCODE = '22023';
  END IF;
  v_back := public.move_supply_house_payment(v_ev.payment_id, v_ev.to_invoice_id, v_ev.from_invoice_id, v_ev.amount, 'undo', NULL, p_event_id);
  UPDATE public.supply_house_payment_events SET undone_by_event_id = v_back WHERE id = p_event_id;
  RETURN v_back;
END;
$$;

-- ── Remove, and put back ────────────────────────────────────────────────────────────────────────

-- The payment counts for nothing from here: its bills are read again and may read unpaid. Its
-- lines stay, so putting it back is exact.
CREATE OR REPLACE FUNCTION public.remove_supply_house_payment(p_payment_id uuid, p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.supply_house_payments%ROWTYPE;
  v_name text;
  v_event uuid;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'only the office removes a supply house payment' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pay FROM public.supply_house_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'that payment was not found' USING ERRCODE = 'P0002'; END IF;
  IF v_pay.removed_at IS NOT NULL THEN RAISE EXCEPTION 'that payment was already removed' USING ERRCODE = '22023'; END IF;
  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  UPDATE public.supply_house_payments
     SET removed_at = now(), removed_by = auth.uid(), removed_by_name = v_name, removed_reason = NULLIF(BTRIM(p_reason), '')
   WHERE id = p_payment_id;
  INSERT INTO public.supply_house_payment_events (payment_id, supply_house_id, kind, amount, reason, actor_user_id, actor_name)
  VALUES (p_payment_id, v_pay.supply_house_id, 'removed', v_pay.amount, NULLIF(BTRIM(p_reason), ''), auth.uid(), v_name)
  RETURNING id INTO v_event;
  RETURN v_event;
END;
$$;

-- Put a removed payment back, within 30 days. Only whole: the guard of 20261116230000 refuses when
-- a bill it paid has been paid since, or has moved house, and names the bill.
CREATE OR REPLACE FUNCTION public.restore_supply_house_payment(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.supply_house_payments%ROWTYPE;
  v_name text;
  v_event uuid;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'only the office puts a supply house payment back' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pay FROM public.supply_house_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'that payment was not found' USING ERRCODE = 'P0002'; END IF;
  IF v_pay.removed_at IS NULL THEN RAISE EXCEPTION 'that payment is not removed' USING ERRCODE = '22023'; END IF;
  IF v_pay.removed_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'that payment was removed more than 30 days ago; record it again' USING ERRCODE = '22023';
  END IF;
  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  UPDATE public.supply_house_payments
     SET removed_at = NULL, removed_by = NULL, removed_by_name = NULL, removed_reason = NULL
   WHERE id = p_payment_id;
  INSERT INTO public.supply_house_payment_events (payment_id, supply_house_id, kind, amount, reason, actor_user_id, actor_name)
  VALUES (p_payment_id, v_pay.supply_house_id, 'restored', v_pay.amount, v_pay.removed_reason, auth.uid(), v_name)
  RETURNING id INTO v_event;
  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.move_supply_house_payment(uuid, uuid, uuid, numeric, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_supply_house_payment_move(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_supply_house_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_supply_house_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_supply_house_payment(uuid, uuid, uuid, numeric, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_supply_house_payment_move(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_supply_house_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_supply_house_payment(uuid) TO authenticated;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
