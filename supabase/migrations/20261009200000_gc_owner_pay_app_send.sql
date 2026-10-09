-- GC mode, Owner Billing's O4a: our bill to the customer (to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md → The RPCs,
-- on branch spike/gc-mode; the SQL is mockups/owner-billing-o4a.md's, byte for byte). It needs the billing-only
-- job (mockups/billing-only-job.md): jobs_ledger.billing_only and its guards come first.
--
-- Sending a pay application files it as it went, with its lines, and opens the project's billing job the first
-- time (decision 1): one jobs_ledger row, billing-only, for the project's customer, its revenue kept at the
-- contract. Recording the architect's certificate makes the bill on that job for what they certified (decision
-- 3), which the customer then pays through the Pipeline's own statement, Stripe, payments and promises.
-- Both functions are SECURITY INVOKER: the GC tables are the money team's (gc_money_team(), the Owner Billing
-- door, 20261009050000), and the job and its bill go in under the Pipeline's own insert policies, which the money
-- team passes (is_office_staff()).
SET lock_timeout = '3s';

-- The billing job's service type (decision 10). jobs_ledger.service_type_id is required, and none of the
-- Pipeline's types fits a job that only carries bills. Last in the order, and billing-only (the owner's call (b),
-- service_types.billing_only from 20261009130000), so the pickers leave it out.
INSERT INTO public.service_types (name, description, sequence_order, billing_only)
VALUES (
  'General contracting',
  'GC mode: the billing job of a GC project we build. It only carries our bills to the customer.',
  (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM public.service_types),
  true
)
ON CONFLICT (name) DO NOTHING;

-- The two links a pay application gains: the bill made at its certificate, and our conditional waiver
-- with it. The interest bill's bill, for O6.
ALTER TABLE public.gc_owner_pay_apps
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conditional_waiver_id uuid REFERENCES public.job_lien_releases(id) ON DELETE SET NULL;
ALTER TABLE public.gc_owner_interest_bills
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.gc_owner_pay_apps.invoice_id IS
  'GC mode (O4a): the bill on the project''s billing job made when the certificate was recorded, for what the architect certified. Null while it waits, or when they certified nothing.';
COMMENT ON COLUMN public.gc_owner_pay_apps.conditional_waiver_id IS
  'GC mode (O4a): our conditional waiver on progress payment (job_lien_releases on the billing job) made with this pay application.';
COMMENT ON COLUMN public.gc_owner_interest_bills.invoice_id IS
  'GC mode (O6): the interest bill''s own bill on the billing job, with its own Pay.';

CREATE INDEX IF NOT EXISTS gc_owner_pay_apps_invoice_idx ON public.gc_owner_pay_apps (invoice_id) WHERE invoice_id IS NOT NULL;

-- The links are written once each: the bill by gc_record_certificate, the waiver by the window after it is
-- made. The certificate's four columns, open since O1, stay as recorded once its bill is made. A link goes
-- to null only when its bill or waiver is deleted (the foreign key's own update, a nested trigger).
GRANT UPDATE (invoice_id, conditional_waiver_id) ON TABLE public.gc_owner_pay_apps TO authenticated;

CREATE OR REPLACE FUNCTION public.gc_owner_pay_apps_links_once()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'Pay application % has its bill, so it keeps it.', OLD.number;
  END IF;
  IF OLD.conditional_waiver_id IS NOT NULL AND NEW.conditional_waiver_id IS DISTINCT FROM OLD.conditional_waiver_id THEN
    RAISE EXCEPTION 'Pay application % has its waiver, so it keeps it.', OLD.number;
  END IF;
  IF OLD.certified IS NOT NULL AND (
    NEW.certified IS DISTINCT FROM OLD.certified
    OR NEW.certified_on IS DISTINCT FROM OLD.certified_on
    OR NEW.certified_note IS DISTINCT FROM OLD.certified_note
    OR NEW.certified_by IS DISTINCT FROM OLD.certified_by
  ) THEN
    RAISE EXCEPTION 'The certificate on pay application % is recorded, and its bill made from it.', OLD.number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gc_owner_pay_apps_links_once ON public.gc_owner_pay_apps;
CREATE TRIGGER gc_owner_pay_apps_links_once
  BEFORE UPDATE ON public.gc_owner_pay_apps
  FOR EACH ROW EXECUTE FUNCTION public.gc_owner_pay_apps_links_once();

-- Our price to the customer today: the contract as signed, by line, and every signed change order. The
-- billing job's revenue is kept at it, so a payment marks the job paid only when the whole contract is in.
CREATE OR REPLACE FUNCTION public.gc_owner_contract_now(p_project_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT sum(worth) FROM public.gc_owner_contract_lines WHERE project_id = p_project_id), 0)
    + COALESCE((SELECT sum(price) FROM public.gc_change_orders WHERE project_id = p_project_id AND status = 'signed'), 0)
$$;

COMMENT ON FUNCTION public.gc_owner_contract_now(uuid) IS
  'GC mode (O4a): our price to the customer on a GC project today, the signed contract''s lines and every signed change order. The billing job''s revenue is kept at it.';

REVOKE ALL ON FUNCTION public.gc_owner_contract_now(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_owner_contract_now(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_contract_now(uuid) TO authenticated;

-- Send a pay application (the prototype's ownerPayAppToSend, as the client builds it): the record as it went
-- and its lines, under a lock on the project's row so two sends never take one number. p_app:
--   number, final, periodTo, sentOn, retainagePct, retainageStep ({atPct, toPct, way} or null), retainage,
--   workToDate, due, and lines: [{line, packageId, changeOrderId, label, worth, doneToDate, stored}], in
--   the bill's order. line is trade, self, gc, contingency, fee or change_order.
-- The first send opens the project's billing job (decision 1): billing-only, for the project's customer,
-- named "<project> (GC)", no project_id (decision 10), the company owner as master, and the next job number.
-- Every send keeps the job's revenue at the contract today. Returns the pay application's id.
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
    UPDATE public.jobs_ledger SET revenue = public.gc_owner_contract_now(p_project_id), updated_at = now()
    WHERE id = v_job AND revenue IS DISTINCT FROM public.gc_owner_contract_now(p_project_id);
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
    UPDATE public.jobs_ledger SET revenue = public.gc_owner_contract_now(v_app.project_id), updated_at = now()
    WHERE id = v_job AND revenue IS DISTINCT FROM public.gc_owner_contract_now(v_app.project_id);
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
