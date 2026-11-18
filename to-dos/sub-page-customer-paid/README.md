---
name: "The sub's page: the customer paid, and how long this customer usually takes"
number: 388
group: gated
status: asked 2026-11-17 · nothing built · five calls open
summary: >
  A sub's sheet waits at Draw requested until the customer pays. The page tells the sub that the
  customer's payment is the last thing between them and their money. It then says nothing when the
  office records that payment, and nothing about how long the wait usually is. This card adds two
  things to that one stage. The page says the customer paid, with the day, as soon as the office
  records it. While it waits, the page says how long this customer usually takes, as a range in
  weeks. The office's row for the sheet shows the same words, so the office reads what the sub
  reads.
next: the owner's five calls; calls 1 and 2 open steps 1 and 2, calls 3 and 4 open step 3
size: M as a train of three (S · M · S)
blocker: the owner's calls. Call 3 is the big one, whether a customer's pay pace may show on a page with no sign-in
opinion: build — show the customer's payment first, tied to one bill so the page never says paid on a guess; show the pay time as a range in weeks with a floor of five payments, never as the office's raw figure
mockup: to-dos/sub-page-customer-paid/mockup.html
---

# The sub's page: the customer paid, and their usual pay time (#388)

## The ask

The owner, 2026-11-17, the day card #371 (the Statements view) went live:

> On the subportal, should we include the average time it takes for that customer to pay? And when we mark a bill is received, should we show it to the sub in the sub portal?

## What a sub sees today

Read on the code on 2026-11-17.

- **Four dots on every open sheet**: Work, Pre-inspection, Post-inspection: Trigger draw, You're paid. `src/pages/SubPortal.tsx` draws them, and the words are in `src/lib/subPortal/subPortalI18n.ts`.
- **At the third dot** the chip reads *Draw requested*. The sentence says the customer's payment is the last thing between the sub and this money, and that it reaches them the day it lands.
- **The next move is the office's.** The chip turns to *Queued for* a day only when the office gives the sheet a payable-after day (`people_labor_jobs.payable_after`).
- **The page reads none of the customer's bills.** The `sub-portal` function reads the sheet's job for its number and address. It reads nothing from `jobs_ledger_invoices` or `jobs_ledger_payments`. So the sub's page does not change when the office records the customer's payment.
- **A sheet is tied to a job, not to a bill.** `people_labor_jobs.invoice_link` is a web address the office types on the sheet. Nothing says which of the customer's bills a sheet rides on.
- **A hold already shows.** A sheet's hold reason (`pay_hold_reason`) is drawn beside the pay day.

## What the office knows today

- **The pay time is figured already.** `get_billed_customer_pay_speeds` gives each payer's days from a bill to its money over the last 12 months. `paySpeedSpread` in `src/lib/jobs/paymentReliability.ts` turns that into a typical range, and `formatPaysIn` writes it as *Pays in 9–41d*.
- **Only office roles see it**: dev, master, assistant-like and primary. The service role is let through too, for the Bridge's Monday sheet.
- **It shows from one payment.** `RELIABILITY_MIN_RECEIPTS` is 1. That is fine for an office reader who can open the list behind it. It is too thin for a sub.
- **The payer is not always the job's customer.** A bill sent to the builder is filed under the builder (`paySpeedPayer` in `src/lib/jobs/billToParty.ts`).

## What it becomes

Mock-up: `to-dos/sub-page-customer-paid/mockup.html` (on the dev server at `/to-dos/sub-page-customer-paid/mockup.html`). Made-up names, days and amounts throughout.

**One stage changes, the third dot.** The other three read as they do today.

- **While it waits.** The sentence stays. One line is added under it: *This customer usually pays 4 to 6 weeks after we ask.* The line is blank when there is too little history.
- **When the customer pays.** The chip reads *Customer paid* with the day. The sentence reads that the customer paid on that day, and that the sub's payment is next. The usual-time line goes away.
- **When the office queues it.** The chip reads *Queued for* its day, as today.
- **When the sheet is held.** The hold's reason shows right under the new sentence, as it shows beside the pay day today. A sub never reads that the customer paid with no word on why their own money has not moved.
- **The office's row** for the sheet in Jobs → Subs shows *Sub sees: Customer paid* with the day. Past two days with no pay day it turns amber and reads *not queued*.

**What the page never does.**

- It never shows the customer's amount, and it never names who pays.
- It never says the customer paid on a guess. It speaks for one bill, the one the sheet is tied to. A sheet with no tie reads as it does today.
- It never says paid for a part payment. The bill is paid in full first.
- It never shows a pay time from thin history, and never in days. The words are *usually* and a range in weeks.
- It never gives a date the sub can hold the office to.

## The calls

Each has a pick. None is answered yet.

1. **Does the sub's page say the customer paid?** Pick: yes, with the day and no amount. The page already tells the sub this payment is the last thing in the way.
2. **Which payment speaks for a sheet?**
   - **a.** Any payment recorded on the job after the draw was requested. Nothing for the office to do. On a job with several draws it can say paid for the wrong one.
   - **b.** The sheet is tied to one bill when the office requests the draw. The tie is made by itself when the job has one open bill, and the office picks when it has more. A sheet with no tie says nothing. **Pick: b.** It costs one pick on some sheets and never says paid wrongly.
3. **May a customer's usual pay time show on a page with no sign-in?** Anyone holding the link can read it, and it is the office's read on a third party. Pick: yes, as a range in weeks, never the days figure, never the payer's name.
4. **How much history before the line shows?** The office's figure shows from one payment. Pick: five payments in the last 12 months, and blank below that. No falling back to the company's pace, which says nothing about this customer.
5. **Does the office's row flag a sheet whose customer paid and which has no pay day?** Pick: yes, amber after two days. The sub can see the day now, so the office should see the same clock.

## Two things to hand on

- **Counsel.** One sentence on this page is already with counsel. The new sentences sit beside it and speak about when a sub is paid. Hand them over in the same pass.
- **Spanish.** The page's words are reviewed copy. The owner read the Spanish for card #371 himself. The new strings need the same read before step 2 ships them.

## Where it plugs in

- **The tie (new).** A column on `people_labor_jobs`, such as `draw_invoice_id`, pointing at `jobs_ledger_invoices` with `ON DELETE SET NULL`. It is set where the office moves a sheet to *Waiting on customer* in Jobs → Subs (`src/components/jobs/JobsSubLaborTab.tsx`, the stage kernel `src/lib/subSheetStage.ts`).
- **The rule (new, pure).** A kernel under `supabase/functions/_shared/`, beside `subPortalStatement.ts`: the day the tied bill was paid in full, and the pay time as weeks with its floor. `paymentReliability.ts` is not in the edge copy, so restate the spread there with a parity test, or put the kernel under `_shared/` with a re-export. `billToParty.ts` is in the copy already. Do not edit a file the copy holds.
- **The function.** `supabase/functions/sub-portal/index.ts` reads the tied bill's status and its payments' `paid_on`, and calls `get_billed_customer_pay_speeds` as the service role. `SubPortalSheet` in `_shared/subPortalStatement.ts` gains the paid day and the weeks range. Both are fail-soft: a read that fails leaves the page as it is today.
- **The page.** The chip and the sentence are chosen in `src/pages/SubPortal.tsx` where `stageCustomerLine` is read. New strings go in `subPortalI18n.ts`, English and Spanish. `SubPortalGuide.tsx` and the guide `see-what-a-sub-sees-on-their-portal` get the new stage words.
- **The office's row.** `src/lib/subWorkOrders/sheetRail.ts` and `JobsSubLaborTab.tsx`.

## The plan

A train of three. Each step ships on its own.

1. **The tie (S).** The migration, the pick on the stage move, the tie made by itself when the job has one open bill. Office only. The sub's page does not change. Needs call 2.
2. **Customer paid on the page (M).** The rule, the function's read, the chip and the sentence in both languages, the hold beside it, and the office's row. `sub-portal` is deployed on a go that names it. Needs calls 1 and 5.
3. **The usual pay time (S).** The weeks rule with its floor, the function's read and the one line. `sub-portal` is deployed again on a named go. Needs calls 3 and 4.

Steps 1 and 2 can ship while call 3 is still open.

## How to verify

Test rows: the test sub and a ZZ TEST job. Never a real sub's page.

- Seed a sheet for the test sub through the dev seat (`plan_sub_labor`), and a bill on the same ZZ TEST job (`plan_bill`).
- As the office, move the sheet to *Waiting on customer* and check the tie.
- Open the sub's page with no sign-in. It reads *Draw requested*, and no usual-time line, since a test customer has no history.
- Record the bill's payment in part (`plan_job_payment`). The page must not change. Record the rest. The chip reads *Customer paid* with the day.
- Put a hold on the sheet. Its reason shows under the sentence.
- Give the sheet a pay day. The chip reads *Queued for* that day.
- Check the Spanish page for every state.
- The usual-time line needs a payer with five payments. Prove the rule in unit tests with made-up payments, and check on the live page only that a real payer's line matches the office's own figure for them.
- Remove the payments, then the bill, then the sheet. Name in the card what the walk leaves behind.
