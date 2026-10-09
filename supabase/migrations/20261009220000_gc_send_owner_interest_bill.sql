SET lock_timeout = '3s';

-- GC mode, Owner Billing's O6b-2 (to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md → PR 8, O6; the SQL is
-- mockups/owner-billing-o6-money.md's "O6b-2's SQL as built", byte for byte, on branch spike/gc-mode): our bill for
-- the interest on a job's late bills. The kernel builds the interest up (ownerInterest: the job's rate a month, from
-- the day after each bill falls due by the contract, decision 7); this files what the office bills and makes its bill
-- on the billing job, which the customer pays like any other.
--
-- An interest bill is money beyond the contract, so the billing job's revenue becomes the contract today plus the
-- interest billed (gc_owner_billing_revenue). O4a kept the revenue at the contract so a payment marks the job paid
-- only when the whole contract is in; with the interest in it, paying the interest cannot mark the job paid while a
-- bill is still open. O4a's send and certificate reset the revenue, so both are restated word for word from
-- 20261009200000 with only that reset calling the new helper. gc_owner_contract_now stays the contract, which the
-- G702 reads. Every function is SECURITY INVOKER behind the money team's policies (the Owner Billing door).

-- The billing job's revenue: our price to the customer today and every interest bill on the job.
CREATE OR REPLACE FUNCTION public.gc_owner_billing_revenue(p_project_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.gc_owner_contract_now(p_project_id)
    + COALESCE((SELECT sum(amount) FROM public.gc_owner_interest_bills WHERE project_id = p_project_id), 0)
$$;

COMMENT ON FUNCTION public.gc_owner_billing_revenue(uuid) IS
  'GC mode (O6b-2): the billing job''s revenue, our price to the customer today (gc_owner_contract_now) and every interest bill, so a payment marks the job paid only when the contract and the interest billed are in.';

REVOKE ALL ON FUNCTION public.gc_owner_billing_revenue(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_owner_billing_revenue(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_billing_revenue(uuid) TO authenticated;

-- gc_send_owner_pay_app and gc_record_certificate, restated word for word from 20261009200000 but for their revenue
-- reset, which keeps the billing job at gc_owner_billing_revenue: the contract and the interest billed.

CREATE OR REPLACE FUNCTION public.gc_send_owner_pay_app(p_project_id uuid, p_app jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gc public.gc_projects%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_number integer;
  v_final boolean;
  v_period date;
  v_sent date;
  v_last_period date;
  v_step jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_kind text;
  v_package uuid;
  v_change_order uuid;
  v_sum numeric := 0;
  v_work numeric;
  v_due numeric;
  v_id uuid;
  v_job uuid;
  v_type uuid;
  v_position integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to send a pay application.';
  END IF;
  SELECT * INTO v_gc FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  IF v_gc.stage = 'bidding' OR v_gc.lost_on IS NOT NULL THEN
    RAISE EXCEPTION 'We bill the customer only on a job we won.';
  END IF;
  IF v_gc.owner_contract_signed_on IS NULL THEN
    RAISE EXCEPTION 'Mark the contract with the customer signed before the first bill.';
  END IF;
  IF p_app IS NULL OR jsonb_typeof(p_app) <> 'object' THEN
    RAISE EXCEPTION 'Send the pay application as the window drafted it.';
  END IF;

  v_number := (p_app ->> 'number')::integer;
  IF v_number IS DISTINCT FROM (SELECT COALESCE(max(number), 0) + 1 FROM public.gc_owner_pay_apps WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'Another pay application went first. Close the window and open it again.';
  END IF;
  v_final := COALESCE((p_app ->> 'final')::boolean, false);
  IF EXISTS (SELECT 1 FROM public.gc_owner_pay_apps WHERE project_id = p_project_id AND final) THEN
    RAISE EXCEPTION 'The final pay application went, so there is nothing more to bill.';
  END IF;
  IF v_final AND NOT EXISTS (SELECT 1 FROM public.gc_owner_acceptances WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'The final pay application goes after the customer accepts the work.';
  END IF;

  v_period := (p_app ->> 'periodTo')::date;
  v_sent := (p_app ->> 'sentOn')::date;
  IF v_period IS NULL OR v_sent IS NULL THEN
    RAISE EXCEPTION 'A pay application needs its bill day and the day it goes.';
  END IF;
  IF v_sent > public.app_today() THEN
    RAISE EXCEPTION 'A pay application cannot go on a day still to come.';
  END IF;
  SELECT max(period_to) INTO v_last_period FROM public.gc_owner_pay_apps WHERE project_id = p_project_id;
  IF v_last_period IS NOT NULL AND v_period < v_last_period THEN
    RAISE EXCEPTION 'Its bill day is before the last pay application''s.';
  END IF;

  v_due := (p_app ->> 'due')::numeric;
  IF v_due IS NULL OR round(v_due, 2) <= 0 THEN
    RAISE EXCEPTION 'There is nothing to bill: no new work since the last pay application.';
  END IF;

  v_lines := p_app -> 'lines';
  IF v_lines IS NULL OR jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'A pay application needs its lines.';
  END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_kind := v_line ->> 'line';
    v_package := nullif(v_line ->> 'packageId', '')::uuid;
    v_change_order := nullif(v_line ->> 'changeOrderId', '')::uuid;
    IF v_kind IN ('trade', 'self') THEN
      IF v_package IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_package AND project_id = p_project_id) THEN
        RAISE EXCEPTION 'Each trade on the bill must be one of this project''s trades.';
      END IF;
    ELSIF v_kind = 'change_order' THEN
      IF v_change_order IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.gc_change_orders WHERE id = v_change_order AND project_id = p_project_id AND status = 'signed'
      ) THEN
        RAISE EXCEPTION 'A change order is billed only once the customer signs it.';
      END IF;
    ELSIF v_kind NOT IN ('gc', 'contingency', 'fee') THEN
      RAISE EXCEPTION 'Each line must be a trade, our own crew, general conditions, contingency, fee or a change order.';
    END IF;
    v_sum := v_sum + COALESCE((v_line ->> 'doneToDate')::numeric, 0) + COALESCE((v_line ->> 'stored')::numeric, 0);
  END LOOP;
  v_work := (p_app ->> 'workToDate')::numeric;
  IF v_work IS NULL OR abs(v_work - v_sum) > 0.01 THEN
    RAISE EXCEPTION 'The bill''s work so far does not add up from its lines. Close the window and open it again.';
  END IF;

  v_step := p_app -> 'retainageStep';
  INSERT INTO public.gc_owner_pay_apps (
    project_id, number, final, period_to, sent_on,
    retainage_pct, retainage_step_at_pct, retainage_step_to_pct, retainage_step_way,
    retainage, work_to_date, due
  ) VALUES (
    p_project_id, v_number, v_final, v_period, v_sent,
    (p_app ->> 'retainagePct')::numeric,
    CASE WHEN jsonb_typeof(v_step) = 'object' THEN (v_step ->> 'atPct')::numeric END,
    CASE WHEN jsonb_typeof(v_step) = 'object' THEN (v_step ->> 'toPct')::numeric END,
    CASE WHEN jsonb_typeof(v_step) = 'object' THEN v_step ->> 'way' END,
    (p_app ->> 'retainage')::numeric, v_work, v_due
  )
  RETURNING id INTO v_id;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_position := v_position + 1;
    INSERT INTO public.gc_owner_pay_app_lines (pay_app_id, position, line, package_id, change_order_id, label, worth, done_to_date, stored)
    VALUES (
      v_id, v_position, v_line ->> 'line',
      nullif(v_line ->> 'packageId', '')::uuid,
      nullif(v_line ->> 'changeOrderId', '')::uuid,
      COALESCE(v_line ->> 'label', ''),
      COALESCE((v_line ->> 'worth')::numeric, 0),
      COALESCE((v_line ->> 'doneToDate')::numeric, 0),
      COALESCE((v_line ->> 'stored')::numeric, 0)
    );
  END LOOP;

  -- The billing job: opened by the first send, its revenue kept at the contract by every one.
  v_job := v_gc.billing_job_id;
  IF v_job IS NULL THEN
    -- Its service type is found by its flag, not its name, so a rename in Settings' catalog never loses it.
    SELECT id INTO v_type FROM public.service_types WHERE billing_only ORDER BY sequence_order, name LIMIT 1;
    IF v_type IS NULL THEN
      RAISE EXCEPTION 'The billing job''s service type is missing. Ask a dev to add General contracting back.';
    END IF;
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
    SELECT * INTO v_customer FROM public.customers WHERE id = v_project.customer_id;
    INSERT INTO public.jobs_ledger (
      master_user_id, service_type_id, hcp_number, job_name, job_address, status, billing_only,
      customer_id, customer_name, customer_email, customer_phone, revenue
    ) VALUES (
      COALESCE(public.company_owner_user_id(), auth.uid()),
      v_type,
      public.next_job_number_suggestion(),
      v_project.name || ' (GC)',
      COALESCE(v_project.address, ''),
      'working',
      true,
      v_project.customer_id,
      v_customer.name,
      nullif(btrim(COALESCE(v_customer.contact_info ->> 'email', '')), ''),
      nullif(btrim(COALESCE(v_customer.contact_info ->> 'phone', '')), ''),
      public.gc_owner_contract_now(p_project_id)
    )
    RETURNING id INTO v_job;
    UPDATE public.gc_projects SET billing_job_id = v_job WHERE project_id = p_project_id;
  ELSE
    UPDATE public.jobs_ledger SET revenue = public.gc_owner_billing_revenue(p_project_id), updated_at = now()
    WHERE id = v_job AND revenue IS DISTINCT FROM public.gc_owner_billing_revenue(p_project_id);
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_send_owner_pay_app(uuid, jsonb) IS
  'GC mode (O4a): our pay application to the customer goes, filed as it went with its lines (ownerPayAppToSend). Refuses another number than the next, a bill day before the last one, an empty bill, a line that is not the project''s, and lines that do not add up. The first send opens the project''s billing job (billing-only, revenue kept at the contract). SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_send_owner_pay_app(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_send_owner_pay_app(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_send_owner_pay_app(uuid, jsonb) TO authenticated;

-- The architect certified it (decision 4: the office types it): what they certified, the day, and why it is
-- less when it is. Their amount becomes the bill on the billing job (decision 3), already billed on that
-- day, which the customer pays through the Pipeline's statement. Nothing certified makes no bill. Returns
-- the bill's id, or null.
CREATE OR REPLACE FUNCTION public.gc_record_certificate(p_pay_app_id uuid, p_amount numeric, p_on date, p_note text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_app public.gc_owner_pay_apps%ROWTYPE;
  v_job uuid;
  v_amount numeric := round(p_amount, 2);
  v_invoice uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record the certificate.';
  END IF;
  SELECT * INTO v_app FROM public.gc_owner_pay_apps WHERE id = p_pay_app_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That pay application is not there.';
  END IF;
  IF v_app.certified IS NOT NULL THEN
    RAISE EXCEPTION 'The certificate on pay application % is recorded already.', v_app.number;
  END IF;
  IF p_on IS NULL OR v_amount IS NULL THEN
    RAISE EXCEPTION 'Type what the architect certified and the day they signed.';
  END IF;
  IF p_on < v_app.sent_on THEN
    RAISE EXCEPTION 'The architect certified it before it went. Check the day.';
  END IF;
  IF p_on > public.app_today() THEN
    RAISE EXCEPTION 'The day they certified it cannot be still to come.';
  END IF;
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'What they certified cannot be below zero.';
  END IF;
  IF v_amount > round(v_app.due, 2) THEN
    RAISE EXCEPTION 'They cannot certify more than we asked for.';
  END IF;
  IF v_amount < round(v_app.due, 2) AND btrim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'They certified less than we asked. Say why.';
  END IF;

  SELECT billing_job_id INTO v_job FROM public.gc_projects WHERE project_id = v_app.project_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'This project has no billing job. Its first pay application opens one.';
  END IF;

  IF v_amount > 0 THEN
    UPDATE public.jobs_ledger SET revenue = public.gc_owner_billing_revenue(v_app.project_id), updated_at = now()
    WHERE id = v_job AND revenue IS DISTINCT FROM public.gc_owner_billing_revenue(v_app.project_id);
    INSERT INTO public.jobs_ledger_invoices (job_id, amount, status, sequence_order, billed_at, estimated_bill_date)
    VALUES (
      v_job,
      v_amount,
      'billed',
      (SELECT COALESCE(max(sequence_order), -1) + 1 FROM public.jobs_ledger_invoices WHERE job_id = v_job),
      (p_on + time '12:00') AT TIME ZONE 'America/Chicago',
      p_on
    )
    RETURNING id INTO v_invoice;
    UPDATE public.jobs_ledger SET last_bill_date = p_on, updated_at = now() WHERE id = v_job;
  END IF;

  UPDATE public.gc_owner_pay_apps
  SET certified = v_amount,
      certified_on = p_on,
      certified_note = btrim(COALESCE(p_note, '')),
      certified_by = auth.uid(),
      invoice_id = v_invoice
  WHERE id = p_pay_app_id;

  RETURN v_invoice;
END;
$$;

COMMENT ON FUNCTION public.gc_record_certificate(uuid, numeric, date, text) IS
  'GC mode (O4a): the architect''s certificate on our pay application, as the office types it (less than asked says why). Makes the bill on the project''s billing job for what they certified, billed that day, and links it. Once only. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_record_certificate(uuid, numeric, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_record_certificate(uuid, numeric, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_record_certificate(uuid, numeric, date, text) TO authenticated;

-- Bill the interest (O6b-2): the amount the window offers (ownerInterest's to bill, never more), filed as the job's
-- next interest bill on today's date under a lock on the project's row, with its bill on the billing job billed today
-- at noon Central as a certificate's is, and the job's revenue raised by it. Refuses a job with no rate, a project
-- with no billing job, and nothing to bill: the database cannot work interest out, so it checks only what cannot be
-- argued with. Returns the interest bill's id.
CREATE OR REPLACE FUNCTION public.gc_send_owner_interest_bill(p_project_id uuid, p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gc public.gc_projects%ROWTYPE;
  v_amount numeric := round(p_amount, 2);
  v_today date := public.app_today();
  v_invoice uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to bill the interest.';
  END IF;
  SELECT * INTO v_gc FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That project is not there.';
  END IF;
  IF v_gc.owner_late_interest_pct_per_month IS NULL THEN
    RAISE EXCEPTION 'This job charges no interest. Set its rate first.';
  END IF;
  IF v_gc.billing_job_id IS NULL THEN
    RAISE EXCEPTION 'This project has no billing job. Its first pay application opens one.';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'There is no interest to bill.';
  END IF;

  INSERT INTO public.jobs_ledger_invoices (job_id, amount, status, sequence_order, billed_at, estimated_bill_date)
  VALUES (
    v_gc.billing_job_id,
    v_amount,
    'billed',
    (SELECT COALESCE(max(sequence_order), -1) + 1 FROM public.jobs_ledger_invoices WHERE job_id = v_gc.billing_job_id),
    (v_today + time '12:00') AT TIME ZONE 'America/Chicago',
    v_today
  )
  RETURNING id INTO v_invoice;

  INSERT INTO public.gc_owner_interest_bills (project_id, number, sent_on, amount, invoice_id, created_by)
  VALUES (
    p_project_id,
    (SELECT COALESCE(max(number), 0) + 1 FROM public.gc_owner_interest_bills WHERE project_id = p_project_id),
    v_today,
    v_amount,
    v_invoice,
    auth.uid()
  )
  RETURNING id INTO v_id;

  UPDATE public.jobs_ledger
  SET revenue = public.gc_owner_billing_revenue(p_project_id), last_bill_date = v_today, updated_at = now()
  WHERE id = v_gc.billing_job_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_send_owner_interest_bill(uuid, numeric) IS
  'GC mode (O6b-2): our bill for the interest on a job''s late bills, the amount the window offers, filed as the job''s next interest bill today with its bill on the billing job, and the job''s revenue raised by it. Refuses a job with no rate, a project with no billing job and nothing to bill. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_send_owner_interest_bill(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_send_owner_interest_bill(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_send_owner_interest_bill(uuid, numeric) TO authenticated;
