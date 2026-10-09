---
name: "GC mode, Owner Billing O6a: the Money tab, read only"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 8, O6)
status: planned 2026-10-08 by Helper 5 at the lead's ask · O6's read-only half, so the money roles have a screen to test before our bill exists · O6a built; O6b as built below, O6b-2's SQL word for word (Helper 15, 2026-10-08)
---

# O6a: the Money tab, read only

The plan's O6 has a read half and a write half:
- **Read:** the Money tab, which this mockup covers.
- **Write:** **Bill the interest**, the interest rate per job, and **Finish date** with the late fee. These are O6b, after O4a.

O6a reads only what O1, O3, O5a and the kernels already give, plus O4a's record once it lands. It writes nothing, so it has no migration and no function. Its only gate is the audience.

## Who sees it

The owner and the controller, the plan's decision 2. The Board's B5-a named that audience once: `gc_money_team()` in the database, and `GC_MONEY_TEAM` / `canSeeGcMoney` in `src/lib/gc/access.ts` (dev, the leaders, the controller). O6a shows **Money** to `canSeeGcMoney(role)`.

Today Owner Billing's tables are dev only (O1's policies), so a leader or the controller would read empty rows. **While it is built, Money shows for a dev only**, beside the Board's lenses. The Owner Billing door, the plan's own door PR, swaps the policies to `gc_money_team()` and lets the gate read `canSeeGcMoney`. It is one line in the page.

## Where it sits

A fifth lens on the dev switch on `/gc`: **Project Board · Trade partners · Follow up · Trade portals · Money**.
- `devView === 'money'`, as `GcProjects.tsx` holds the others.
- The prototype placed it as a board tab, the Board lane's to place, and this is that place. Helper 2 owns the switch, so the one line there is agreed with them.
- **Bill the customer** on any row opens O4a's window at `?bill=<project>`. Until O4a, the row reads without the button.

## What it reads

One read for every job that is ours, `buyout` or `building`, as `allJobsMoney` counts them:

| Rows | From | On main |
|---|---|---|
| The board's projects and customers | `loadGcBoardRows` → `boardStateFromRows` | yes |
| Change orders | O3-ui's `loadGcChangeOrders`, `withChangeOrders` | yes (#4963) |
| Our bills as they went | O5a's `loadGcOwnerBillingRows` | yes (#4966) |
| The price as signed, the retainage, the days to pay | `gc_owner_contract_lines`, O1's `gc_projects` columns | the tables yes; the read is O4a-3's `loadGcOwnerTerms`, here for many projects |

`billingStateForAll(state, rows)` is O4a-3's `billingStateFor` for every project at once, in `billCustomer.ts`, with the same test. It lays each job's signed price, retainage, step and record over the board's project. Both windows then read one state builder. If O6a is cut before O4a-3, it brings `billCustomer.ts` with it and O4a-3 takes it from main.

## The sections, and what each reads today

Each section is the prototype's own, read by the kernels already on main (O2a, O2b). Each says in plain words when it has nothing yet, and never shows a made-up number.

| Section | Kernel | Reads real data | Waits on |
|---|---|---|---|
| **Across our N jobs:** paid in, paid out, where we stand | `allJobsMoney().totals` | The jobs and what we billed (O5a) | Paid in: O5c (the payments on the billing job). Paid out: Building's U6 (the trades' draws). Until both, it reads "Nothing paid in or out yet" over the billed and held totals. |
| **Who owes us:** late first, then waiting on the architect | `allJobsMoney().owed`, `ownerPayDue`, `ownerLateBills` | Every sent pay application with money open (O5a) | O4a for any bill to exist. "Late" counts from the certificate plus `owner_pay_days` (decision 7), so a job with no days typed is never late. |
| **Each job:** its price, billed, held, owed, waiting on the architect, **Bill the customer** | `allJobsMoney().jobs`, `ownerAccount`, `ownerContractPrice` | The signed price and signed change orders (O1, O3), and the record (O5a) | The trades' side of each job waits on U6. |
| **Bill day across our jobs:** which job bills on the 25th, and about how much | `billDay` | The drafts from `ownerPayApp` | Until U6, a draft carries signed change orders at their percent, as the plan's O4a check has it. The section says the trades' lines join once they report. |
| **What each job makes us** | `allJobsMargin`, `jobMargin` | The signed price, and the Board's carried quotes once B5-b/c map them | Our own crew at its Pipeline cost (U8). Until then, our crew reads at its budget, as `jobMargin` already marks it. |
| **What we bill, month by month** | `billingByMonth`, `billingForecast` | Nothing yet | The schedule lane's activities mapper (no schedule read on main yet) and U6's SOV lines. Hidden until then, with one line saying why. |
| **The next six weeks** | `cashAhead` | Our bills: their expected days from the pay days typed | The trades' draws (U6). Shown as "the customer's side only" until then, which is the plan's "owner side only until U6". |
| **Interest on late bills** | `ownerInterest` | (none) | **O4a**, for certificates and due days, then O6b for the rate and **Bill the interest**. Marked "comes with our bill". |
| **The late finish** | `lateFinish` | (none) | **O4a**, for the contract with its days, then O6b's **Finish date** and late fee. Marked "comes with our bill". |

The last two show one line each and no numbers: *Interest on late bills comes once we bill the customer from the app.*

## The screen

`src/components/gc/GcMoney.tsx` ports the prototype's five pieces (branch `spike/gc-mode`):
- `GcOwnerBillingMoney`: the headline, who owes us and each job;
- `GcOwnerBillingBillDay`;
- `GcOwnerBillingMargin`;
- `GcBillingForecastMoney`;
- `GcOwnerBillingAhead`.

They are read only, so the prototype's dispatch props go. Each is its own section with a heading, in the order above. On a phone each job is a card, as the Board's rows are, and nothing scrolls sideways at 375 px. Numbers use `money` from `words.ts`.

## Its checks

- **`billCustomer.test.ts`** gains `billingStateForAll` beside `billingStateFor`: two jobs, each with its own retainage, signed price and record, and the other projects left as the board's.
- **The kernels** are pinned already, `ownerBilling.test.ts` and `ownerBillingRest.direct.test.ts`, so the screen adds no math.
- **`GcMoney.render.test.tsx`** on the test state:
  - the headline's words;
  - who owes us, late first;
  - each job's row and its **Bill the customer**;
  - each waiting section saying why, with no number.
- **Live, read only,** on the test project as the dev: Money opens, lists the job with its signed price, and says what waits.
  - Before O4a, signing the test project's contract at test numbers is the one write, made only on the lead's OK.
  - After O4a, the walk adds one sent pay application and its certificate.

## Docs

- The guide `see-the-money-on-our-gc-jobs.md` (dev). Its title is the plan's, and its first paragraph is plain prose for the share card.
- `PROJECT_DOCUMENTATION.md`: the `/gc` paragraph names the Money lens.
- `GLOSSARY.md`: nothing new. Billing job and change order are there.
- The release note and fragment.

## The PR

**O6a**, one PR, cut from `origin/main` after O3-ui (#4963) merges. O5a is already in. It is cut before or after O4a-3: whichever lands first brings `billCustomer.ts`.

## The calls this adds

1. **Show a section that has nothing real yet, or hide it?** I recommend one line in its place, with no numbers, as above. The money roles then see what is coming and when. Hiding the section would make the tab look finished.
2. **Who sees Money before the door:** dev only, as the tables are. The door PR opens Money and the tables together to the money team.

## Is this the best we can do?

It puts the money roles on the prototype's own screen over real data, one section at a time as each input lands, and never shows a number it cannot back. It could be better two ways:

1. **The billing jobs' own AR.** Each GC job's bills live on its billing job, so the Pipeline's AR, pay speeds and chase list already count them once O4a makes them. Money could link each job to its billing job's Pipeline card. That is one line once O4a's billing job exists, and worth it in O6b.
2. **One money read for both modes.** The owner sees AR on the Pipeline's dashboard and GC money here. A later "all money" view would read both. That is out of this lane, and noted for the owner's list.

## O6b, as built (Helper 15, 2026-10-08)

The lead said go on O6 as three PRs on 2026-10-08, one open at a time after O5d, with three calls:
- (a) interest runs from the day after the contract's due day only, and a promise never moves it;
- (b) the rate prefills 1.5, with nothing saved until Save;
- (c) the finish day is Building's (`substantialCompletionOn`), so O6b-3 builds the fee only, with no column.

**O6b-1 (v2.5002), no migration: interest read and typed.**
- `ownerInterestFrom` returns the day a bill falls due by the contract: the certificate's day, or the day it went, plus
  `owner_pay_days`. Interest runs from the day after, and none runs until the days to pay are typed.
- The terms mapper reads `owner_late_interest_pct_per_month` and `owner_late_finish_per_day`, which nothing read before.
- Bill the customer's terms gain **Interest**.
- Money gains each job's interest (`GcMoneyInterest`), replacing its "comes later" line.
- The forecast takes O5d's fallback to the contract's days.
- The rule is named in its fragment for the owner's Texas prompt-pay check (call 6).

**O6b-2 (v2.5003), one migration: Bill the interest.** `gc_send_owner_interest_bill` files the job's next interest bill
today, with its bill on the billing job. The window offers `ownerInterest().toBill` and never more, and its tick
(off to start) emails it through `gc-customer-email`, kind `interest_bill`, filed as `bill_gc_interest`.

The lead's call on the revenue: an interest bill is money beyond the contract, so the billing job's revenue becomes the
contract plus the interest billed (`gc_owner_billing_revenue`). Otherwise paid interest could mark the job `paid` while a
bill is open, and the portal drops bills on paid jobs. O4a's `gc_send_owner_pay_app` and `gc_record_certificate` are
restated word for word from 20261009200000, with only their revenue reset calling the new helper.
`gc_owner_contract_now` stays the contract the G702 reads.

**O6b-3, no migration: the late fee.**
- **Late fee a day** is typed in the terms.
- Money's late finish is `lateFinish`, reading the finish from Building's substantial completion day when it exists and
  the schedule's projected finish until then. The day's column is on Building's list.

### O6b-2's SQL as built

`supabase/migrations/20261009220000_gc_send_owner_interest_bill.sql`, word for word:

```sql
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
```
