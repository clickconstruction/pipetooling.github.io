---
name: "GC mode, Owner Billing O4a: our bill to the customer"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 5, O4a)
status: built locally 2026-10-08 by Helper 5 at the lead's ask, on claude/gc-owner-billing-o4a (no claim, no push) · cut the day the owner answers decision 1 and the billing-only job · the billing-only PR (mockups/billing-only-job.md) lands first
---

# O4a: our bill to the customer

The plan's O4a, built against the billing-only mockup's shape, so the owner's yes makes it a cut and not a
build. It ships in four PRs, the way O3 and O3-ui split, each from `origin/main`:

| PR | What | Needs |
|---|---|---|
| **O4a-1** | The migration below: `gc_send_owner_pay_app`, `gc_record_certificate`, the billing job, the two links, the service type | The billing-only PR pushed |
| **O4a-2** | The pay application as a file: the app's AIA filler gains the GC form's options, `payAppWorkbook` and `payAppPdf` on main | Nothing (no database) |
| **O4a-3** | **Bill the customer** on `/gc`: the draft, retainage, the form, Send, the certificate, so far with the customer | O4a-1's types; O3-ui (#4963) and O5a (#4966) merged |
| **O4a-4** | Our conditional waiver with each send: `LienReleaseModal` on the billing job, with one optional prop (built) | O4a-3 |

## O4a-1, the migration (byte for byte)

The stamp is a placeholder. The real one is claimed at the cut, the day after the billing-only PR's.

```sql
-- GC mode, Owner Billing's O4a: our bill to the customer (to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md → The RPCs,
-- on branch spike/gc-mode; the SQL is mockups/owner-billing-o4a.md's, byte for byte). It needs the billing-only
-- job (mockups/billing-only-job.md): jobs_ledger.billing_only and its guards come first.
--
-- Sending a pay application files it as it went, with its lines, and opens the project's billing job the first
-- time (decision 1): one jobs_ledger row, billing-only, for the project's customer, its revenue kept at the
-- contract. Recording the architect's certificate makes the bill on that job for what they certified (decision
-- 3), which the customer then pays through the Pipeline's own statement, Stripe, payments and promises.
-- Both functions are SECURITY INVOKER: the GC tables are dev only (decision 2), and the job and its bill go in
-- under the Pipeline's own insert policies.
SET lock_timeout = '3s';

-- The billing job's service type (decision 10). jobs_ledger.service_type_id is required, and none of the
-- Pipeline's types fits a job that only carries bills. Last in the order.
INSERT INTO public.service_types (name, description, sequence_order)
VALUES (
  'General contracting',
  'GC mode: the billing job of a GC project we build. It only carries our bills to the customer.',
  (SELECT COALESCE(MAX(sequence_order), 0) + 1 FROM public.service_types)
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
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
    SELECT * INTO v_customer FROM public.customers WHERE id = v_project.customer_id;
    INSERT INTO public.jobs_ledger (
      master_user_id, service_type_id, hcp_number, job_name, job_address, status, billing_only,
      customer_id, customer_name, customer_email, customer_phone, revenue
    ) VALUES (
      COALESCE(public.company_owner_user_id(), auth.uid()),
      (SELECT id FROM public.service_types WHERE name = 'General contracting'),
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
```

### What it does, and why each choice

- **The billing job** (decision 1) is opened by the first send, never before:
  - billing-only (the billing-only PR's column), `working`, with bills inserted as `billed` (decision 10's read);
  - named "<project> (GC)", at the project's address, for `projects.customer_id`, with the customer's name, email and phone copied the way `create_job_from_estimate` copies them;
  - `project_id` null (decision 10: a superintendent's project would list it);
  - master `company_owner_user_id()`, the owner of every job since one company (`20260907010000`);
  - the next job number from `next_job_number_suggestion()`, the number every new job gets;
  - **revenue kept at the contract today** (`gc_owner_contract_now`: the signed lines and every signed change order) by every send and every certificate. `mark_invoice_paid` marks a job paid once payments reach its revenue, so a short revenue would close the job early. A change order signed between a send and the next certificate leaves revenue short only until that certificate. No payment comes before one, since the certificate makes the bill.
- **The bill** (decision 3) is made by the certificate, for what the architect certified:
  - inserted already `billed`, `billed_at` at noon Central on the certificate day and `estimated_bill_date` that day, as `create_billed_shell_invoice` does;
  - the next `sequence_order` on the job;
  - no bill-to columns: the Pipeline works out the payer when it sends (`billToParty.ts`), from the job's customer;
  - the job's `last_bill_date` moves to the day;
  - nothing certified makes no bill.
- **Once only:** a recorded certificate, the bill's link and the waiver's link stay as written (`gc_owner_pay_apps_links_once`). A link goes to null only when its bill or waiver is deleted. Fixing a wrong certificate is the Pipeline's own write-down on the bill, not a new certificate.
- **Refusals**, in words, before a table's check would:
  - `gc_send_owner_pay_app` refuses:
    - a job we bid or lost, or one with no signed contract;
    - a number other than the next, anything after the final one, and a final one before the acceptance (O7);
    - a sent day still to come (`app_today()`), and a bill day before the last one's;
    - nothing due, no lines, a line that is not this project's (a trade, or a change order not signed), and lines whose work does not add up to the bill's.
  - `gc_record_certificate` refuses:
    - a certificate already recorded;
    - more than we asked, less without a why, below zero;
    - a day before it went, or still to come;
    - a project with no billing job.

### Checked on a local Postgres 15

The run was on 2026-10-08, with O1's and O3's migrations as on main, and stand-ins for `jobs_ledger`, `jobs_ledger_invoices` with its `billed_at` trigger, `service_types`, `customers`, `projects` and `job_lien_releases` (scratchpad `stubs-o4a.sql`, `t4a.sql`):

- every refusal above, in its words;
- the first send filed pay application 1 with its five lines in order, and opened job #1072 "Fair Oaks Shops, Building D (GC)":
  - billing-only, `working`, revenue 180,900 (the signed contract), General contracting;
  - the customer's name, email and phone, and no project;
- a change order signed, then pay application 2 with its line: revenue 182,000;
- a certificate for 48,000 of 48,600 with its why made bill 48,000, `billed`, sequence 0, billed 2026-10-26 12:00 Central, linked;
- a second certificate, a plain rewrite of the certificate or the bill's link, and moving the waiver's link once set: each refused;
- a certificate of 0 made no bill;
- an estimator reached nothing (dev-only RLS);
- the bill deleted set its link to null;
- the project deleted took its pay applications and lines, and the billing job stayed with its history;
- the migration run twice: no error, one service type.

## O4a-2, the files

`src/lib/fillAiaG702G703Workbook.ts` gains options only our caller passes. The Pipeline's AIA window passes
exactly `{ splitLaborMaterial }`, and its render test pins that, so its file is unchanged:

- **`gcForm`:**
  - A5 "TO CUSTOMER:" over "TO OWNER:";
  - J44 "ARCHITECT:" over "CONSTRUCTION MGR:";
  - L8/N8 "PROJECT OWNER:" with the property's owner when that is someone else;
  - J26 "State of: Texas" with the county left blank for the notary's wet signature.
- **`rowRetainage`:** each row's own retainage, written as a number over its `H × C28` formula, when a retainage step lowers it partway. `buildAiaPreview` takes it too, so K49, line 5 and the cached results agree.

`src/lib/gc/payAppFileWriters.ts`:
- `payAppWorkbook(template, app, parties)` hands `payAppCells` to the filler, with line 7 in `g702_h40_less_previous_certificates`. More lines than the 703's 34 rows throws the filler's `AiaTooManyRows`, never a short file.
- `payAppPdf` is the prototype's two pages, with main's words.
- `downloadPayAppExcel` and `downloadPayAppPdf` save the files.

Tests: the Fair Oaks D draft through the template (who it goes to, who certifies, the notary, line 7, the
rows), a stepped retainage with each row's own and the totals following, the PDF, and the Pipeline's form unchanged without the options.

## O4a-3, Bill the customer (the window)

Built and tested locally on `claude/gc-owner-billing-o4a`, over O3-ui and O5a. **Bill the customer** sits on a won project's card on `/gc`, beside **Change orders**, and is dev only. It opens at `?bill=<project>`.

**What it reads.** When it opens, it reads the project's terms, its price as signed and its bills: `loadGcOwnerTerms` and O5a's `loadGcOwnerBillingRows`. `billingStateFor` (`src/lib/gc/billCustomer.ts`, pure, with its test) lays them over the board's project and its change orders:
- the signed price by line;
- the job's retainage and step, read off the customer the way the kernels read them (decision 6);
- the property's owner by name;
- the record.

**The window** (`GcBillCustomer.tsx`, with its render test) has four parts:
1. **Where we stand:** billed so far, what they hold back, certified or asked, and what waits on the architect (`ownerAccount`).
2. **This month's bill:** `ownerPayApp`'s lines with their worth, this month and so far. Then the work so far, what they hold back (`ownerRetainageWords`), less earlier certificates, and what it asks, with what the architect left out before.
   - **Send pay application N** sends `payAppSendPayload`: `ownerPayAppToSend`'s record plus the lines' kinds and keys. Its test reads the payload back through O5a's mapper as the record.
   - **See the form in Excel** and **See the form as a PDF** download the form.
   - Until the contract is marked signed, the window says so instead.
3. **Retainage:** the percent and a step that lowers it partway, a plain update of the project's columns. Bills that went keep theirs.
4. **Sent:** each one with its form, and **Record the certificate**: the amount, which starts at what we asked, the day, and why when it is less.

**Checked live** on prod as the dev (2026-10-08), through the dev server. It only read, and nothing was pressed:
- the test project's window opened and read its 10% retainage from prod;
- it said the contract is not marked signed;
- the step editor drew its words;
- at 375 px nothing scrolls sideways;
- the console was clean.

Send, the certificate and a draft on a signed contract wait for O4a-1 on prod. The render and kernel tests cover them until then.

Guide: `bill-the-customer-on-a-gc-job.md`. Docs:
- `BILLING_FLOWS.md` → *GC mode: a project's billing job*;
- the glossary's *Billing job (GC mode)*;
- `PROJECT_DOCUMENTATION.md` (`/gc` now holds seven windows).

## O4a-4, our conditional waiver

Built locally with O4a-3. It is its own PR at the cut because it touches a Pipeline window.

Our conditional waiver on progress payment goes with each sent pay application. **Make our conditional waiver** is on each sent one that has none yet; one that has it reads "our waiver went with it".

The press:
1. loads the billing job (`fetchJobWithDetailsById`);
2. opens the Pipeline's own `LienReleaseModal` on it, on `conditional_progress`;
3. once the modal mints the waiver, writes `conditional_waiver_id` (`linkPayAppWaiver`). The database keeps that link once written.

**The modal gains one optional prop, `ask: { amount, throughDate }`,** which only this window passes. No bill exists until the certificate (decision 3), so the prop:
- selects no bill;
- fills the amount with what the pay application asked, and the through date with its bill day (`buildLienWaiverPrefill`'s context gains `ask`).

`onIssued` passes the minted row's id. The Pipeline's openers ignore the argument.

**The modal sits at z-index 1100, under our 1200.** So Bill the customer steps aside while it is open and comes back when it closes. Nothing in the Pipeline window moves.

**Tests:**
- `lienWaiverRelease.test.ts`: the ask wins over the bills;
- `GcBillCustomer.render.test.tsx`: the button and the waived chip;
- the modal's own six render suites and the Bill Customer strip's, unchanged and passing.

## Where the trades' work comes from

`ownerPayApp` bills each trade from its reported work (`package.sow`) and our own crew from its percent. On main, `boardProjectFromView` maps `sow: null`, and Building's records (U1) hold no schedules of values or draws yet. So on real data today, a bill carries:
- signed change orders at their percent done;
- general conditions, contingency and fee following the trades' share, which reads 0.

That is the plan's own check for O4a: "a signed change order at 50% drafts a bill for half its price less 10%". The trades' lines follow the day Building's draws reach the board's project. That needs the Building lane's mapper laid over it, as O3-ui lays the change orders. I could not reach Helper 4 to ask which PR brings it.

## The calls this adds (for the lead, and the owner where marked)

1. **The service type shows in the Pipeline's pickers** (owner). "General contracting" would join Plumbing, Electrical and HVAC in about a dozen lists:
   - clock-in, dispatch, the estimator and dispatch tasks;
   - the header search, the job form and the person desk;
   - Materials, Job Tally, the job book and the contract scope library;
   - the supply house forms.

   Three ways:
   - **(a)** take it as a choice there;
   - **(b)** a `service_types.billing_only` flag that those reads leave out, in the billing-only PR;
   - **(c)** put the billing job on an existing type, Plumbing.

   I recommend (b), folded into the billing-only PR, which already touches the crew lists.
2. **A certificate is once.** A wrong one is fixed on its bill with the Pipeline's write-down, not by typing it again.
3. **The types PR after O4a-1.** `database.ts` gains the two links as Row fields, so O5a's test rows gain `invoice_id: null` and `conditional_waiver_id: null` in that same PR. It is done in the local stand-in commit.
4. **The 703's 34 rows.** A GC job with more trades, our three lines and change orders than 34 cannot print. Grouping lines on our bill is a later question, and the window says so in the filler's words.
