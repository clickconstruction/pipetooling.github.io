---
name: "Pay calendar: a payer who pays on a set day of the month gets a cutoff and a due day, and the forecast keeps its honest guess"
number: 323
group: gated
status: asked 2026-11-12 · the card, the mock-up and a second pass that changed the design the same day · Grace's go on the revised train the same day · PR 1 (the setting, v2.7024 #7784), PR 2 (Due on billed rows, v2.7028 #7788), PR 3 (the cutoff on Ready to Bill, v2.7031 #7791), PR 4 (a job's own calendar and the accepted day, v2.7036 #7798), PR 5 (Cutoffs coming and the Working row's line, v2.7037) and PR 7 (Their paper's Pay calendar term, v2.7039) built and open as a stack · PR 1 is in the merge queue · neither migration is pushed · PR 6 is left
summary: >
  Some commercial payers pay on a calendar, not at a pace: a pay application in by the end of the
  month, or by an earlier day, is paid on a set day of the next month. A bill sent on the 1st and
  one sent on the 30th land the same day, and one day past the cutoff costs a whole month. The
  app guesses every pay date as the bill date plus the payer's median days to pay, which cannot
  say either thing. The card proposes one small setting, a Pay calendar, held on the payer with an
  exception a job can carry. It gives each billed row the day the bill is due under the contract,
  keeps the expected day as the payer's real record measured against that due day, and puts the
  cutoff in front of whoever is about to bill: send by Nov 30 to be due Dec 10, after that Jan 10.
next: merge PR 1 and push its migration right after, then PRs 2 to 4 in turn (PR 4 has a migration of its own to push); then PR 6, the readers with their own code, with the Needs you line and the pay application's line that PR 5 left for it.
size: L as a train of seven (M · M · S · M · S · M · S); PRs 1 to 3 carry most of the worth
blocker: PR 1's migration push, which holds the deploy until it is done, so PR 1 is armed only with someone at hand to push.
opinion: build — the cutoff and the due day are facts the app has never had, and the second pass took the wishful part out of the forecast
---

# Pay calendar (#323)

## The ask

Grace, 2026-11-12. The repo is public, so the three company names she gave and the contract's own
words are left out here. She has them.

> I am looking at jobs, stages, payment forecast right now and I am separately reading our
> [commercial customer's] contract which says [that progress payments are made on the 10th day of
> the month following the month an acceptable application for payment is received]. This is great
> as it means we can use it to gauge the cutoff for when we need to send bills in and what window
> we will be paid. There are other commercial jobs such as many of [one GC]'s jobs and [a
> development] by [another GC] where contractors have the same policy, pay by a date, and get paid
> on a date following that date. Please look holistically at the Payment forecast and help me come
> up with a way to set this setting across the app so we can use it to better forecast and get
> relevant information.

She asked for a way, not a build. This card is the plan and [mockup.html](mockup.html) is the
picture. Nothing is built.

## The answer, in short

Add one setting, a **Pay calendar**, on the payer. It holds three things: the day bills must be in
by, the day they pay, and how many months later. A job can carry an exception. A payer with no
calendar reads exactly as today.

It gives the app two facts it has never had:

- **The cutoff.** Before a bill goes out, the row says the last day to send it and what one day
  late costs.
- **The due day.** A billed row says the day the contract makes it due, and how far past it is.

It does not turn the contract into the forecast. See *The second pass*: of the three payers Grace
named, the two with a record have paid weeks to months after a monthly pay day. So the rule is:

> The contract says when a bill is **due**. The record says when it **lands**. The app shows both
> and never passes one off as the other.

*Expected* stays the app's honest guess. For a payer on a calendar it becomes the due day plus how
late they usually run. For a payer with a contract and no record yet, the due day is the best
guess there is, and far better than a borrowed average.

The setting is something a person turns on for a payer. It is never a rule the app applies by
itself.

## What the app does today

### One guess, made the same way for everyone

Every expected date is **the bill date plus a pace in days**.

- The pace is the payer's median days from bill to payment over 12 months, from the RPC
  `get_billed_customer_pay_speeds` over `pay_speed_samples()`. `src/lib/jobs/payPace.ts` picks it:
  the payer's own median, else the GC pace here, else the segment's, else the company's.
- `billedExpectedPayModel` in `src/lib/jobs/billedExpectedPay.ts` turns it into a date. A date the
  customer named (a promise) wins outright. Nothing else can.
- The bill date is `billed_at`, else the estimated bill date (`billedReferenceYmd`).
- Nothing in the app keys on a day of the month. Nothing stores a due date or net terms.
  `customers.payment_terms` is a credit stance (standard, deposit required and so on), not days.

For a payer on a calendar this is wrong in a way a median cannot fix. Their waits are short for a
bill sent late in the month and long for one sent early, so the median sits in the middle and the
*Pays in 12–68d* range looks like an unreliable payer. It is a reliable payer on a calendar.

### Everywhere that guess is read

Listed from the code. All of them take the date from one of two places.

| Reads `billedExpectedPayModel` | File |
|---|---|
| Stages rows, desk and phone: *Expected Nov 22 · in 10d* | `JobsStagesTab.tsx`, `billedDatesLedger.ts`, `jobNextLine.ts` |
| The *Pays in 9–41d · keeps 3 of 7* line | `BilledReliabilityLine.tsx`, `paymentReliability.ts` |
| Payment forecast window | `BilledPaymentForecastModal.tsx`, `billedPaymentForecast.ts` |
| The job window's bills list | `JobFormInvoiceList.tsx`, `useJobBilledExpectedPay.ts` |
| Lien desk and the lien runway on a billed row | `lienPayRunway.ts`, `lienCalendarRows.ts`, `LienDeskCalendarTab.tsx` |
| GC Review window | `GcReviewWindow.tsx` through `useBilledMoneyData.ts` |
| Call mode | `paymentChase.ts`, `PaymentChaseModal.tsx` |
| Development page money | `src/lib/developments/siteMoney.ts` |
| Messages, They owe us, and the residential flow | `followUp/theyOweUs.ts`, `flows/residentialLoad.ts` |
| The Monday Bridge email | `src/lib/bridge/sheetBuild.ts`, edge copy under `_shared/gcKernels/` |

| Works the date out again by its own code | File |
|---|---|
| The Bridge's Collect pile, cash runway and the Dashboard's Money in strip | `bridge/collect/collectPile.ts`, `bridge/cashForecast.ts`, `moneyInWeek.ts` |
| The forecast email | `supabase/functions/_shared/paymentForecastCore.ts` |
| Money waiting, window and email | `jobs/moneyWaiting.ts`, `_shared/moneyWaitingCore.ts` |
| Dashboard Accounts Receivable | `arCustomerRollup.ts` |
| Pay speeds window | `paySpeedsBreakdown.ts`, `PaySpeedsBreakdownModal.tsx` |
| Customer profile and Customers list: *~N days* | `customerProfileStats.ts`, `customerRowPaysIn.ts` |

GC mode, where we are the GC, has its own owner pay days (`gc_projects.owner_pay_days`) and its
own Bill day cutoff. It is a separate build and this card leaves it alone.

No reminder or chase fires off the expected date today. Chases fire off promises and snoozes.

### Where a payer and a contract live

- **A payer is a `customers` row.** A GC is a customer that some job names in
  `jobs_ledger.gc_customer_id`. There is no GC table and no GC flag.
- **The payer is decided per bill**: `paySpeedPayer(job, inv)` in `src/lib/jobs/billToParty.ts`,
  from the job's and the bill's `bill_to_party`. Pace is already keyed on that id.
- **A contract belongs to a job.** `job_contracts.job_id`, with `kind = 'their_paper'` for a GC's
  own subcontract (`src/lib/jobs/theirPaper.ts`). One paper can cover several jobs through
  `covers_group_id`. Its `key_terms` hold a clause number and a few words each. *Payment
  contingency* and *Retainage release* are keys already. No key holds a pay day.
- **Many billed GC jobs have no stored paper at all.** Their bills are marked billed by hand.
- **A pay application** is `job_pay_applications`, with `application_date` and `period_to`. A bill
  is `jobs_ledger_invoices`, with `billed_at` and `sent_to_customer_at`. **No column records the
  day a payer received or accepted either one.**
- **A development** (`developments`) belongs to a GC and groups its jobs.

## What the payments on record say

Read 2026-11-12 through the signed-in local app with writes refused. The figures stay out of the
repo. The method and the script are in the session's hand-over note.

For each commercial payer with three or more measured payments, each payment was guessed twice
from the others: once as today (bill date plus median), once by the best-fitting calendar.

- The calendar was the closer guess for **3 of 11** payers. For the rest today's guess was closer.
- Where it won, it won big. One slow payer's waits ran from under a month to over three months.
  Today's guess missed by about six weeks. A calendar missed by about two.
- Where it lost, the payer simply pays fast, a week or so after any bill. A calendar set on such a
  payer would make the forecast worse.
- Payments land in batches. Twelve payments often fall on three days. That pattern, with a wide
  spread of waits, is the mark of a calendar payer.

Two limits on that read. The RPC keeps 12 payments a payer, so the samples are small. And waits
are measured from the day we billed, since no received day exists.

## The second pass

Grace asked for one more pass before the build: is this the best we can do? The first design had
not been tested on the payers she named. So the terms she quoted were replayed against their real
payments, read the same way, figures kept out of the repo.

- **The payer whose contract she was reading has no payment on record.** Today the app can only
  lend it an average. A calendar is the one real thing the app could know about it.
- **The GC with many jobs has paid in a few batches, one to two months after a monthly pay day.**
  The first design would have printed that pay day as *Expected*. It would have been wrong on
  every bill, and wrong in the hopeful direction.
- **The third has one payment, about two months after such a day.**

That changed five things:

1. **Due and Expected are two dates.** The first design put the contract's day in the Expected
   row. Now the row reads *Due*, and Expected is the due day plus their usual lateness.
2. **The record ships with the date, not four PRs later.** A due day with no record beside it is
   the wishful forecast above. The replay is in PR 1, inside the setting's own window.
3. **The window proves itself as you type.** Type a contract's terms and it says at once how that
   payer's past payments landed against them. That is this pass, built into the product.
4. **The accepted day and the job exception move up,** to PR 4. They are what keeps a due day
   from being a month wrong, and Grace's own words were *many of* a GC's jobs, not all.
5. **The train is seven, not eight.** The Pay speeds hint folds into the readers' PR. Reading the
   clause out of a contract's text is dropped. A person reads the clause and types three numbers.

## The setting

### Its shape

A **Pay calendar** is three numbers and a note:

| Field | Values | Reads as |
|---|---|---|
| Bills must be in by | the last day of the month, or a day 1 to 28 | the **cutoff** |
| They pay on the | a day 1 to 31, where 31 means the last day | the **pay day** |
| Of | the same month, the next month, the month after | months after the cutoff month |
| They pay when the owner pays them | on or off | the pay day is the earliest, not a date to count on |
| Where the contract says it | a clause number and a few words | the reason shown on hover |

That covers the common contracts without a rule language:

| The contract says | Cutoff | Pay day | Months |
|---|---|---|---|
| Paid the 10th of the month after an acceptable application is received | last day | 10 | next |
| In by the 25th, paid the 30th of the next month | 25 | 30 | next |
| In by the 20th, paid by the 10th | 20 | 10 | next |
| Net 30 after the month closes | last day | 31 | next |
| In by the 5th, paid the 20th | 5 | 20 | same |
| Any of these, pay when paid | as above | as above | as above, with the box ticked |

It does not cover two check runs a month, business-day rules or holidays. See *What I would not
build*.

### Where it lives, and why

**On the payer, with an exception a job can carry.** One new table holds both levels:

`payer_pay_calendars`: `payer_customer_id` (required), `job_id` (null means the payer's default),
`off` (a job's row can say *not on this job*), `cutoff_day`, `pay_day`, `months_after`,
`pay_when_paid`, `clause`, `words`, `set_by`, `set_at`. One row per payer and job.

A bill reads its job's row for its payer, else the payer's default, else nothing. Nothing means
today's behavior, unchanged.

Why the payer and not the contract:

1. The app already decides each bill's payer and already keys pace on that id. A calendar on the
   same id drops in beside the pace, with no new lookup.
2. Grace's own examples are payer policies. *Many of a GC's jobs* is a default with exceptions.
3. A contract record belongs to one job, and many billed GC jobs have none. A setting that lived
   only on the paper would not reach them.
4. The stored paper still matters. It is the evidence, and PR 7 lets it write the setting.

Why a table and not columns on `customers` and `jobs_ledger`: those are the two busiest tables and
there is no staging. A new table takes no lock on either and leaves their row types alone.

A development gets no level of its own. The job window offers *Also set on the other 12 jobs in
this development* instead. See Grace's call 6.

### The clock: what "received" means

The contract counts from the day an acceptable application is received. The app has no such day.
So the calendar reads the best day it has, in this order:

1. The day the payer accepted it, when someone has recorded one (new, PR 4).
2. The day it went out from here (`sent_to_customer_at`).
3. The day it was marked billed (`billed_at`), which is how a pay application is recorded today.
4. The estimated bill date.

Without an accepted day the hover says what it assumed: *Counted from the day it went out, Nov 3.*
PR 4 adds the press that corrects it: **They accepted it on…**, kept in a small side table the
way promises are. It only matters when the day crosses a cutoff.

## What it changes

### Due, on a billed row

The dates block already names its money row by where the date came from: *Expected*, or *They
said* when the customer named a date. A calendar adds a third: **Due**.

- *Due Dec 10 · in 28d*, with a quiet line under it: *Usually lands about Dec 16.*
- Past the day it reads *Due Nov 10 · 2d past* in amber. This is a reason to call that the office
  can say out loud: the contract says the 10th.
- A payer who runs far late reads plainly: *Due Oct 30 · 13d past*, and under it *Usually lands
  about 45d after. About Dec 14.*
- A promise still wins the row. *They said Nov 20* replaces it, and the due day stays as the quiet
  line.
- Hover gives the reason: the calendar in words, the clause, and the day the clock was counted
  from.

### Expected, everywhere money is counted

`billedExpectedPayModel` gains a calendar argument, a `dueYmd` on its answer and one new source,
`terms`. A caller that passes no calendar gets today's answer.

- **Lateness** is new and small: the payer's measured payments replayed through the calendar,
  each as days after its own due day, and the middle one taken. It is never less than zero.
- **Expected is the due day plus that lateness.** With no payment on record it is the due day.
- The forecast's weeks, the Bridge's cash runway, Money waiting and the Lien desk's comparison all
  read Expected, as they do today. Each row also carries the due day, so *2d past due* can show
  on a bill whose money is not expected until next week.
- *Past expected* keeps its meaning: later than this payer usually is. *Past due* is new and
  means later than the contract allows. A payer can be the second without being the first.
- With *They pay when the owner pays them* ticked, the due day reads *no sooner than*.

The app already treats a promise this way. It shows the date they gave, counts on that date plus
their usual slip, and keeps score. A calendar is a standing promise and gets the same treatment.

### The record against the calendar

The line under the row changes for a payer on a calendar. *Pays in 12–68d* is replaced by the
lateness: *Lands about 6d after their pay day · on the day 1 of 4.* The wide range was the
calendar's doing, not the payer's.

In Pay speeds, the payer's card shows the calendar beside the median. A payer with no calendar
whose payments land in a few batches with a wide spread of waits gets one line: *This looks like a
pay calendar.* It opens the setting with nothing filled.

### The cutoff

This is the new information, and the part that moves money. It shows before a bill goes out:

| Where | What it says |
|---|---|
| A Ready to Bill row | *Send by Nov 30 to be due Dec 10. After that, Jan 10.* Amber in the last 7 days. |
| The Ready to Bill header | *2 bills go by Nov 30*, a chip that filters to them. |
| The send window | The same line at the moment of sending. Past the cutoff: *This one will be due Jan 10.* |
| A pay application | Under *Period to*: *Their cutoff is the last day of the month.* |
| A Working row | *Bill by Nov 30 for Dec 10*, only in the last 10 days, only for a payer on a calendar. |
| Payment forecast | A **Cutoffs coming** strip: each calendar payer, its next cutoff and due day, the dollars ready and the dollars still to bill on working jobs. |
| Needs you | *2 bills for Larkfield Construction go by Nov 30*, from 7 days out. The door is Ready to Bill. |

No separate calendar page. The strip in the forecast is the calendar.

### What follows by itself

Everything that reads `billedExpectedPayModel` moves once its loader passes the calendar. The Lien
desk is the one to name. It still compares Expected with the lien's last day, and it can now say
why: *Due Jan 10 under their contract. The notice's last day is Dec 15.* A bill that cannot be due
before a notice's last day is a lien decision made on a fact, on the day the bill goes out.

GC Review's *expected pay by* box, filled when a statement is marked sent, offers the due day.

### How terms get entered without typing them thirty times

1. **Once on the payer.** Every job of theirs inherits it. This is PR 1 and covers most cases.
2. **From the job, across a development.** One press sets the other jobs there.
3. **From the stored paper.** *Their paper* gains a *Pay calendar* key term, with its clause.
   Saving it offers to set the jobs that paper covers.
4. **From the record.** The one line in Pay speeds above. It only opens the window.

The app never sets a calendar by itself. The record shows it would be wrong more often than right.

## The PR train

| PR | What | Size | Migration |
|---|---|---|---|
| 1 | The kernel `src/lib/jobs/payCalendar.ts`: the due day, the cutoff, the lateness, the words. The table. The **Pay calendar** window on a customer's profile, with the plain-date preview and the payer's record replayed against what is typed. The guide. | M | Yes: `payer_pay_calendars`, with the four fence calls. The client reads a table the migration creates, so push right after the merge. |
| 2 | **Due** on billed rows, desk and phone, with Expected as due plus lateness. The Payment forecast, GC Review and the Lien desk follow through `useBilledMoneyData`. The line under the row. | M | No |
| 3 | The cutoff on Ready to Bill rows, the header chip and the send window. | S | No |
| 4 | A job's exception, with *Also set on the other jobs in this development*. **They accepted it on…** | M | Yes: one small side table for the accepted day. |
| 5 | **Cutoffs coming** in the forecast, the Needs you item, the Working row's line, the pay application's line. | S | No |
| 6 | The readers with their own code: the job window, Call mode, Money waiting, Dashboard AR, the Pay speeds card and its one-line hint, GC Review's box, the Collect pile and cash runway, the two emails. Edge kernel copies and deploys. | M | Yes: the two email payload RPCs carry the calendars. |
| 7 | *Their paper* gains the *Pay calendar* key term and sets the jobs the paper covers. | S | No |

PRs 1 to 3 stand alone and carry most of the worth. PR 6 touches the Bridge's Collect pile and
cash runway, which the Bridge work (#318) is reshaping, so that part waits for it to land.
`BilledReliabilityLine.tsx` and `BilledPaymentForecastModal.tsx` are touched in PR 2, after the two
open PRs on them have merged.

Each PR ships its release note, fragment and guide changes. PR 1 adds the guide *set a payer's pay
calendar*. PR 2 adds a section in *see when a customer will pay*. PR 5 adds one in *read the
payment forecast*.

## How to verify

- Local app with writes refused: `npx vite --host 127.0.0.1 --port <free> --strictPort`, then
  `/dev-login?as=1&to=/jobs?tab=stages`. Abort every non-GET except the sign-in and the read RPCs.
- The kernel is pure. Its tests are the table in *Its shape*, plus month ends: a pay day of 31 in
  February, a cutoff on the last day of a 30-day month, a bill on the cutoff day itself.
- The replay is the product now: open the window on a payer with payments, type terms, and read
  the record line. Check it against the same replay done by hand from the payer's receipts.
- The first real payers are set by Grace or the owner in the window. No seed, no backfill.

## What I would not build

- **A rule language.** Business days, holidays, two check runs a month, a different day by bill
  size. Each is real somewhere. Three numbers and the measured slip cover them well enough, and
  the lateness soaks up a pay day that falls on a Saturday.
- **Net 30 as a setting.** For a payer who pays some days after each bill, the measured pace is
  already the better answer. The calendar is the one thing a median cannot say.
- **A date for pay when paid.** Nobody knows it. The box makes the due day read as *no sooner
  than*, and the forecast leans on the record.
- **Retainage on the calendar.** A retainage release bill waits on their final acceptance, not on
  a month. It keeps today's behavior.
- **Setting a calendar from the record or the contract with no person.** See the record above.
- **Reading the clause out of a contract's text.** A pattern match on legal prose that is wrong
  once costs more trust than typing three numbers costs time.
- **A margin before the cutoff as its own field.** The amber week and the Needs you line ask
  early. If accepted days later show that late-month bills slip, the record line will say so.
- **A level for developments,** until one GC pays two developments on two calendars.
- **A cutoff calendar page.** The strip in the forecast and the Needs you line reach the same
  people sooner.
- **A chase email that quotes the contract's pay day.** Worth doing later. It is a customer-facing
  change and wants its own card.
- **Any change to GC mode,** to how pace is measured, or to the Bridge's runway. The Bridge reads
  the same kernel when its own work is ready for it.

## Is this the best we can do?

Asked twice. The first answer was yes on the shape, with limits. The second pass found the first
design was not the best: it would have shown a contract's day as the expected day for payers who
are known to pay long after it. That is fixed above, and the design is better for having been
tested on the payers it was written for.

What still holds, and what is still weak:

1. **The shape is small.** Three numbers on the payer, read through the one function nearly every
   screen already calls.
2. **The forecast gains least.** For a payer with a steady record, due plus lateness is close to
   what the median already says. The gain is for a payer with a contract and no record, and for
   one whose waits swing with the day of the month a bill was sent.
3. **The cutoff and the due day are the worth.** One moves a bill into this month's run. The other
   gives the office a date it can hold a payer to, and gives the Lien desk a fact.
4. **The clock start is still the weak link.** With no accepted day, a pay application that is
   sent back and resent a month later reads a due day a month early. PR 4 adds the press. Until
   then the hover says what day it counted from.
5. **Lateness rests on 12 payments a payer,** the newest the RPC returns. That is recent
   behavior, which is what a forecast wants, and it is thin.
6. **Better still would be the payer's real check run,** read from remittance emails and the bank
   feed. That is a bigger build. Lateness gets most of it.

## Where it stands

2026-11-12, after Grace's *Build the train*:

- **PR 1, the setting** (#7784): the kernel, the table and its save, the window with the record replayed against what is typed, the line under *Pays in*. Changes no date. Its migration `20261112150000_payer_pay_calendars.sql` is proven by the SQL bed `pay-calendar` and **not pushed**.
- **PR 2, Due on billed rows**, stacked on PR 1: `billedPayModel` wraps the pace guess, so the edge copies are untouched. The dates block, the Payment forecast, the phone rows and the Lien desk's runway read it. Walked on real rows with a made-up calendar.
- **PR 3, the cutoff**, stacked on PR 2: *Send by Nov 30 to be due Dec 10. After that, Jan 10.* on a Ready to Bill row, the nearest cutoff on the header, and the same in Bill Customer. The header's chip is plain words, not a filter as first planned: Ready to Bill held one row on the day it was built. The phone's two-line rows do not carry it yet; that goes with PR 5.
- **PR 4, a job's own calendar and the accepted day**, stacked on PR 3: the window opened from a job's row has *This calendar is for*, with *Only <job>*, *This job has no pay calendar* and *Also set on the other N jobs in <development>*. *Counted from Nov 24* under a billed row's dates opens *They accepted it on…*, which shows what each day makes the bill. Migration `20261112190000_invoice_payer_acceptances.sql`, **not pushed**. Neither screen has been walked live: both need the two tables on prod.
- **PR 5, Cutoffs coming**, stacked on PR 4: the Payment forecast opens with each calendar payer's next cutoff, the dollars ready and the dollars still to bill on working jobs; a Working row says *Bill by Nov 30 to be due Dec 10.* in the cutoff's last 10 days. **Left out of PR 5 and moved to PR 6**: the Needs you line (a new item touches the rank, the actor, the door and the inputs, each with its own matrix test), the pay application's line, and the phone's two-line rows.
- **PR 7, Their paper**, stacked on PR 5 and built before PR 6 because it stands alone: *Pay calendar* is a key term on the paper, and *Set <payer>'s pay calendar…* under the terms opens the window on that job with the clause and its words carried in. The window draws above the sheet that opened it.
- **PR 6 is not built**: the job window's bills list, Call mode, Money waiting, Dashboard AR, the Pay speeds card's hint, GC Review's box, the Collect pile and cash runway, the forecast and Money waiting emails and the Monday Bridge email (edge kernel copies and deploys), with the Needs you line, the pay application's line and the phone's two-line rows that PR 5 left for it.
- What the live walk taught: on a real payer set to *in by month end, paid the 10th*, six open bills read *Due Oct 10 · 33d past* with money usually landing about eight weeks after. Typed as *in by the 25th, paid the 30th of the next month* the same payer's last 12 payments read *usually about 5 days after, 6 of 12 on time*. The window is doing the job the second pass asked of it: it shows which terms a payer's money actually follows.
- Calls 2 to 7 below were not answered. The build follows the first pick on each.

## Grace's calls

Grace said to build the whole train (2026-11-12), then asked for the second pass. So call 1 is
answered. The rest stand as my picks unless she says otherwise. My pick is first on each.

1. **Build it?** Answered: the whole train. It is seven PRs after the second pass.
2. **Where it lives.** On the payer with an exception a job can carry. Or on each contract only,
   which is truer to the paper and misses every job with no paper stored.
3. **Which date the row leads with.** *Due*, the date the office can hold them to, with the
   expected day under it. The forecast and the Bridge count on Expected. Or the row keeps
   *Expected* and the due day is the quiet line.
4. **Who may set it.** The roles that record a promise today: dev, leaders and assistant-type
   roles. Or the owner and dev only, since it moves the dates on every bill of that payer.
5. **How early the cutoff asks.** Needs you from 7 days out, the Working row from 10. Or other
   numbers. Or no Needs you line at all.
6. **A level for developments.** No, with *Also set on the other jobs in this development*. Or
   yes, a development can hold its own calendar.
7. **The name.** *Pay calendar*, with *cutoff* and *due*. Or her own words for it.

And one thing only she can supply: which payers to set first, and what each contract says.
