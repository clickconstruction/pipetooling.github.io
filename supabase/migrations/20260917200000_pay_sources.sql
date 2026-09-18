SET lock_timeout = '3s';

-- v2.3578 — Pay sends carry their source, and five functions become the one door for recording
-- and linking them (the owner, 2026-09-17: "use this ledger to backfill the transactions in the
-- app with the correct information … I do not mind adding these functions").
--
--   pay_stub_payments.source_kind / source_id   which send paid this row: a Cash App transaction id,
--                                              an app mercury_transactions id, a client-direct
--                                              payment, or other. One send may back several rows
--                                              (one send covering three weeks); a row backs one send.
--   cashapp_transactions.decision_note          why a send was filed as not pay / expense / ignored.
--
--   pay_position(person)                        each report's net · paid · remaining, pending offsets,
--                                              the person's Cash App queue. The one read.
--   record_pay_send(kind, id, person, amount, paid_on, note, dry_run)
--                                              allocates oldest-open-first, splits at week edges,
--                                              files any leftover as an advance offset, sets the
--                                              Cash App lane. Idempotent on (kind, id).
--   link_pay_send(payment_id, kind, id, amount) attach a source to an existing payment, optionally
--                                              correcting its amount. The backfill primitive.
--   split_pay_payment(payment_id, parts)        break a merged payment into rows summing to the same.
--   set_cashapp_lane(id, lane, person, note)    not pay / expense / ignored / before records.
--
-- Access: every function requires has_payroll_access() or the service role. SECURITY INVOKER, so
-- the tables' RLS and the read-only write blocks still apply. Additive; no data touched.

-- ── columns ───────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pay_stub_payments
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_id text;

ALTER TABLE public.pay_stub_payments DROP CONSTRAINT IF EXISTS pay_stub_payments_source_kind_check;
ALTER TABLE public.pay_stub_payments ADD CONSTRAINT pay_stub_payments_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN ('cashapp', 'mercury', 'client_direct', 'other'));

ALTER TABLE public.pay_stub_payments DROP CONSTRAINT IF EXISTS pay_stub_payments_source_pair_check;
ALTER TABLE public.pay_stub_payments ADD CONSTRAINT pay_stub_payments_source_pair_check
  CHECK (source_id IS NULL OR source_kind IS NOT NULL);

-- one payment row per send per report (a send that covered three weeks has three rows)
CREATE UNIQUE INDEX IF NOT EXISTS pay_stub_payments_source_per_report_uidx
  ON public.pay_stub_payments (source_kind, source_id, pay_stub_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pay_stub_payments_source_idx
  ON public.pay_stub_payments (source_kind, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.cashapp_transactions ADD COLUMN IF NOT EXISTS decision_note text;

-- ── helpers ───────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pay_rpc_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.has_payroll_access() OR COALESCE(auth.role(), '') = 'service_role';
$$;

-- The memo a recorded send wears. Cash App keeps the transaction id in the memo so the reconcile
-- matcher's rule (a) still reads it back; the other kinds name the channel.
CREATE OR REPLACE FUNCTION public.pay_send_memo(p_source_kind text, p_source_id text, p_note text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_source_kind
           WHEN 'cashapp' THEN 'Cash App ' || COALESCE(p_source_id, '')
           WHEN 'mercury' THEN 'Mercury'
           WHEN 'client_direct' THEN 'Client direct'
           ELSE 'Payment'
         END
         || CASE WHEN NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN '' ELSE ' "' || btrim(p_note) || '"' END;
$$;

-- Noon on the day, in the company's time zone — the same instant the app's Record payment writes.
CREATE OR REPLACE FUNCTION public.pay_paid_at_noon(p_day date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_day::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago';
$$;

-- Net pay of one report, the formula validate_pay_stub_payments_vs_net enforces.
CREATE OR REPLACE FUNCTION public.pay_report_net(p_stub uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT s.gross_pay
       - COALESCE((SELECT SUM(d.amount) FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id), 0)
       + COALESCE((SELECT SUM(a.line_total) FROM public.pay_stub_additional_lines a WHERE a.pay_stub_id = s.id), 0)
  FROM public.pay_stubs s
  WHERE s.id = p_stub;
$$;

CREATE OR REPLACE FUNCTION public.pay_report_remaining(p_stub uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT ROUND(public.pay_report_net(p_stub)
       - COALESCE((SELECT SUM(p.amount) FROM public.pay_stub_payments p WHERE p.pay_stub_id = p_stub), 0), 2);
$$;

-- ── pay_position ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pay_position(p_person text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_reports jsonb;
  v_offsets jsonb;
  v_queue jsonb;
  v_open numeric;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;

  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'period_start'), '[]'::jsonb)
    INTO v_reports
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'period_start', s.period_start,
      'period_end', s.period_end,
      'gross', s.gross_pay,
      'deductions', COALESCE((SELECT SUM(d.amount) FROM public.pay_stub_deductions d WHERE d.pay_stub_id = s.id), 0),
      'additional', COALESCE((SELECT SUM(a.line_total) FROM public.pay_stub_additional_lines a WHERE a.pay_stub_id = s.id), 0),
      'net', public.pay_report_net(s.id),
      'paid', COALESCE((SELECT SUM(p.amount) FROM public.pay_stub_payments p WHERE p.pay_stub_id = s.id), 0),
      'remaining', public.pay_report_remaining(s.id),
      'payments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'amount', p.amount, 'paid_at', p.paid_at, 'memo', p.memo,
          'source_kind', p.source_kind, 'source_id', p.source_id
        ) ORDER BY p.paid_at, p.created_at)
        FROM public.pay_stub_payments p WHERE p.pay_stub_id = s.id
      ), '[]'::jsonb)
    ) AS r
    FROM public.pay_stubs s
    WHERE s.person_name = p_person
  ) x;

  SELECT COALESCE(SUM((r->>'remaining')::numeric) FILTER (WHERE (r->>'remaining')::numeric > 0), 0)
    INTO v_open
  FROM jsonb_array_elements(v_reports) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', o.id, 'type', o.type, 'amount', o.amount, 'occurred_date', o.occurred_date, 'description', o.description
    ) ORDER BY o.occurred_date, o.created_at), '[]'::jsonb)
    INTO v_offsets
  FROM public.person_offsets o
  WHERE o.person_name = p_person AND o.pay_stub_id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', t.id, 'occurred_date', t.occurred_date, 'amount', t.amount, 'note', t.note,
      'lane', t.lane, 'match_rule', t.match_rule, 'pay_stub_payment_id', t.pay_stub_payment_id, 'person_offset_id', t.person_offset_id
    ) ORDER BY t.occurred_date, t.id), '[]'::jsonb)
    INTO v_queue
  FROM public.cashapp_transactions t
  WHERE t.person_name = p_person AND t.lane IN ('review', 'advance');

  RETURN jsonb_build_object(
    'person', p_person,
    'reports', v_reports,
    'open_total', v_open,
    'pending_offsets', v_offsets,
    'queue', v_queue
  );
END;
$$;

-- ── record_pay_send ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_pay_send(
  p_source_kind text,
  p_source_id text,
  p_person text,
  p_amount numeric,
  p_paid_on date,
  p_note text DEFAULT NULL,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_memo text;
  v_paid_at timestamptz;
  v_left numeric;
  v_take numeric;
  v_plan jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_stub record;
  v_payment_id uuid;
  v_first_payment uuid;
  v_offset_id uuid;
  v_person_id uuid;
  v_existing jsonb;
  v_lane text;
  v_queue_row boolean := false;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_source_kind IS NULL OR p_source_kind NOT IN ('cashapp', 'mercury', 'client_direct', 'other') THEN
    RAISE EXCEPTION 'source_kind must be cashapp, mercury, client_direct or other';
  END IF;
  IF p_source_kind IN ('cashapp', 'mercury') AND NULLIF(btrim(COALESCE(p_source_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a % send needs its source_id', p_source_kind;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero';
  END IF;
  IF NULLIF(btrim(COALESCE(p_person, '')), '') IS NULL THEN
    RAISE EXCEPTION 'person is required';
  END IF;
  IF p_paid_on IS NULL THEN
    RAISE EXCEPTION 'paid_on is required';
  END IF;

  v_memo := public.pay_send_memo(p_source_kind, p_source_id, p_note);
  v_paid_at := public.pay_paid_at_noon(p_paid_on);

  -- idempotent: a send already recorded (payments or an advance offset) is reported, not repeated
  IF p_source_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('payment_id', p.id, 'pay_stub_id', p.pay_stub_id, 'amount', p.amount))
      INTO v_existing
    FROM public.pay_stub_payments p
    WHERE p.source_kind = p_source_kind AND p.source_id = p_source_id;
    IF v_existing IS NULL THEN
      SELECT jsonb_agg(jsonb_build_object('offset_id', o.id, 'amount', o.amount))
        INTO v_existing
      FROM public.person_offsets o
      WHERE o.type = 'advance' AND o.person_name = p_person AND o.description = v_memo;
    END IF;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'already_recorded', 'person', p_person, 'memo', v_memo, 'rows', v_existing);
    END IF;
  END IF;

  -- the plan: oldest open report first, splitting where a report fills
  v_left := ROUND(p_amount, 2);
  FOR v_stub IN
    SELECT s.id, s.period_start, s.period_end, s.person_id, public.pay_report_remaining(s.id) AS remaining
    FROM public.pay_stubs s
    WHERE s.person_name = p_person
    ORDER BY s.period_start, s.created_at
  LOOP
    v_person_id := COALESCE(v_person_id, v_stub.person_id);
    EXIT WHEN v_left <= 0.005;
    CONTINUE WHEN v_stub.remaining <= 0.005;
    v_take := ROUND(LEAST(v_left, v_stub.remaining), 2);
    v_plan := v_plan || jsonb_build_object(
      'pay_stub_id', v_stub.id, 'period_start', v_stub.period_start, 'period_end', v_stub.period_end, 'amount', v_take
    );
    v_left := ROUND(v_left - v_take, 2);
  END LOOP;
  IF v_left <= 0.005 THEN
    v_left := 0;
  END IF;

  IF p_source_kind = 'cashapp' THEN
    SELECT true INTO v_queue_row FROM public.cashapp_transactions t WHERE t.id = p_source_id;
    v_queue_row := COALESCE(v_queue_row, false);
  END IF;
  v_lane := CASE WHEN jsonb_array_length(v_plan) > 0 THEN 'recorded' ELSE 'advance' END;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'status', 'planned', 'person', p_person, 'amount', ROUND(p_amount, 2), 'memo', v_memo, 'paid_at', v_paid_at,
      'allocations', v_plan, 'leftover_to_advance', v_left,
      'cashapp_lane', CASE WHEN v_queue_row THEN v_lane ELSE NULL END
    );
  END IF;

  -- apply
  FOR v_stub IN SELECT (e->>'pay_stub_id')::uuid AS id, (e->>'amount')::numeric AS amount FROM jsonb_array_elements(v_plan) e
  LOOP
    INSERT INTO public.pay_stub_payments (pay_stub_id, amount, paid_at, memo, created_by, source_kind, source_id)
    VALUES (v_stub.id, v_stub.amount, v_paid_at, v_memo, auth.uid(), p_source_kind, p_source_id)
    RETURNING id INTO v_payment_id;
    v_first_payment := COALESCE(v_first_payment, v_payment_id);
    v_rows := v_rows || jsonb_build_object('payment_id', v_payment_id, 'pay_stub_id', v_stub.id, 'amount', v_stub.amount);
  END LOOP;

  IF v_left > 0 THEN
    INSERT INTO public.person_offsets (person_name, person_id, type, amount, description, occurred_date)
    VALUES (p_person, v_person_id, 'advance', v_left, v_memo, p_paid_on)
    RETURNING id INTO v_offset_id;
  END IF;

  IF v_queue_row THEN
    UPDATE public.cashapp_transactions
       SET lane = v_lane,
           match_rule = 'manual',
           person_name = p_person,
           pay_stub_payment_id = v_first_payment,
           person_offset_id = v_offset_id,
           decided_at = now(),
           decided_by = auth.uid()
     WHERE id = p_source_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'recorded', 'person', p_person, 'amount', ROUND(p_amount, 2), 'memo', v_memo, 'paid_at', v_paid_at,
    'rows', v_rows, 'leftover_to_advance', v_left, 'offset_id', v_offset_id,
    'cashapp_lane', CASE WHEN v_queue_row THEN v_lane ELSE NULL END
  );
END;
$$;

-- ── link_pay_send ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_pay_send(
  p_payment_id uuid,
  p_source_kind text,
  p_source_id text,
  p_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.pay_stub_payments%ROWTYPE;
  v_person text;
  v_memo text;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_source_kind IS NULL OR p_source_kind NOT IN ('cashapp', 'mercury', 'client_direct', 'other') THEN
    RAISE EXCEPTION 'source_kind must be cashapp, mercury, client_direct or other';
  END IF;
  IF p_source_kind IN ('cashapp', 'mercury') AND NULLIF(btrim(COALESCE(p_source_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a % send needs its source_id', p_source_kind;
  END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero';
  END IF;

  SELECT * INTO v_row FROM public.pay_stub_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment % not found', p_payment_id;
  END IF;
  IF v_row.source_id IS NOT NULL AND (v_row.source_kind <> p_source_kind OR v_row.source_id IS DISTINCT FROM p_source_id) THEN
    RAISE EXCEPTION 'payment % already carries source % %', p_payment_id, v_row.source_kind, v_row.source_id;
  END IF;

  -- a Cash App send keeps its id in the memo (the matcher's rule a); the memo already there becomes the note
  v_memo := v_row.memo;
  IF p_source_kind = 'cashapp' AND (v_memo IS NULL OR position(p_source_id IN v_memo) = 0) THEN
    v_memo := public.pay_send_memo('cashapp', p_source_id, v_memo);
  END IF;

  UPDATE public.pay_stub_payments
     SET source_kind = p_source_kind,
         source_id = p_source_id,
         amount = COALESCE(ROUND(p_amount, 2), amount),
         memo = v_memo
   WHERE id = p_payment_id;

  SELECT s.person_name INTO v_person FROM public.pay_stubs s WHERE s.id = v_row.pay_stub_id;

  IF p_source_kind = 'cashapp' THEN
    UPDATE public.cashapp_transactions
       SET lane = 'recorded',
           match_rule = COALESCE(match_rule, 'manual'),
           person_name = COALESCE(person_name, v_person),
           pay_stub_payment_id = COALESCE(pay_stub_payment_id, p_payment_id),
           decided_at = COALESCE(decided_at, now()),
           decided_by = COALESCE(decided_by, auth.uid())
     WHERE id = p_source_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'linked', 'payment_id', p_payment_id, 'pay_stub_id', v_row.pay_stub_id, 'person', v_person,
    'source_kind', p_source_kind, 'source_id', p_source_id,
    'amount_before', v_row.amount, 'amount_after', COALESCE(ROUND(p_amount, 2), v_row.amount),
    'memo_before', v_row.memo, 'memo_after', v_memo
  );
END;
$$;

-- ── split_pay_payment ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.split_pay_payment(p_payment_id uuid, p_parts jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_row public.pay_stub_payments%ROWTYPE;
  v_sum numeric;
  v_n int;
  v_part jsonb;
  v_i int := 0;
  v_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_kind text;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_parts IS NULL OR jsonb_typeof(p_parts) <> 'array' THEN
    RAISE EXCEPTION 'parts must be a JSON array of {amount, source_kind?, source_id?, memo?, paid_at?}';
  END IF;
  v_n := jsonb_array_length(p_parts);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'a split needs at least two parts';
  END IF;

  SELECT * INTO v_row FROM public.pay_stub_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment % not found', p_payment_id;
  END IF;

  SELECT SUM(ROUND((e->>'amount')::numeric, 2)) INTO v_sum FROM jsonb_array_elements(p_parts) e;
  IF v_sum IS NULL OR abs(v_sum - v_row.amount) > 0.01 THEN
    RAISE EXCEPTION 'parts sum to % but the payment is %', COALESCE(v_sum, 0), v_row.amount;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_parts) e WHERE COALESCE((e->>'amount')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'every part must be greater than zero';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_parts) e
    WHERE e->>'source_kind' IS NOT NULL AND e->>'source_kind' NOT IN ('cashapp', 'mercury', 'client_direct', 'other')
  ) THEN
    RAISE EXCEPTION 'source_kind must be cashapp, mercury, client_direct or other';
  END IF;

  FOR v_part IN SELECT e FROM jsonb_array_elements(p_parts) e
  LOOP
    v_i := v_i + 1;
    v_kind := v_part->>'source_kind';
    IF v_i = 1 THEN
      UPDATE public.pay_stub_payments
         SET amount = ROUND((v_part->>'amount')::numeric, 2),
             source_kind = COALESCE(v_kind, source_kind),
             source_id = COALESCE(v_part->>'source_id', CASE WHEN v_kind IS NULL THEN source_id ELSE NULL END),
             memo = COALESCE(v_part->>'memo', memo),
             paid_at = COALESCE((v_part->>'paid_at')::timestamptz, paid_at)
       WHERE id = p_payment_id;
      v_ids := v_ids || to_jsonb(p_payment_id);
    ELSE
      INSERT INTO public.pay_stub_payments (pay_stub_id, amount, paid_at, memo, created_by, source_kind, source_id)
      VALUES (
        v_row.pay_stub_id,
        ROUND((v_part->>'amount')::numeric, 2),
        COALESCE((v_part->>'paid_at')::timestamptz, v_row.paid_at),
        COALESCE(v_part->>'memo', v_row.memo),
        v_row.created_by,
        v_kind,
        CASE WHEN v_kind IS NULL THEN NULL ELSE v_part->>'source_id' END
      )
      RETURNING id INTO v_id;
      v_ids := v_ids || to_jsonb(v_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('status', 'split', 'pay_stub_id', v_row.pay_stub_id, 'total', v_row.amount, 'payment_ids', v_ids);
END;
$$;

-- ── set_cashapp_lane ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_cashapp_lane(
  p_id text,
  p_lane text,
  p_person text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_before text;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_lane IS NULL OR p_lane NOT IN ('review', 'expense', 'before_records', 'not_staff', 'ignored') THEN
    RAISE EXCEPTION 'lane must be review, expense, before_records, not_staff or ignored (recorded and advance come from record_pay_send)';
  END IF;

  SELECT lane INTO v_before FROM public.cashapp_transactions WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cash app transaction % not found', p_id;
  END IF;

  UPDATE public.cashapp_transactions
     SET lane = p_lane,
         person_name = CASE WHEN p_lane = 'not_staff' THEN NULL ELSE COALESCE(p_person, person_name) END,
         decision_note = COALESCE(p_note, decision_note),
         pay_stub_payment_id = NULL,
         person_offset_id = NULL,
         decided_at = now(),
         decided_by = auth.uid()
   WHERE id = p_id;

  RETURN jsonb_build_object('status', 'filed', 'id', p_id, 'lane_before', v_before, 'lane', p_lane);
END;
$$;

-- ── grants ────────────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.pay_rpc_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_rpc_allowed() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_send_memo(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_paid_at_noon(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_report_net(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_report_remaining(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_position(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pay_send(text, text, text, numeric, date, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_pay_send(uuid, text, text, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.split_pay_payment(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_cashapp_lane(text, text, text, text) TO authenticated, service_role;
