SET lock_timeout = '3s';

-- v2.3580 — Apple Pay as a source kind, and the part memo: when one send lands on several report
-- rows, every row says which part it is and what the whole send was (the owner, 2026-09-17: "How
-- should I record in the notes that both of those payments were a part of '1,067.23'? I want a
-- robot to always do this").
--
--   source_kind gains 'apple_pay' (source_id = the Mercury card row, like Cash App's card rows).
--   pay_send_memo('apple_pay', …)            'Apple Pay "note"'.
--   pay_send_part_memo(base, i, n, total)     base · i of n from $1,067.23
--   pay_send_strip_part(memo)                 the memo without a part suffix (idempotent restamp).
--   pay_send_total(kind, id)                  the send's amount from its ledger row, when it has one.
--   pay_send_stamp_parts(kind, id, total)     renumber the memos of every row sharing a source —
--                                             one row: any stale suffix stripped; several: 1 of n….
--   record_pay_send                           stamps the rows it writes; an advance offset for the
--                                             leftover says "· $50.00 of $1,067.23 ahead"; apple_pay
--                                             may be recorded before its Mercury row posts (no id).
--   link_pay_send                             restamps the source's rows after each link, so the
--                                             backfill's "one send, five rows" reads 1 of 5 … 5 of 5.
--   split_pay_payment                         unchanged — its parts are different sends, not one.
--
-- Access as before: payroll access or the service role; SECURITY INVOKER. Additive; no data touched.

ALTER TABLE public.pay_stub_payments DROP CONSTRAINT IF EXISTS pay_stub_payments_source_kind_check;
ALTER TABLE public.pay_stub_payments ADD CONSTRAINT pay_stub_payments_source_kind_check
  CHECK (source_kind IS NULL OR source_kind IN ('cashapp', 'mercury', 'apple_pay', 'client_direct', 'other'));

CREATE OR REPLACE FUNCTION public.pay_send_memo(p_source_kind text, p_source_id text, p_note text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_source_kind
           WHEN 'cashapp' THEN 'Cash App ' || COALESCE(p_source_id, '')
           WHEN 'mercury' THEN 'Mercury'
           WHEN 'apple_pay' THEN 'Apple Pay'
           WHEN 'client_direct' THEN 'Client direct'
           ELSE 'Payment'
         END
         || CASE WHEN NULLIF(btrim(COALESCE(p_note, '')), '') IS NULL THEN '' ELSE ' "' || btrim(p_note) || '"' END;
$$;

CREATE OR REPLACE FUNCTION public.pay_send_strip_part(p_memo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(p_memo, ''), ' · \d+ of \d+ from \$[0-9,]+\.[0-9]{2}$', '');
$$;

CREATE OR REPLACE FUNCTION public.pay_send_part_memo(p_base text, p_part int, p_of int, p_total numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.pay_send_strip_part(p_base) || ' · ' || p_part || ' of ' || p_of || ' from $' || to_char(p_total, 'FM999,999,999,990.00');
$$;

CREATE OR REPLACE FUNCTION public.pay_send_total(p_source_kind text, p_source_id text)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
           WHEN p_source_id IS NULL THEN NULL
           WHEN p_source_kind = 'cashapp' THEN (SELECT abs(t.amount) FROM public.cashapp_transactions t WHERE t.id = p_source_id)
           WHEN p_source_kind IN ('mercury', 'apple_pay') THEN (SELECT abs(m.amount) FROM public.mercury_transactions m WHERE m.id::text = p_source_id)
           ELSE NULL
         END;
$$;

CREATE OR REPLACE FUNCTION public.pay_send_stamp_parts(p_source_kind text, p_source_id text, p_total numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_n int;
  v_sum numeric;
  v_total numeric;
  v_i int := 0;
  r record;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_source_id IS NULL THEN
    RETURN jsonb_build_object('n', 0);
  END IF;
  SELECT count(*), COALESCE(SUM(amount), 0) INTO v_n, v_sum
  FROM public.pay_stub_payments WHERE source_kind = p_source_kind AND source_id = p_source_id;
  IF v_n <= 1 THEN
    UPDATE public.pay_stub_payments
       SET memo = NULLIF(public.pay_send_strip_part(memo), '')
     WHERE source_kind = p_source_kind AND source_id = p_source_id AND memo IS DISTINCT FROM NULLIF(public.pay_send_strip_part(memo), '');
    RETURN jsonb_build_object('n', v_n);
  END IF;
  v_total := COALESCE(p_total, public.pay_send_total(p_source_kind, p_source_id), v_sum);
  FOR r IN
    SELECT id, memo FROM public.pay_stub_payments
    WHERE source_kind = p_source_kind AND source_id = p_source_id
    ORDER BY paid_at, created_at, id
  LOOP
    v_i := v_i + 1;
    UPDATE public.pay_stub_payments
       SET memo = public.pay_send_part_memo(COALESCE(NULLIF(r.memo, ''), public.pay_send_memo(p_source_kind, p_source_id, NULL)), v_i, v_n, v_total)
     WHERE id = r.id;
  END LOOP;
  RETURN jsonb_build_object('n', v_n, 'total', v_total);
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
  v_offset_desc text;
  v_person_id uuid;
  v_existing jsonb;
  v_lane text;
  v_queue_row boolean := false;
  v_n int;
  v_i int := 0;
  v_row_memo text;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_source_kind IS NULL OR p_source_kind NOT IN ('cashapp', 'mercury', 'apple_pay', 'client_direct', 'other') THEN
    RAISE EXCEPTION 'source_kind must be cashapp, mercury, apple_pay, client_direct or other';
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
    SELECT jsonb_agg(jsonb_build_object('payment_id', p.id, 'pay_stub_id', p.pay_stub_id, 'amount', p.amount, 'memo', p.memo))
      INTO v_existing
    FROM public.pay_stub_payments p
    WHERE p.source_kind = p_source_kind AND p.source_id = p_source_id;
    IF v_existing IS NULL THEN
      SELECT jsonb_agg(jsonb_build_object('offset_id', o.id, 'amount', o.amount, 'description', o.description))
        INTO v_existing
      FROM public.person_offsets o
      WHERE o.type = 'advance' AND o.person_name = p_person AND (o.description = v_memo OR o.description LIKE v_memo || ' · %');
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
  v_n := jsonb_array_length(v_plan);

  IF p_source_kind = 'cashapp' THEN
    SELECT true INTO v_queue_row FROM public.cashapp_transactions t WHERE t.id = p_source_id;
    v_queue_row := COALESCE(v_queue_row, false);
  END IF;
  v_lane := CASE WHEN v_n > 0 THEN 'recorded' ELSE 'advance' END;
  v_offset_desc := CASE
    WHEN v_left > 0 AND v_n > 0 THEN v_memo || ' · $' || to_char(v_left, 'FM999,999,999,990.00') || ' of $' || to_char(ROUND(p_amount, 2), 'FM999,999,999,990.00') || ' ahead'
    ELSE v_memo
  END;

  -- the memo each row will wear: the part suffix when the send lands on more than one report
  IF v_n > 1 THEN
    SELECT jsonb_agg(e || jsonb_build_object('memo', public.pay_send_part_memo(v_memo, (ord)::int, v_n, ROUND(p_amount, 2))) ORDER BY ord)
      INTO v_plan
    FROM jsonb_array_elements(v_plan) WITH ORDINALITY AS t(e, ord);
  ELSE
    SELECT COALESCE(jsonb_agg(e || jsonb_build_object('memo', v_memo)), '[]'::jsonb) INTO v_plan FROM jsonb_array_elements(v_plan) e;
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'status', 'planned', 'person', p_person, 'amount', ROUND(p_amount, 2), 'memo', v_memo, 'paid_at', v_paid_at,
      'allocations', v_plan, 'parts', v_n, 'leftover_to_advance', v_left,
      'offset_description', CASE WHEN v_left > 0 THEN v_offset_desc ELSE NULL END,
      'cashapp_lane', CASE WHEN v_queue_row THEN v_lane ELSE NULL END
    );
  END IF;

  -- apply
  FOR v_stub IN SELECT (e->>'pay_stub_id')::uuid AS id, (e->>'amount')::numeric AS amount, e->>'memo' AS memo FROM jsonb_array_elements(v_plan) e
  LOOP
    v_i := v_i + 1;
    v_row_memo := v_stub.memo;
    INSERT INTO public.pay_stub_payments (pay_stub_id, amount, paid_at, memo, created_by, source_kind, source_id)
    VALUES (v_stub.id, v_stub.amount, v_paid_at, v_row_memo, auth.uid(), p_source_kind, p_source_id)
    RETURNING id INTO v_payment_id;
    v_first_payment := COALESCE(v_first_payment, v_payment_id);
    v_rows := v_rows || jsonb_build_object('payment_id', v_payment_id, 'pay_stub_id', v_stub.id, 'amount', v_stub.amount, 'memo', v_row_memo);
  END LOOP;

  IF v_left > 0 THEN
    INSERT INTO public.person_offsets (person_name, person_id, type, amount, description, occurred_date)
    VALUES (p_person, v_person_id, 'advance', v_left, v_offset_desc, p_paid_on)
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
    'rows', v_rows, 'parts', v_n, 'leftover_to_advance', v_left, 'offset_id', v_offset_id,
    'offset_description', CASE WHEN v_left > 0 THEN v_offset_desc ELSE NULL END,
    'cashapp_lane', CASE WHEN v_queue_row THEN v_lane ELSE NULL END
  );
END;
$$;

-- ── link_pay_send: restamp the source's rows after each link ─────────────────────────────────

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
  v_after text;
  v_parts jsonb;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF p_source_kind IS NULL OR p_source_kind NOT IN ('cashapp', 'mercury', 'apple_pay', 'client_direct', 'other') THEN
    RAISE EXCEPTION 'source_kind must be cashapp, mercury, apple_pay, client_direct or other';
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
    v_memo := public.pay_send_memo('cashapp', p_source_id, public.pay_send_strip_part(v_memo));
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

  -- one send on several rows: every row says its part and the whole
  v_parts := public.pay_send_stamp_parts(p_source_kind, p_source_id);
  SELECT memo INTO v_after FROM public.pay_stub_payments WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'status', 'linked', 'payment_id', p_payment_id, 'pay_stub_id', v_row.pay_stub_id, 'person', v_person,
    'source_kind', p_source_kind, 'source_id', p_source_id,
    'amount_before', v_row.amount, 'amount_after', COALESCE(ROUND(p_amount, 2), v_row.amount),
    'memo_before', v_row.memo, 'memo_after', v_after, 'parts', v_parts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_send_strip_part(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_send_part_memo(text, int, int, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_send_total(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_send_stamp_parts(text, text, numeric) TO authenticated, service_role;
