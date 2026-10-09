---
name: "GC mode, Owner Billing O5: money in — payments, promises, reminders"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 7, O5)
status: planned 2026-10-08 by Helper 5 at the lead's ask, written so the part that needs neither O4a's bills nor the owner's billing-job answer can ship first (O5a) · O5a and O5c built; O5b as built below, its SQL word for word (Helper 15, 2026-10-08) · O5e's SQL as built below, before its build (Helper 15, 2026-10-09)
---

# O5: money in

The plan's O5: payments read from what the app already records, the customer's promises on the
Pipeline's promise events, our reminders to pay, and our unconditional lien waiver for each payment.
Almost all of it acts on a bill, and bills come with O4a. O4a waits on the owner's answer to the
billing-only job (`mockups/billing-only-job.md`). So this plan says, piece by piece, what each part
needs. **O5a** needs neither and can ship now. **O5b** needs O4a's bills, whatever the owner answers.
**O5c** needs the billing job itself, decision 1 as written.

## What each piece needs

| Piece | O4a's bills | The billing job (decision 1) | PR |
|---|---|---|---|
| The record read back: our pay applications, their lines, reminders, interest bills, the acceptance → the kernels' `OwnerBilling` | no | no | **O5a** |
| A bill's payments and paid day, read from `jobs_ledger_payments` and the bill's status | yes | **yes** | O5c |
| The customer's promises, read from `job_payment_promises` on the billing job | yes | **yes** | O5c |
| **Remind them to pay**: the reminder's record and a touch on the Pipeline's chase list | yes (a certified bill to remind) | no: a chase touch takes the job as optional, so with no billing job it is the customer's touch | O5b |
| The reminder's email (`gc-customer-email`, kind `reminder`) | yes (O4b's function) | no | O5b |
| **They said when**: a promise taken on a call | yes | **yes** (`add_job_payment_promise` is per job) | O5c |
| **They paid part** and **Mark paid** | yes | **yes** (`mark_invoice_paid` is per bill on a job) | O5c |
| Our unconditional waiver for each payment | yes | **yes** (`job_lien_releases` is per job) | O5c |

If the owner turns decision 1 down, O5c is rewritten on whatever replaces the billing job: GC columns
for payments and promises, or a GC waiver. O5a and O5b stand either way.

## O5a — the record read back (ships now)

**`src/lib/gc/ownerBillingRows.ts`**, beside `changeOrderRows.ts`. It is pure, with its test.
`ownerBillingFromRows(rows): OwnerBilling | null` turns the GC tables' rows into the prototype's
`OwnerBilling`, so every O2a and O2b kernel reads real data unchanged. It returns null when a
project has no pay application, interest bill or acceptance: the kernels read none yet.

The input is the generated row types, as in `database.ts`:
- `payApps`: `gc_owner_pay_apps`;
- `lines`: `gc_owner_pay_app_lines`;
- `reminders`: `gc_owner_pay_reminders`;
- `interestBills`: `gc_owner_interest_bills`;
- `acceptance`: `gc_owner_acceptances`, or null;
- and, from O5c, `money`: the bills' rows, payments and promises, absent until then.

**Each pay application → `OwnerPayAppSent`:**
- **Straight copies:** `number`, `periodTo` (`period_to`), `sentOn`, `final` (only when true),
  `retainagePct`, `retainage`, `workToDate`, `due`.
- **The step:** `retainageStep` from the three step columns, when set.
- **The certificate:** `certified` and `certifiedOn`, both null while it waits. `certifiedNote` is
  set only when not empty.
- **`doneToDate`, `worthByLine` and `storedByLine`** come from its lines, keyed the way the kernels
  key them: a trade or our own crew by `package_id`, a change order by `change_order_id`, and
  `gc`, `contingency` or `fee` by `line`. `storedByLine` is set only when a line stored something.
- **`reminders`** come from `gc_owner_pay_reminders`, oldest first:
  `{ on: sent_on, by: pay_by, note, subject, lines }`.
- **`paidOn`** is null until O5c reads the bill. Then it is the day of the payment that closed the
  bill.

**`OwnerBilling` itself:**
- `billed` is the last progress pay application's `workToDate`, and `retainageHeld` is its
  `retainage`. This is the rule `ownerAccount` reads; the prototype kept them by hand.
- `paid` sums the payments: 0 until O5c.
- `acceptedOn` comes from the acceptance.
- `interestBills` are `{ number, sentOn, amount, paidOn }`, with `paidOn` from O5c.

**Its test is a round trip.** Fair Oaks D's made-up `ownerBilling` (the test state) is written out
as rows, by a helper in the test that mirrors what `gc_send_owner_pay_app` will insert. Reading
them back gives the same `payApps`, field by field, less the payments, which wait for O5c. The
kernels then read it the same: `ownerAccount`, `ownerPayApp` and the form's G703 lines on the
mapped project equal the prototype's answers already pinned in `ownerBillingRest.direct.test.ts`.

**`src/lib/gc/gcIo.ts`** gains `loadGcOwnerBillingRows(projectIds)`, the five reads in one
`Promise.all`. Bill the customer (O4a) lays the result over the board's project
(`{ ...project, ownerBilling }`), as O3-ui lays the change orders.

There is no migration, no screen and no guide. The release note and fragment say what it reads.
*Check:* the round-trip test, and the kernels on the mapped record.

## O5b — remind them to pay (after O4a)

**As built (Helper 15, 2026-10-08), after the lead's go and two word calls.** One PR: the migration, `gc-customer-email`'s `reminder` kind, the window and the guide. The migration's SQL follows under *O5b's SQL as built*, word for word, for the byte-for-byte compare. It goes in the lead's morning batch.

**The function:** `gc_remind_customer_to_pay(p_pay_app_id, p_on, p_pay_by, p_note, p_subject, p_lines)` returns
the reminder's id. It is SECURITY INVOKER: the money team's policy on `gc_owner_pay_reminders` (the Owner Billing
door) is its gate, and O1's read-only and twin blocks hold. It refuses, in words:
- a pay application that is not there;
- one still waiting on the architect;
- one certified at nothing, which has no bill;
- one paid in full, read from its bill's status through `invoice_id`;
- a day other than today, and a pay-by day before today;
- an email with no subject or no lines;
- a project with no customer.

It writes the reminder (the lines trimmed, blank ones dropped) and one chase touch through the Pipeline's own
`add_payment_chase_touch(customer, billing job, 'note', '<subject> · pay by <Dy Mon D>', NULL, NULL)`, which lets the
whole money team in (`is_assistant()` counts the controller).

"Late" itself stays the kernel's (`payReminderStep`: certified, open, past its due day). The database checks only what
cannot be argued with. The window offers **Remind them to pay** only where the kernel says the bill can be reminded.

**The email:** `gc-customer-email` (O4b) gains the kind `reminder`, its source the reminder row.
- It sends the subject and lines the function filed, not the request's, so the email is the record.
- It adds the customer's portal line when they already have a link (never minted), as the certified bill's does.
- It refuses a reminder already emailed (`alreadySent`).
- It files the copy as `bill_gc_reminder`, under Bills, and writes `email_send_log_id` back on the reminder through
  O1's column grant.

The words stay in the client kernel (`payReminderMail` in `ownerBillingRemind.ts`), built from plain facts so What
customers see's sample uses them. The reminder row carries them to the function, so nothing moves to the shared file.
It has a `CUSTOMER_SURFACES` step, a journey step with a sample email and an answer in `personJourney.ts`.

**The two word calls (the lead, 2026-10-08):**
- **A, no Pay.** The prototype's "Pay it in your portal, by card or bank transfer." becomes always "Reply with the day
  you will pay.", with the function's portal line when they have a link. The bill is not on Stripe, so neither
  `/pay/<id>` nor the portal can take the money yet. Making the bill a Stripe invoice is the owner's call, as its own PR.
- **B, the waiver.** "Our unconditional lien waiver for it comes to you the day it is paid." becomes "Our unconditional
  lien waiver for it follows once it is paid." The waiver is a press after the payment (O5c), and the app never
  promises what a press has to do.

**The window:** on Bill the customer, a late bill shows **Remind them to pay** (`GcBillRemind.tsx`). The send panel
has the pay-by day set 5 days out (`PAY_REMINDER_DAYS`), **Your line in it**, and the email as it will read, then
**Send the reminder**: the function first, then the email. Once sent, the bill's line reads `payReminderSentWords`:
"Reminded today · pay by Wed Oct 14.", with "The email did not go." when the reminder has no log. The guide is
`remind-a-customer-to-pay-a-gc-bill`.

*Check:* on the test project's certified test bill, held late, one reminder to bids@clickplumbing.com, on Grace's yes
in Helper 15's chat. Its row, its chase touch and its sent copy are all there. A press on a paid bill is refused, which
the SQL bed proves once `mark_invoice_paid` pays the bill in full.

### O5b's SQL as built

`supabase/migrations/20261009210000_gc_remind_customer_to_pay.sql`, word for word:

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O5b (to-dos/gc-mode/mockups/owner-billing-o5.md → O5b, on spike/gc-mode): our ask
-- to pay a late bill. The window drafts the email (payReminderEmail); this files it with the pay-by day and
-- the office's line, and puts one touch on the Pipeline's chase list, before gc-customer-email sends it and
-- writes its email_send_log_id back. Never a promise: the day the bill was due stays. "Late" is the kernel's
-- (payReminderStep: certified, open, past its due day); the database checks only what cannot be argued with.
-- SECURITY INVOKER: the money team's policy on gc_owner_pay_reminders is its gate, and O1's read-only and twin
-- blocks hold for it. The chase touch goes through the Pipeline's own add_payment_chase_touch, which lets the
-- money team in (is_assistant() counts the controller).
CREATE OR REPLACE FUNCTION public.gc_remind_customer_to_pay(
  p_pay_app_id uuid,
  p_on date,
  p_pay_by date,
  p_note text,
  p_subject text,
  p_lines text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_app public.gc_owner_pay_apps%ROWTYPE;
  v_status text;
  v_customer uuid;
  v_job uuid;
  v_subject text := btrim(COALESCE(p_subject, ''));
  v_lines text[];
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to remind them to pay.';
  END IF;
  SELECT * INTO v_app FROM public.gc_owner_pay_apps WHERE id = p_pay_app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That pay application is not there.';
  END IF;
  IF v_app.certified IS NULL THEN
    RAISE EXCEPTION 'Pay application % waits on the architect. There is nothing to pay on it yet.', v_app.number;
  END IF;
  IF v_app.invoice_id IS NULL THEN
    RAISE EXCEPTION 'The architect certified nothing on pay application %, so there is no bill to pay.', v_app.number;
  END IF;
  SELECT status INTO v_status FROM public.jobs_ledger_invoices WHERE id = v_app.invoice_id;
  IF v_status = 'paid' THEN
    RAISE EXCEPTION 'Pay application % is paid in full.', v_app.number;
  END IF;
  IF p_on IS DISTINCT FROM public.app_today() THEN
    RAISE EXCEPTION 'A reminder goes today.';
  END IF;
  IF p_pay_by IS NULL OR p_pay_by < public.app_today() THEN
    RAISE EXCEPTION 'The pay-by day cannot be before today.';
  END IF;
  SELECT array_agg(btrim(l) ORDER BY n) INTO v_lines
  FROM unnest(p_lines) WITH ORDINALITY AS t(l, n)
  WHERE btrim(COALESCE(l, '')) <> '';
  IF v_subject = '' OR v_lines IS NULL THEN
    RAISE EXCEPTION 'The reminder needs its email: a subject and its lines.';
  END IF;
  SELECT p.customer_id, g.billing_job_id INTO v_customer, v_job
  FROM public.projects p JOIN public.gc_projects g ON g.project_id = p.id
  WHERE p.id = v_app.project_id;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This project has no customer to remind.';
  END IF;

  INSERT INTO public.gc_owner_pay_reminders (pay_app_id, sent_on, sent_by, pay_by, note, subject, lines)
  VALUES (p_pay_app_id, p_on, auth.uid(), p_pay_by, btrim(COALESCE(p_note, '')), v_subject, v_lines)
  RETURNING id INTO v_id;

  -- One touch on the chase list: the customer's, pinned to the billing job.
  PERFORM public.add_payment_chase_touch(v_customer, v_job, 'note', v_subject || ' · pay by ' || to_char(p_pay_by, 'Dy Mon FMDD'), NULL, NULL);

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) IS
  'GC mode (O5b): our ask to pay a certified bill that is not paid, filed with the pay-by day, the office''s line and the email as the window drafted it, with one note on the Pipeline''s chase list. Never a promise: the day it was due stays. Refuses a pay application waiting on the architect, one with no bill, one paid in full, a day other than today, a pay-by day before today and an email with no subject or lines. Returns the reminder''s id. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) TO authenticated;
```

## O5c — payments, promises, waivers (after O4a, and the owner's yes to decision 1)

Everything here is the Pipeline's own, on the billing job. Nothing new is stored.

**Payments: `mark_invoice_paid` on the bill.** **They paid part** and **Mark paid** call it with the
amount and **the app's day** (`todayYmdInAppTz`). Left out, the day is UTC's, which reads tomorrow
after 7 pm Central. The money also lands through the Pipeline's other doors: Stripe's webhook, the
Mercury allocations and the Billed list. Bill the customer reads them all back from
`jobs_ledger_payments` by `invoice_id` (O5a's `money` input). The gate is already
`mark_invoice_paid`'s: dev, master, assistant, controller, primary, on a job they can see.

**Revenue** must stay equal to the contract (O4a sets it, and each signed change order raises it).
With revenue short, a payment flips the job to paid and later bills fall off as "on a paid job"
(decision 10's read).

**Promises: `add_job_payment_promise` on the billing job.**
- **They said when** takes the day, who said it, and phone / text / email / in person.
- The customer's own **give us a day** in their portal already writes
  `add_customer_payment_promise` for their jobs, the billing job included.
- O5a's mapper hands a promise to every bill open when it was made (decision 8). `madeOn` is
  `created_at` in the app's zone (`calendarYmdInAppTzFromIso`). `who` is `owner` when
  `source = 'customer'`, else `office`. Voided promises are left out.
- **The gate is narrower:** `can_write_payment_promises` is dev, master and assistant. **The
  controller cannot record a promise today.** That is the owner's call: widen it, or leave
  promises to the office.

**Our unconditional waiver for each payment:** `LienReleaseModal` on the billing job, prefilled
`unconditional_progress` (or `unconditional_final` on the final bill), with the payment's amount
and day and `invoice_ids` naming the bill. It is signed with the stored ink and emailed by
`send-lien-release-email`, and the portal's *Waivers* shows it.

**The window (Bill the customer, O4a's):**
- A certified bill shows when it is due, red once late (`ownerPayDue`).
- It has **They paid part…**, **They said when…** and **Mark paid**.
- "So far with" the customer lists what is late first (`ownerLateBills`).

*Check:* on the test bill:
- a part payment typed in the Pipeline's Billed modal shows here as part paid;
- a promise there moves the due day here;
- the unconditional waiver for it shows in the test customer's portal.

## O5e — the controller reads pay speeds and promises, and records one (Helper 15, 2026-10-09)

O7b found the gap, and O5c above had named its write half as the owner's call. The controller is on the money team, but three gates left it out. `get_billed_customer_pay_speeds` and `list_job_payment_promises` answered NULL to the controller, so a controller's Bill the customer and Money read no customer's usual days to pay and no promise. A bill's due day on a controller's screen could then differ from a dev's and from the Monday money email. And `can_write_payment_promises` refused a controller's **They said when…**.

**The lead's calls (2026-10-09):** widen the two read gates and the write gate, since Bill the customer gives the money team that press. `get_pay_speed_transactions` (Data health) stays as it is. Use the controller audit's form, and build it after O7c.

**As built:** each function is its live definition (`pg_get_functiondef`, read on 2026-10-09, the same as the repo's last) with `'controller'` named beside the others, and nothing else changed. `can_read_payment_promises()` covers `list_job_payment_promises` and `list_payment_promise_records`. `can_write_payment_promises()` covers `add_job_payment_promise` and `void_job_payment_promise`. `get_billed_customer_pay_speeds()` gets its gate and its comment. No client change: gcIo already reads both. The Pipeline's Stages chips and forecast keep their own screen gate (`canSeeBilledExpectedPay`), which still leaves the controller out; that is the Pipeline's call.

**Checked on GitHub's runners** (the Owner Billing SQL bed, `70_controller_reads.sql`, 13 checks, 2026-10-09):
- the customer's usual days to pay and a promise, read the same by the controller as by the dev, with an estimator still reading nothing;
- the controller reading Their word's records;
- the controller's own promise landing, an estimator's refused in its words, and a controller in training mode writing nothing.

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O5e (v2.5029): the controller reads pay speeds and promises, and records a promise. The
-- controller is on the money team, but these three gates left it out, so a controller's Money and Bill the customer
-- read no customer's usual days to pay and no promise, and a controller's "They said when…" was refused. The
-- controller audit's form (20260927230000): each function is its live definition (pg_get_functiondef, read
-- 2026-10-09, the same as the repo's last) with 'controller' named beside the others, and nothing else changed.
-- CREATE OR REPLACE keeps each function's grants and owner. get_pay_speed_transactions, the Data health reader with
-- the same gate, stays as it is (the lead's call).

-- can_read_payment_promises(): list_job_payment_promises and list_payment_promise_records read through it.
CREATE OR REPLACE FUNCTION public.can_read_payment_promises()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'controller', 'primary')
         );
$function$;

-- can_write_payment_promises(): add_job_payment_promise and void_job_payment_promise write through it.
CREATE OR REPLACE FUNCTION public.can_write_payment_promises()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'controller')
         );
$function$;

-- get_billed_customer_pay_speeds(): each customer's median days to pay, Bill the customer's and Money's expected day.
CREATE OR REPLACE FUNCTION public.get_billed_customer_pay_speeds()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'controller', 'primary')
         )
      AS ok
),
samples AS (
  SELECT * FROM public.pay_speed_samples()
),
quarantined AS (
  SELECT count(*)::int AS n
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE p.invoice_id IS NOT NULL
    AND p.paid_on IS NOT NULL
    AND COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) IS NOT NULL
    AND (j.customer_id IS NOT NULL OR j.gc_customer_id IS NOT NULL)
    AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
    AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)
    AND (
      p.paid_on <= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      AND p.payment_type ILIKE 'hcp%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-paydate-corrected%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-payments-split%'
    )
),
quality AS (
  SELECT
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      WHERE p.paid_on IS NOT NULL
        AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))) AS payments_12mo,
    (SELECT count(*)::int FROM samples) AS measurable,
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      WHERE p.invoice_id IS NULL
        AND p.paid_on IS NOT NULL
        AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
        AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)) AS unlinked,
    (SELECT count(*)::int FROM public.jobs_ledger_invoices i
      WHERE i.status IN ('billed', 'paid')
        AND i.billed_at IS NULL
        AND i.estimated_bill_date IS NULL) AS undated_invoices,
    (SELECT n FROM quarantined) AS quarantined,
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      JOIN public.pay_speed_exclusions x ON x.payment_id = p.id
      WHERE p.paid_on IS NOT NULL
        AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))) AS excluded
),
per_customer AS (
  SELECT
    payer_id AS customer_id,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples
  WHERE payer_id IS NOT NULL
  GROUP BY payer_id
),
company AS (
  SELECT
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples
),
segments AS (
  SELECT
    c.customer_type AS seg,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples s
  JOIN public.customers c ON c.id = s.payer_id
  WHERE c.customer_type IN ('residential', 'commercial')
  GROUP BY c.customer_type
),
typed_customers AS (
  SELECT id, customer_type
  FROM public.customers
  WHERE customer_type IN ('residential', 'commercial')
),
recent_samples AS (
  SELECT
    payer_id AS customer_id,
    job_id,
    job_name,
    job_address,
    billed_on,
    paid_on,
    gap_days,
    row_number() OVER (
      PARTITION BY payer_id
      ORDER BY paid_on DESC, billed_on DESC
    ) AS rn
  FROM samples
  WHERE payer_id IS NOT NULL
),
receipts AS (
  SELECT
    customer_id,
    jsonb_agg(
      jsonb_build_object(
        'billedYmd', to_char(billed_on, 'YYYY-MM-DD'),
        'paidYmd', to_char(paid_on, 'YYYY-MM-DD'),
        'gapDays', gap_days,
        'jobId', job_id,
        'jobName', job_name,
        'address', job_address
      )
      ORDER BY paid_on DESC, billed_on DESC
    ) AS arr
  FROM recent_samples
  WHERE rn <= 12
  GROUP BY customer_id
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  jsonb_build_object(
    'company',
    (SELECT CASE WHEN n > 0
              THEN jsonb_build_object('medianDays', median_days, 'samples', n)
              ELSE NULL END
       FROM company),
    'customers',
    COALESCE(
      (SELECT jsonb_object_agg(
                customer_id::text,
                jsonb_build_object('medianDays', median_days, 'samples', n))
         FROM per_customer),
      '{}'::jsonb
    ),
    'segments',
    jsonb_build_object(
      'residential',
      (SELECT jsonb_build_object('medianDays', median_days, 'samples', n)
         FROM segments WHERE seg = 'residential'),
      'commercial',
      (SELECT jsonb_build_object('medianDays', median_days, 'samples', n)
         FROM segments WHERE seg = 'commercial')
    ),
    'customerTypes',
    COALESCE(
      (SELECT jsonb_object_agg(id::text, customer_type) FROM typed_customers),
      '{}'::jsonb
    ),
    'receipts',
    COALESCE(
      (SELECT jsonb_object_agg(customer_id::text, arr) FROM receipts),
      '{}'::jsonb
    ),
    'quality',
    (SELECT jsonb_build_object(
       'payments12mo', payments_12mo,
       'measurable', measurable,
       'unlinked', unlinked,
       'undatedInvoices', undated_invoices,
       'quarantined', quarantined,
       'excluded', excluded
     ) FROM quality)
  )
END;
$function$;

-- Its comment named who it answers; it names the controller now.
COMMENT ON FUNCTION public.get_billed_customer_pay_speeds() IS
  'Per-payer median bill→paid gap (v12, v2.4362: keyed on whoever each bill went to — the GC on a GC-billed bill — via pay_speed_samples(); GC jobs with no customer count again) + company/segment medians + customer types + receipts + data-health quality counts. Rules unchanged from v11 (12 months; bill clock = COALESCE(billed_at, estimated_bill_date); HCP same-day pairs quarantined; billed-after-paid pairs never sampled). NULL outside dev/master/controller/assistant-like/primary (the controller since v2.5029).';
```

## Docs each PR touches

- **O5a:** the release note and fragment.
- **O5b** (as built):
  - the migration doc;
  - `docs/EDGE_FUNCTIONS.md` (the new kind);
  - the guide `remind-a-customer-to-pay-a-gc-bill`;
  - the journeys;
  - `ACCESS_CONTROL.md`, `PROJECT_DOCUMENTATION.md` and `docs/twins/APP_DIRECTORY.md`.

  The copy's kind, `bill_gc_reminder`, needs no `docs/SENT_COPIES.md` line: that doc keeps no list of kinds.
- **O5c:**
  - `docs/BILLING_FLOWS.md` (a GC bill's payments, promises and waivers on the billing job);
  - the guide `record-what-a-gc-customer-paid`;
  - `docs/GLOSSARY.md` if a word is new.

## The owner's calls this plan adds

1. **The controller and promises:** `can_write_payment_promises` leaves the controller out. Should
   the controller record a GC customer's promise, or the office only?
2. **The reminder's pay-by day**, 5 days out (HANDOFF call 6, already on the list).

## Is this the best we can do?

It reads payments and promises from the one place the app keeps them, so a GC bill paid by Stripe,
by bank transfer or at the office reads the same everywhere. It could be better three ways:

1. **The reminder as a chase outcome.** A `reminded` outcome on `job_payment_chase_touches`, beside
   `promised` and `resend`, would let the chase list say "reminded by email Oct 8" in its own words
   instead of a note. It is a one-line CHECK swap on a small table, worth it once the Pipeline's own
   bills get emailed reminders too.
2. **One paid day for both modes.** `mark_invoice_paid` stamps UTC's day when none is passed. Fixing
   its default to the app's day, in its own small PR, would help every Pipeline caller, not just ours.
3. **Promises per bill.** The Pipeline keys a promise to a job, which is right for one bill a job.
   A GC job has a bill a month, and decision 8 hands a promise to every bill open when it was made.
   An optional `invoice_id` on `job_payment_promises` would let the office say which bill. It is
   worth raising once the office has lived with decision 8 for a few bills.
