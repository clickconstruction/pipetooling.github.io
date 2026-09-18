SET lock_timeout = '3s';

-- v2.3584 — Person admin through functions: void a pay report, set or clear a person's hours, change
-- their pay setup, tie a bank name to a person — each with a reason, each written to an audit table
-- (the owner, 2026-09-18, on Mike Z: "he was still listed as hourly but not working … How can I
-- adjust his hours? And how can I make it easy for an agent to manage the app to do so in the future?").
--
--   pay_admin_events                          who did what to whom, why, with the before/after payload.
--   void_pay_report(report, reason)           deletes the report and its rows (the archive trigger keeps
--                                             every row); refuses one whose payment carries a source.
--   set_person_hours(person, from, to, hours, reason)
--                                             hours = 0 clears the manual hour rows in the range; hours > 0
--                                             sets every date in the range to that figure.
--   set_pay_config(person, changes, reason)   hourly_wage · is_salary · record_hours_but_salary ·
--                                             show_in_hours · office_hourly_wage, only the keys given.
--   set_cashapp_alias(counterparty, person, not_staff, reason)
--                                             the reconcile alias for a bank name, for both feeds.
--
-- Access: payroll access or the service role; SECURITY INVOKER, so RLS and the read-only blocks apply.

CREATE TABLE IF NOT EXISTS public.pay_admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name text,
  action text NOT NULL CHECK (action IN ('void_report', 'set_hours', 'set_pay_config', 'set_alias')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pay_admin_events IS 'Audit of the person-admin functions (v2.3584): void_pay_report, set_person_hours, set_pay_config, set_cashapp_alias — before/after payload and the reason given.';
CREATE INDEX IF NOT EXISTS idx_pay_admin_events_person ON public.pay_admin_events (person_name, created_at DESC);

ALTER TABLE public.pay_admin_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pay_admin_events_select ON public.pay_admin_events;
CREATE POLICY pay_admin_events_select ON public.pay_admin_events FOR SELECT TO authenticated USING (public.has_payroll_access());
DROP POLICY IF EXISTS pay_admin_events_insert ON public.pay_admin_events;
CREATE POLICY pay_admin_events_insert ON public.pay_admin_events FOR INSERT TO authenticated WITH CHECK (public.has_payroll_access());
GRANT SELECT, INSERT ON TABLE public.pay_admin_events TO authenticated;
GRANT ALL ON TABLE public.pay_admin_events TO service_role;

-- ── void_pay_report ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.void_pay_report(p_stub uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_stub public.pay_stubs%ROWTYPE;
  v_paid numeric;
  v_n int;
  v_sourced int;
  v_payload jsonb;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;
  SELECT * INTO v_stub FROM public.pay_stubs WHERE id = p_stub;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pay report % not found', p_stub;
  END IF;
  SELECT COALESCE(SUM(amount), 0), count(*), count(*) FILTER (WHERE source_id IS NOT NULL)
    INTO v_paid, v_n, v_sourced
  FROM public.pay_stub_payments WHERE pay_stub_id = p_stub;
  IF v_sourced > 0 THEN
    RAISE EXCEPTION 'report % has % payment(s) tied to a real send — unlink or move them first', p_stub, v_sourced;
  END IF;

  v_payload := jsonb_build_object(
    'pay_stub_id', v_stub.id, 'person_name', v_stub.person_name,
    'period_start', v_stub.period_start, 'period_end', v_stub.period_end,
    'gross_pay', v_stub.gross_pay, 'hours_total', v_stub.hours_total, 'net', public.pay_report_net(v_stub.id),
    'payments', v_n, 'paid', v_paid,
    'payment_rows', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'paid_at', p.paid_at, 'memo', p.memo)) FROM public.pay_stub_payments p WHERE p.pay_stub_id = p_stub), '[]'::jsonb)
  );

  DELETE FROM public.pay_stubs WHERE id = p_stub;

  INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
  VALUES (v_stub.person_name, 'void_report', v_payload, btrim(p_reason), auth.uid());

  RETURN jsonb_build_object('status', 'voided') || v_payload;
END;
$$;

-- ── set_person_hours ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_person_hours(p_person text, p_from date, p_to date, p_hours numeric, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_person_id uuid;
  v_d date;
  v_removed int := 0;
  v_set int := 0;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_person, '')), '') IS NULL THEN
    RAISE EXCEPTION 'person is required';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'from and to must be dates with from <= to';
  END IF;
  IF p_hours IS NULL OR p_hours < 0 OR p_hours > 24 THEN
    RAISE EXCEPTION 'hours must be between 0 and 24';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('work_date', h.work_date, 'hours', h.hours) ORDER BY h.work_date), '[]'::jsonb)
    INTO v_before
  FROM public.people_hours h WHERE h.person_name = p_person AND h.work_date BETWEEN p_from AND p_to;

  IF p_hours = 0 THEN
    DELETE FROM public.people_hours WHERE person_name = p_person AND work_date BETWEEN p_from AND p_to;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  ELSE
    SELECT person_id INTO v_person_id FROM public.people_pay_config WHERE person_name = p_person;
    v_d := p_from;
    WHILE v_d <= p_to LOOP
      INSERT INTO public.people_hours (person_name, person_id, work_date, hours, entered_by)
      VALUES (p_person, v_person_id, v_d, p_hours, auth.uid())
      ON CONFLICT (person_name, work_date) DO UPDATE SET hours = EXCLUDED.hours, entered_by = EXCLUDED.entered_by;
      v_set := v_set + 1;
      v_d := v_d + 1;
    END LOOP;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('work_date', h.work_date, 'hours', h.hours) ORDER BY h.work_date), '[]'::jsonb)
    INTO v_after
  FROM public.people_hours h WHERE h.person_name = p_person AND h.work_date BETWEEN p_from AND p_to;

  INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
  VALUES (p_person, 'set_hours', jsonb_build_object('from', p_from, 'to', p_to, 'hours', p_hours, 'before', v_before, 'after', v_after, 'removed', v_removed, 'set', v_set), btrim(p_reason), auth.uid());

  RETURN jsonb_build_object('status', CASE WHEN p_hours = 0 THEN 'cleared' ELSE 'set' END, 'person', p_person, 'from', p_from, 'to', p_to, 'removed', v_removed, 'set', v_set, 'before', v_before, 'after', v_after);
END;
$$;

-- ── set_pay_config ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_pay_config(p_person text, p_changes jsonb, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_key text;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'changes must be a JSON object with at least one of hourly_wage, is_salary, record_hours_but_salary, show_in_hours, office_hourly_wage';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_changes) LOOP
    IF v_key NOT IN ('hourly_wage', 'is_salary', 'record_hours_but_salary', 'show_in_hours', 'office_hourly_wage') THEN
      RAISE EXCEPTION 'unknown pay config key %', v_key;
    END IF;
  END LOOP;

  SELECT to_jsonb(c) - 'person_id' INTO v_before FROM public.people_pay_config c WHERE c.person_name = p_person;

  INSERT INTO public.people_pay_config (person_name) VALUES (p_person) ON CONFLICT (person_name) DO NOTHING;
  UPDATE public.people_pay_config SET
    hourly_wage = CASE WHEN p_changes ? 'hourly_wage' THEN NULLIF(p_changes ->> 'hourly_wage', '')::numeric ELSE hourly_wage END,
    office_hourly_wage = CASE WHEN p_changes ? 'office_hourly_wage' THEN NULLIF(p_changes ->> 'office_hourly_wage', '')::numeric ELSE office_hourly_wage END,
    is_salary = CASE WHEN p_changes ? 'is_salary' THEN (p_changes ->> 'is_salary')::boolean ELSE is_salary END,
    record_hours_but_salary = CASE WHEN p_changes ? 'record_hours_but_salary' THEN (p_changes ->> 'record_hours_but_salary')::boolean ELSE record_hours_but_salary END,
    show_in_hours = CASE WHEN p_changes ? 'show_in_hours' THEN (p_changes ->> 'show_in_hours')::boolean ELSE show_in_hours END
  WHERE person_name = p_person;

  SELECT to_jsonb(c) - 'person_id' INTO v_after FROM public.people_pay_config c WHERE c.person_name = p_person;

  INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
  VALUES (p_person, 'set_pay_config', jsonb_build_object('changes', p_changes, 'before', v_before, 'after', v_after), btrim(p_reason), auth.uid());

  RETURN jsonb_build_object('status', 'updated', 'person', p_person, 'before', v_before, 'after', v_after);
END;
$$;

-- ── set_cashapp_alias ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_cashapp_alias(p_counterparty text, p_person text, p_not_staff boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_key text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_counterparty, '')), '') IS NULL THEN
    RAISE EXCEPTION 'counterparty is required';
  END IF;
  IF NOT COALESCE(p_not_staff, false) AND NULLIF(btrim(COALESCE(p_person, '')), '') IS NULL THEN
    RAISE EXCEPTION 'give a person, or not_staff = true';
  END IF;
  v_key := regexp_replace(lower(btrim(p_counterparty)), '\s+', ' ', 'g');

  SELECT to_jsonb(a) INTO v_before FROM public.cashapp_aliases a WHERE a.counterparty_key = v_key;

  INSERT INTO public.cashapp_aliases (counterparty_key, counterparty, person_name, not_staff, note_contains, note_person_name, updated_at, updated_by)
  VALUES (v_key, btrim(p_counterparty), CASE WHEN COALESCE(p_not_staff, false) THEN NULL ELSE btrim(p_person) END, COALESCE(p_not_staff, false), NULL, NULL, now(), auth.uid())
  ON CONFLICT (counterparty_key) DO UPDATE SET
    counterparty = EXCLUDED.counterparty,
    person_name = EXCLUDED.person_name,
    not_staff = EXCLUDED.not_staff,
    note_contains = CASE WHEN EXCLUDED.not_staff THEN NULL ELSE public.cashapp_aliases.note_contains END,
    note_person_name = CASE WHEN EXCLUDED.not_staff THEN NULL ELSE public.cashapp_aliases.note_person_name END,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

  SELECT to_jsonb(a) INTO v_after FROM public.cashapp_aliases a WHERE a.counterparty_key = v_key;

  INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
  VALUES (CASE WHEN COALESCE(p_not_staff, false) THEN NULL ELSE btrim(p_person) END, 'set_alias', jsonb_build_object('counterparty', btrim(p_counterparty), 'before', v_before, 'after', v_after), btrim(p_reason), auth.uid());

  RETURN jsonb_build_object('status', 'set', 'counterparty', btrim(p_counterparty), 'before', v_before, 'after', v_after);
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_pay_report(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_person_hours(text, date, date, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_pay_config(text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_cashapp_alias(text, text, boolean, text) TO authenticated, service_role;

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
