---
name: "GC mode, Owner Billing O5: money in — payments, promises, reminders"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 7, O5)
status: planned 2026-10-08 by Helper 5 at the lead's ask, written so the part that needs neither O4a's bills nor the owner's billing-job answer can ship first (O5a) · nothing built
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

**The migration, a draft until O4a's columns are on main.** Its final SQL comes in O5b's own mockup
then, for the byte-for-byte check. Its shape:

```sql
-- gc_remind_customer_to_pay: our ask to pay a late bill, with its email as it went. Never a
-- promise: the day it was due stays. SECURITY INVOKER (O1's dev-only RLS on the reminders).
CREATE OR REPLACE FUNCTION public.gc_remind_customer_to_pay(
  p_pay_app_id uuid, p_on date, p_pay_by date, p_note text, p_subject text, p_lines text[]
) RETURNS uuid
-- Refuses, in words:
--   a pay application that is not there;
--   one still waiting on the architect ("nothing to pay yet");
--   one paid in full (its bill's status, read through O4a's invoice_id);
--   a pay-by day before today;
--   an email with no subject or no lines.
-- Writes:
--   the gc_owner_pay_reminders row;
--   one chase touch through the Pipeline's own add_payment_chase_touch(customer, job, 'note',
--     '<subject> · pay by <day>', NULL, NULL). The customer is projects.customer_id. The job is
--     gc_projects.billing_job_id when there is one, and null when not: the touch is then the
--     customer's alone, which the chase list already reads.
```

"Late" itself stays the kernel's (`payReminderStep`: certified, open, past its due day). The
database checks only what cannot be argued with. The window offers **Remind them to pay** only
where the kernel says the bill can be reminded.

**The email:** `gc-customer-email` (O4b) gains the kind `reminder`. Its words are
`payReminderEmail`'s, moved to `supabase/functions/_shared/gcCustomerEmails.ts` and read by both
sides. It gets a sent copy, a `CUSTOMER_SURFACES` entry, a journey step with a sample email, and
an answer in `personJourney.ts` (HANDOFF's list). The function writes `email_send_log_id` back on
the reminder, through O1's column grant.

**The window:** on Bill the customer, a late bill shows **Remind them to pay**. The send view (the
Board's `GcCustomerSend` pattern) has the pay-by day set 5 days out (`PAY_REMINDER_DAYS`), the
office's line, and the email as it will read. Once sent, the bill's line reads
`payReminderSentWords`: "Reminded today · pay by Wed Oct 14." The guide is
`remind-a-customer-to-pay-a-gc-bill`.

*Check:* on the test project's certified test bill, held late, one reminder to the lead's test
address, on the owner's yes. Its row, its chase touch on the customer and its sent copy are all
there. A second press on a paid bill is refused.

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

## Docs each PR touches

- **O5a:** the release note and fragment.
- **O5b:**
  - the migration doc;
  - `docs/EDGE_FUNCTIONS.md` (the new kind);
  - `docs/SENT_COPIES.md` (`gc_pay_reminder`);
  - the guide;
  - the journeys.
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
