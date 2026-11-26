---
name: "Bills sent: who paid, when, and what came in each day"
number: 422
group: close
status: asked 2026-11-23 by the owner · the card and the mock-up the same day · the owner asked for two changes, the delivery word at the right edge and every amount's cents smaller, then said build it all · the list with payment made plain in v2.8333 · By day paid in v2.8343 · the Stripe paid day at its source in v2.8335, merged and its migration pushed on the owner's yes the same day · the six Stripe rows filed a day late before the fix moved back in v2.8371, pushed on the owner's yes the same day · the printed month with its calendar and the month buttons that name where they go in v2.8416, the owner's two asks after his own look · a day names the bank deposits on no bill in v2.8493 · a look-only live test on 2026-11-24 found twelve faults, and eleven fixes landed the same day in v2.8442 to v2.8457, walked on the live site and all held · the twelfth, no line ever reading *Opened*, was the mail service's setting, turned on at the owner's word that day, and a bill's line read *Opened* on the live page within hours · left: the leader's look
summary: >
  The owner asked that Bills sent show more clearly who has paid and when, in a way that fits what
  the leader already reads there, and that he can see how much money comes in from Stripe on any
  given day, perhaps as a view he switches to. The page already knows when a bill was paid and how.
  It says the day in small green words beside the delivery word and never draws the way. The card
  suggests a stamp under each amount, a paid count on each day band, and a second view on the same
  page, By day paid: a month of days, each with what came in, and the bills behind a picked day.
  It reads the payment rows the app keeps and makes no new table.
next: The leader opens the day he wanted to check. Then the card is retired.
size: M as a train of three (M · S · M) and the older rows (S), all landed
blocker: The leader's look.
opinion: retire the card after the leader's look; the views and the Stripe day need nothing more
ver: v2.8333 · v2.8335 · v2.8343 · v2.8371 · v2.8442 to v2.8457
---

# Bills sent: who paid, when, and what came in each day (#422)

Mock-up: [`mockup.html`](./mockup.html), served at `/to-dos/bills-sent-who-paid/mockup.html`. The list as it is beside the list with payment made plain, at a desk and on a phone. Then the second view, By day paid, with a day picked. That view can be pressed. Every name, job, bill number, check number and amount on it is made up.

This card follows [#327, Bills sent](../bills-sent-ledger/README.md), which built the page, and #340 (retired 2026-11-26; its card lives in git history at the deleting commit), which built the form on it.

## The ask

The owner asked on 2026-11-23 for Bills sent to "show more clearly who has paid and when, so that [the leader] can see that in an intuitive way that complements what he's looking at. He would like to know how much money is coming in on any given day from Stripe, and maybe that's a new view he can look between."

The reader is the leader, the role `master_technician`. He opens `/bills-sent` now. A plan and a mock-up come before any build.

## The answer, in short

- **The fact is on the page and does not read.** Six reasons, drawn on the real layout in the mock-up.
- **On the list:** a stamp under each amount. *Paid*, the day and the way. Or *Not paid* and the days out.
- **A second view on the same page, By day paid:** a month of days with what came in on each. Press a day for its total and its bills. A chip narrows it to Stripe.
- **No new table and no new access rule.** The page reads `jobs_ledger_payments`, which its four roles read today.
- **One flaw in the data is the owner's call.** A Stripe payment made in the evening is filed on the next day.

## Why paid does not read today

Read from the code on 2026-11-23. The line is `Line` and `PhoneLine` in `src/components/billing/BillsSentLedger.tsx`. The words are `billsSentPaidWords` in `src/lib/billing/billsSent.ts`.

1. **It is the last of five small things.** The paid word sits at the end of the grey facts row, after the pill, the sender, the resend words and the delivery word. The row is 13 px.
2. **Two greens say two things.** *Delivered 9:28 AM* and *Paid Nov 9* are both `var(--text-green-700)` at weight 600, side by side. One is about the email and one is about the money.
3. **The amount looks the same paid or owed.** The bold amount at the right is where the eye goes first. It carries nothing about payment.
4. **Nothing adds it up.** The tiles count what went out. The day band counts what went out. No chip narrows the list to paid or not paid.
5. **Some lines have no day.** The day comes from `bill_send_marks`, which is keyed by the sent copy. A line with no copy gets `paidOn: null` and reads *Paid since*: a text, a Housecall Pro bill, an email from before 2026-10-05.
6. **Part paid says nothing.** `bill_send_marks` answers only for a bill whose status is `paid`. A check for half a bill is on record and the line is silent.
7. **The way is read and thrown away.** `readMarks` reads `paid_how` into `BillsSentMark.paidHow`. `BillsSentLine` has no field for it, so no line draws it.
8. **For a Stripe payment the way is empty anyway.** `paid_how` is the payment row's `payment_type`. The webhook writes a Stripe payment with `payment_type` null and the note *Stripe*.
9. **The list is in the order bills went out.** A payment lands on another day. No part of the page answers *what came in on Tuesday*.

## The holistic look: where the app already says who paid, or what came in

Each line was read in the code. None of them lists every payment by day for the leader.

| Screen | What it reads | The day it uses | Who opens it |
|---|---|---|---|
| Dashboard, the **Money in** bar (`DashboardMoneyInStrip`, kernel `src/lib/moneyInWeek.ts`, reads `moneyInWeekLoad.ts`) | `jobs_ledger_payments`, bank deposits, promises, and `get-stripe-payouts` | A Stripe payment on its `paid_on`. A matched payment on the day its deposit posted. One week, Monday to Sunday | `showFinancials` in `Dashboard.tsx`: dev, leader, assistant, controller |
| The job window's Bill tab (`src/lib/jobs/billsAndPayments.ts`) | The job's payment rows. `paymentSource` words each one: *Card · Stripe*, *Check · bank deposit*, *Check · typed by hand* | `paid_on`, with the days from the send to the money | Whoever opens the job |
| A customer's Invoices tab and timeline (`fetchCustomerInvoices.ts`, `fetchCustomerTimeline.ts`) | `jobs_ledger_payments` for that customer's jobs | `paid_on`, the last one per bill | Whoever opens the customer |
| Accounts Receivable, the deposit window (`BankPaymentsModal.tsx`) | `list_mercury_transactions_for_bank_payments`, `list_unlinked_payments_for_bank_payments`. It writes with `apply_mercury_bank_payment_allocations` | The deposit's posted day | dev, leader, assistant, controller |
| Pipeline, **Billed Awaiting Payment** and **Paid in Full** (`JobsStagesTab.tsx`) | Open balances, and jobs whose status is paid | No day per payment | The office roles |
| Pipeline, **Payment forecast** (`billedPaymentForecast.ts`) | Open bills and each payer's pace | The day a bill is expected, never a day it was paid | The office roles and `primary` (`canSeeBilledExpectedPay`) |
| The pay calendar (`payCalendarIo.ts`) | `payer_pay_calendars`, `invoice_due_days` | A payer's terms: when they should pay | Its own gate |
| Pipeline, **Weekly money** (`JobsWeeklyMoneyModal.tsx`) | `get_weekly_money_movement_payload` | `paid_on`, summed per job per week | Its own gate |
| The Bridge (`src/lib/bridge/loadBridgeData.ts`) | `jobs_ledger_payments`, grouped as `paymentsReceivedByDay` | `paid_on`, as one sum a day with no bills behind it | `isOwnerOrDev`: leader and dev |
| Banking, the Stripe product (`BankingStripeInvoicesPanel`, `BankingStripeWebhookEventsPanel`) | `jobs_ledger_invoices` and `stripe_webhook_events`. No payouts and no paid day | None | `isBankingAdmin`: dev and controller. The leader does not see it |
| View bill (`HostedStripeBillPanel.tsx` → `get-stripe-invoice-details`) | Stripe, live, one bill at a time. It returns Stripe's own `paid_at` | Stripe's paid time | Whoever opens the bill |
| Documents → Sent copies (`DocumentsSentLedger.tsx`) | `sent_documents` | Nothing about payment | The four office roles |
| Messages, a thread's sent lines (`useSentLineFacts.ts`) | `sent_copy_stamps`, with `paidHowWord` | The newest payment's day | Messages' own gate |

What to reuse, so the new view is not a second truth:

- `isStripePayment` in `src/lib/moneyInWeek.ts`: a payment row whose note is *Stripe*. The Money in bar tells a Stripe payment this way.
- `instrumentWord` and the chip words of `paymentSource` in `src/lib/jobs/billsAndPayments.ts`. `paymentSource` takes a whole job today. PR 1 gives it a slimmer door that takes the payment row and the bill.
- `calendarYmdInAppTzFromIso` and the company week helpers in `src/utils/dateUtils.ts`, which the page already imports.
- The loader's `get-stripe-payouts` call in `moneyInWeekLoad.ts`, lifted to a small shared read.
- The page's own day bands, search, bill record, print and CSV.

No kernel groups payments by day with their bills. The Bridge's `paymentsReceivedByDay` is a sum inside an IO file. So the grouping is new, and it is small.

## What the app keeps about a Stripe payment

Traced on 2026-11-23 through `supabase/functions/stripe-webhook/index.ts` and `mark_invoice_paid_from_stripe` (newest definition in `supabase/migrations/20261001153000_payment_actor_and_link.sql`).

When Stripe says a bill was paid (`invoice.paid` or `invoice.payment_succeeded`), the webhook calls `mark_invoice_paid_from_stripe`. That writes **one row** in `jobs_ledger_payments`:

| Column | What a Stripe payment gets |
|---|---|
| `amount` | What was still open on the bill in the app's ledger. Not what Stripe collected |
| `paid_on` | The day the webhook ran, **read in UTC** |
| `created_at` | The instant the row was written, a few seconds after the customer paid |
| `note` | *Stripe* |
| `payment_type`, `reference_number` | Empty |
| `invoice_id`, `job_id` | The bill and the job |

**Not kept anywhere:**

- Whether it was a card or a bank debit through Stripe.
- Stripe's fee, and the amount after the fee.
- The payout that carried the money to the bank, the day it arrived, and which payments were inside it. No webhook event for a payout is handled.
- Stripe's own paid time. `get-stripe-invoice-details` can ask Stripe for it, one bill at a time.
- A refund made in Stripe's dashboard. The bill stays paid in the app.
- A bank debit that has started and not settled. The payment appears when Stripe says paid.
- The charge's id on the payment row. `stripe_webhook_events` keeps an event's id, its type and when it came, nothing else.

**Kept, and useful:**

- A card dispute or a failed bank debit is a case in `ar_stripe_cases`, with the payment it names. A line can say *Disputed*.
- A test-mode bill carries `stripe_mode = 'test'` on `jobs_ledger_invoices`. The view leaves those out, as the page's yellow box does today.
- `get-stripe-payouts` asks Stripe, live, for the next payout and the last one: an amount and an arrival day. It answers the four office roles. It stores nothing and names no bills.

**The other ways a bill is paid** land in the same table:

- A deposit matched in Accounts Receivable: `mercury_transaction_id` set, `paid_on` the day the deposit posted, `payment_type` the bank's kind.
- A payment typed by hand: `paid_on` and `payment_type` as the person gave them. The choices are Cash, Check, Wire, ACH, Card (external), In kind and Other (`PAYMENT_KIND_CHOICES`).
- A Stripe bill paid outside Stripe, by check for instance: the person's day and kind ride through Stripe's metadata, and the note is not *Stripe*.
- A bill can carry several rows. One Stripe payment is always one row for the whole remainder.

### The count

Read through the dev seat on 2026-11-23, read-only, counts only, for the 31 days from 2026-10-24:

- **49 payments.** 9 from Stripe, 37 matched to a bank deposit, 3 typed by hand.
- Money came in on **14 of the 31 days**. Stripe money came on 4 of them.
- **4 of the 9 Stripe payments sit on the wrong day.** Each was paid in the evening, Central time, and is filed on the next day. Three were paid on a Sunday night and read as Monday.
- One deposit often pays several bills. Twice in the window one deposit paid six.
- One row was in kind, a credit and not money.

The count moved the design three ways. Stripe is under a fifth of the payments, so the view shows every way with a chip for Stripe. One deposit pays many bills, so a day groups its lines by deposit. And the evening flaw is real, not a corner case.

## What "money from Stripe on a day" should mean

| Meaning | What the app holds | What it would take |
|---|---|---|
| **A · the day the customer paid, at the bill's amount** (suggested) | Held for every Stripe payment. The Money in bar reads the same rows the same way | Nothing new, once the evening flaw is fixed |
| B · the day the payout reaches the bank | Not kept. Only the next and the last payout can be asked for | A new edge function that reads Stripe's payout history and what is inside each payout. Then the same money has two days on one page |
| C · after Stripe's fee | Not kept | The same new read as B. The figure would no longer match the bills |

I suggest A, with one tile for B's only cheap piece: *Next Stripe payout*, the amount and the day it reaches the bank. That tile is what `get-stripe-payouts` answers today.

What a day's figure then is:

- **A Stripe payment** sits on the day the customer paid, at the amount it paid off the bill.
- **A matched deposit** sits on the day it posted at the bank.
- **A payment typed by hand** sits on the day the person named.
- **In kind** is listed and not added. It is not money.
- **A refund** does not lower a day, because the app does not see it. The foot of the view says so.
- **A dispute** leaves the payment on its day with the word *Disputed* in red. If the bill is put back, the payment row is gone and so is its line.
- **A test-mode bill's payment** is left out.

### The evening flaw

`mark_invoice_paid_from_stripe` files a Stripe payment under `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date`. A comment beside it says the webhook always sends the day. It does not: the webhook sends a day only for a bill marked paid outside Stripe. So a customer who pays after 6 PM Central in winter, or 7 PM in summer, is filed on the next day.

Every screen above that reads `paid_on` shares the flaw today: Money in, the Bridge, Weekly money, a customer's timeline. A by-day view makes it plain, since a Sunday-night payment reads as Monday.

The fix belongs at the source, so every reader agrees:

- One migration replaces the function with the company's day in place of the UTC day.
- Older Stripe rows can be corrected once: the rows whose note is *Stripe* and whose `paid_on` is one day after the Central day of `created_at`. Read the list first. No trigger writes a line when a row's day changes, so the job's trail stays as it is. A payment that moves from a Monday to a Sunday moves between weeks on Weekly money. That is the owner's call.

The other way is to leave the function alone and have the new view place a Stripe payment by `created_at`. I advise against it. The page and the Dashboard would then disagree about the same payment.

## Where it lives

**A second view on Bills sent, behind one switch: By day sent, By day paid.** The address carries it: `/bills-sent?view=paid&day=2026-11-18&how=stripe`.

- He opens this page now. It can be bookmarked and pinned to his Dashboard.
- The search, the bill's record at `?bill=<id>`, print and CSV are already here.
- The four roles and the route do not change, so no access row is added.

The others, a line each:

- **A page of its own.** A clean name. But a new door, a new pin, a new guide and a new access row for the same four roles.
- **The Dashboard's Money in bar.** It is one week, and it mixes what landed with what is only expected. It can link to the new view.
- **Banking's Stripe product.** It opens for a dev and the controller only, and it lists Stripe's invoices, not days.
- **The Bridge.** It holds the owner's finance figures, which this view must stay clear of.

## Who sees it

The same four roles that open the page: dev, leader, assistant, controller (`canOpenBillsSent`). Each number the view adds, against what those roles read today:

| What is added | Where the four roles read it today |
|---|---|
| A bill's paid day and the way | The job window's Bill tab. `jobs_ledger_payments` reads for `is_office_staff()` |
| A check number | The same rows, `reference_number` |
| What came in on a day, in a week, in a month | The Money in bar sums the week's landed money for the same four roles |
| What is not paid | Billed Awaiting Payment and Who owes what |
| The next Stripe payout | `get-stripe-payouts`, whose `ALLOWED_ROLES` are the same four |

Not on the view, by the owner's standing rule: contribution, earned revenue, labor cost and targets. Stripe's fee is not shown either, because the app does not keep it.

The words on the tiles are *came in* and *payments*. They never say *revenue* or *earned*, which mean something else in this app.

## The design

### On the list, By day sent

- **A money column.** The amount, then a stamp, then the way. The eye runs down one column.
  - *✓ Paid Fri, Nov 20*, green and filled. Under it *Check 4417 · bank deposit*, or *Card · Stripe · in 1 day*.
  - *Part paid · $1,500.00*, amber. Under it the check and what is still out.
  - *Not paid*, a plain dashed box. Under it *3 days out*, counted from the bill's first send.
- **Green means money, and only money.** The delivery word turns grey. A bounce stays red.
- **The delivery word sits at the right edge of its row,** under the money column: *Delivered 9:28 AM*, *Opened 8:15 AM*. The owner asked for it on 2026-11-23. **Copy as sent** stays on the left. On a phone the word is right-aligned on its own row, above the payment bar.
- **Cents are smaller than the dollars** in every amount on the page, both views. The owner asked for it on 2026-11-23. The app has the piece, `AmountSmallCents` in `src/components/AmountSmallCents.tsx`, at 0.7em. Print and CSV keep plain figures.
- **The day band** gains one line: *1 of 3 paid · $6,820.00 still out*. It counts the same bills as the band's total.
- **Two tiles.** *Not paid* narrows the list. *Paid this week* opens By day paid.
- **Two chips,** *Not paid* and *Paid*, in the row the page has.
- **On a phone** the stamp is a bar across the foot of the card, so it reads on a scroll.
- **One bill's record** gains a line for each payment, in order with its sends.
- **Print and CSV** gain the paid day, the way and the days to pay.

### By day paid

- **A month of days.** A day money came shows its figure and how many bills. Today has a ring. A later day is dashed and cannot be pressed.
- **A picked day** shows its total, its count and its bills. One deposit that paid several bills is drawn once with its bills under it.
- **Chips:** All, Stripe, Check, Bank transfer, Cash. A chip narrows the month, the tiles and the day.
- **Tiles:** Today, This week, the month, and *Next Stripe payout*.
- **Each line:** the way as a pill, the bill, the job, who paid, the amount. Then the time for a Stripe payment, the day the bill went, and the days between.
- **A day with nothing** says so and offers the next press: *Show every way that day*, or *Go to today*.
- **Print** prints the month, a day at a time. **Download CSV** gives one row a payment.

### The app's conventions

- **Values in place.** A date, an amount and a count are drawn apart from the words. Nothing here can be changed by a person, so each is a `WorkedOutValue`. The picked day's facts are `ValueLines`. The band's sentence is written by the kernel with `val` and drawn with `ValueSentence`.
- **Plain words.** The foot lines, the empty states and the guide pass `plainWords.ts`.
- **Theme tokens.** `--bg-green-tint`, `--text-green-800` and `--border-green` for paid. `--bg-amber-tint` and `--text-amber-800` for part paid. No raw hex.
- **Empty states** come from `EmptyState` over `emptyWords`, each with its press.
- **A phone.** The switch and the month's arrows are 44 px. A day's cell is 50 px tall. Chips stay 38 px, as on the page today.
- **Errors.** A read that fails draws `OfflineRetryPanel` with `idempotent`, as the page does today. A payout read that fails leaves its tile off and the rest stands.
- **Batch words.** Nothing here is a batch act.

## The train

Built as three PRs, not four: the kernel and the read went in with the list, since `docs/SESSIONS.md` asks for fewer merge windows when many sessions are landing at once.

| PR | What | Size | Database |
|---|---|---|---|
| 1 | **The kernel and the read.** `src/lib/billing/billsPaid.ts`, pure, with tests: a bill's state from its payment rows (paid, part paid, not paid, the day, the way, the days), the ways as chips, in kind held out of sums, the days of a month, the deposits of a day. `billsSentIo.ts` reads `jobs_ledger_payments` for the bills on the page, by `invoice_id`. `paymentSource` gains a door that takes a payment row and a bill. Nothing on the screen changes | S | None. The four roles read the table today |
| 2 | **The list: payment made plain.** The money column and its stamp, the delivery word at the right edge, small cents through `AmountSmallCents`, the band's line, the two tiles, the two chips, the phone's bar, the payments on one bill's record, the new print and CSV columns. Render tests. The guide `see-which-bills-went-out.md` gains *See who has paid*. The *Bills sent* entry of `docs/GLOSSARY.md`, the page table of `docs/BILLING_FLOWS.md` and `docs/PROJECT_DOCUMENTATION.md` are amended | M | None |
| 3 | **The Stripe day at its source**, on the owner's yes. `mark_invoice_paid_from_stripe` files the company's day. A second, separate step corrects the older rows after their list is read. `docs/migrations/` fragment | S | One migration, a function only. Pushed after the merge |
| 4 | **By day paid.** The switch and the address, the month, the picked day, the chips, the tiles with the payout, the month's read (payments by `paid_on`, then their bills and jobs), print and CSV, the empty states. Render tests. The guide gains *See what came in on a day*. The same docs are amended, and `docs/ACCESS_CONTROL.md`'s Bills sent row names the payout read | M | None |

Each PR ships its release note and its `docs/recent-features/` fragment. PR 1 and PR 2 answer *who paid and when* with no database change. PR 4 reads `paid_on`, so it goes after PR 3 or it shows the evening flaw.

Later, only on the owner's word: **payouts by day**, a new edge read of Stripe's payout history with the payments inside each. It gives the bank's day and the fee. It is a larger build and a second meaning of *a day*.

## Not drawn

- **A week's total at the end of each row of the month.** Cheap to add at a desk. Too wide for a phone.
- **A link from the Money in bar** to the new view.
- **A block in the Monday Bridge email.** It waits with #327's note 2.
- **Refunds.** The app does not record them. That is a card of its own.

## How to verify, when built

- A bill paid by card: its line reads *Paid* with the day and *Card · Stripe*. The same bill in the job window's Bill tab says the same way.
- A bill sent by text and paid: its line has a day, not *Paid since*.
- A bill with one check for part of it: *Part paid*, the amount, and what is still out. The band's *still out* counts the rest.
- By day paid, a day with a Stripe payment and a deposit: the day's total is their sum. With **Stripe** pressed it is the Stripe payment alone.
- The Dashboard's Money in bar and By day paid agree on this week's Stripe payments, a day at a time.
- A deposit that paid three bills is one group of three lines.
- A test-mode bill's payment is on no day.
- As an estimator, open `/bills-sent?view=paid`. The Dashboard opens.
- After PR 3: a test-mode Stripe bill paid after 6 PM Central is filed on that day.
- The mock-up was shot at 375, 768 and 1400 wide, light and dark, with nothing past the edge.

## The calls

The owner's, a word each:

1. **Build it this way?** One stamp on the list and one second view. Or the list alone first.
2. **Which day is a Stripe day?** The day the customer paid. Or wait for the payout day, which needs a new read of Stripe.
3. **Fix the evening payments at the source?** One function change, then a one-time correction of older rows after their list is read. Or leave them.
4. **Is the next payout shown?** One tile with the amount and its day at the bank. Or it stays on the Dashboard only.
5. **Does By day paid show every way, or Stripe only?** Every way, with a chip for Stripe. Or Stripe alone.
6. **Are the days out shown on a bill not paid?** Yes, as small grey words. Or *Not paid* alone.
7. **What is a Stripe payment called?** *Card · Stripe*, as the job window says. Or plain *Stripe*, since the app cannot tell a card from a bank debit.

One thing only the leader has: the day he wanted to check when he asked.

## Where it stands

The owner saw the mock-up on 2026-11-23 and wrote: "I like your suggestion for the changes." The owner asked for two changes, and both are drawn: the opened and delivered word moves to the right side, aligned right, and the cents of a number are always smaller than the rest of it. Go had not been said yet, and the seven calls were still open.

The owner said go on 2026-11-23: *Let's build it all testing along the way, making sure it looks great with screenshots, and always asking ourselves, is this the best we can do?* The seven calls were taken as suggested, since the owner said build it all.

| Step | What | State |
|---|---|---|
| 1 | The list, payment made plain: the kernel `billsPaid.ts`, the payments read, the stamp, the band's line, the tile, the chips, the phone's bar, the record's payments, print and CSV. The plan's PR 1 and PR 2 as one | v2.8333 |
| 2 | The Stripe paid day at its source: `mark_invoice_paid_from_stripe` files the company's day. Migration `20261123074206`, with a SQL bed that ran green on the whole schema | v2.8335, merged and pushed on the owner's yes on 2026-11-23. The live function was read afterwards: it files the company's day, and the service role alone may call it. The older rows were a second step: v2.8371 moved the six back a day on the owner's yes, after their list was read, and was pushed the same day. Read afterwards, no Stripe row sat a day late and every job's paid total still matched its payments |
| 3 | By day paid: the switch, the month, the picked day, the chips, the payout tile, the Paid this week tile, print and CSV | v2.8343 |
| 4 | A picked day names the bank deposits that landed that day and are on no bill yet, with **Open deposits**. One rule with the Dashboard's Money in bar (`moneyInDeposits.ts`). Never added to a figure | v2.8493, not yet looked at on the live site |
| 5 | The live test's faults, one PR a fault. A test bill is in no total in either view. A record opened from By day paid goes back to its day. A part-paid record draws its cents small. A credit's mark is whole on a phone. Chips and names stand 44 px on a phone. A paid line says *day not on record* or *before the first send on record*. An empty **Did not arrive** says nothing is waiting. By day paid opens on the newest day with money. The spreadsheet file is named for its chip. The tiles fill their rows on a phone. By day paid's foot says what a day leaves out. The guide matches the screen in four places | v2.8442, v2.8443, v2.8445 to v2.8448, v2.8450 to v2.8453 and v2.8457. Walked look-only on the live site on 2026-11-24 at 1400 and 375 px, light and dark. Every one held |
| 6 | *Opened*. The app was ready for the word and the mail service never reported an open, because open tracking was off for the sending domain. The owner chose to turn it on. Open tracking is on and click tracking is off, with one DNS record for it (`docs/DOMAIN_CUTOVER.md`). No code changed | On since 2026-11-24. The mail log held its first opened mails within two hours, one of them a bill, and that bill's line read *Opened* with its time on the live page |

What step 1 found while it was built:

- A bill sent back to Ready to Bill owes nothing yet, so its line carries no stamp.
- The **Not paid** tile counts the bills on the list and, since v2.8492, the open bills with no send on record, as one figure with the two parts under it and the age of the oldest. It is still not every open bill the company has: the page reads the newest 300 sends at a time, and **Show older sends** reads more. The owner has not looked at the new tile on the live page yet.
- **Paid this week** came with step 3. It reads the payments by day, so a payment on a bill older than the list is counted.
- The screen was checked over made-up rows in a local harness that answers every database call itself. Nobody opened the live app.

What step 3 found while it was built:

- Step 3 was built before step 2 merged. The Stripe payments made in the evening before the migration was pushed on 2026-11-23 sat on the next day in both views, as on the Dashboard's Money in bar, until v2.8371 moved the six back. A payment made after the push sits on its own day.
- A matched deposit that is no check reads **Bank transfer**. The view reads the payment rows and not the bank's own rows, so it does not tell a wire from an ACH.
- A month's cell is too narrow for a five-figure day. From ten thousand dollars a cell writes thousands with one decimal, and the picked day says the figure whole.
- Money on a job with no bill named is listed as *Payment*, so a day's total agrees with the Money in bar.
- Not built: a red word on a disputed card payment, and a week's total at the end of each row of the month.

What the live test left, none of it a build that waits:

- A test send stays on the list, marked *A test bill. It is in no total.* The other way is to hide it from every role but a dev. It is the owner's to change.
- Ten older Housecall Pro bills are marked paid with no payment on record, so each reads *day not on record*. Entering each payment on its job gives the line its day. That record is the office's to make.
- An open is the mail app's word. Some mail apps fetch a mail's pictures by themselves and read as opened within seconds of the send, and some block pictures and never do. The guide says so.
- Mail sent before 2026-11-24 carries no tracking and never reads *Opened*.
- On a phone 320 px wide the word *credit* in a day's cell is cut by about 2 px. A day's cell cannot reach 44 px across with seven in a row.
- By day paid's own lines show the sent day and no span. They do not say *before the first send on record*.
