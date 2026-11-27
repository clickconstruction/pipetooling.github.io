---
name: "A job's own pay terms: the override is built, the door to it is hidden, and four kinds of terms have no home"
number: 341
group: ready
status: asked 2026-11-13 by the owner · read the same day from the code and from prod through the dev seat (reads only) · the owner's *Yes, build both* the same day · PR 1, the door, and PR 2, the mark, built the same day (v2.7151, v2.7153) · Taunya's *build the entire PR train* 2026-11-15 · PR 3, the job's own record, built that day (v2.7339) on the card's first pick for call 2 · PR 4, one bill's own due day, built that day (v2.7341, migration 20261115170000) as carded, call 3 unanswered · PR 5, a number of days after the bill, built that day (v2.7343, migration 20261115190000) as carded, call 4 unanswered · the train is built · the morning run's two reads built 2026-11-16 on the owner's ask of that day (v2.7452) and deployed that day at 10:52 AM Central on Taunya's go · call 4 answered 2026-11-25 (UTC) in the managing session: no big job pays a set number of days after the bill, and the terms in days choice can be hidden until a contract needs it; hidden 2026-11-27 (v2.8714)
summary: >
  The owner asked what it would take to set one job's payment terms so they win over its GC's or its
  customer's. Most of it shipped with the Pay calendar (#323): a job can carry its own calendar, or
  none, and every screen that reads a calendar takes the job's over the payer's. What is missing is
  the way in and the way to see it. The press that carries the job sits only on a row whose payer
  already has a calendar, and no payer has one yet, so today the one door is inside the Their paper
  sheet. No row says a job is on its own calendar, and a job switched off has no door back. Past
  that, four kinds of terms have no home: one bill due on a named date, a number of days after the
  bill, a real date for pay when paid, and dated draws not yet billed.
next: Someone sets the first real calendars, since none is set: the first real save on a job and on a bill is the live walk, and *The live walk* below is its recipe. The terms in days choice is hidden since v2.8714, on the answer to call 4. The owner can still change calls 2 and 3, and each fragment says how. The morning run (`messages-nudge-dispatch`) reads a bill's own day and terms in days since v2.7452, deployed 2026-11-16 at 10:52 AM Central on Taunya's go, so nothing here waits on a deploy.
size: M as a train of five (S · S · S · M · M) and the morning run's two reads (XS); built and deployed, and the terms in days choice hidden (XS, v2.8714). Left: the live walk (XS)
blocker: the live walk waits on the first real calendar, and only the owner knows which jobs are on their own terms and what each contract says.
ask: owner · use · Set the first real pay calendar on a job that is on its own terms, and say what its contract says.
opinion: set one real calendar on the biggest GC job and walk it; nothing more to build here until that says something reads wrong
ver: v2.7036 · v2.7039 · v2.7040 · v2.7127 · v2.7151 · v2.7153 · v2.7339 · v2.7341 · v2.7343 · v2.7452 · v2.8714
---

# A job's own pay terms (#341)

## The ask

The owner, 2026-11-13:

> We recently made features for a Payment forecast: a payer's pay-by-date terms, where a customer
> can be set as to when they'll pay. Sometimes we are working for a GC and there are some big jobs
> that have their own specific payment terms. What would we need to build where I could set a job's
> Payment forecast that would override a GC's or customer's if those were also set?

He asked what it would take, not for a build. This card is the report and the plan, and
[mockup.html](mockup.html) is the picture. The feature he means is the Pay calendar, card
[#323](../pay-calendar/README.md).

## The answer, in short

**It is mostly built.** A job can carry its own Pay calendar, or be switched to none, and it wins
over its payer's on every screen that reads a calendar. That shipped as PR 4 of #323 (v2.7036).

**It is hard to find and impossible to see.** The way in sits where almost nobody would look, and
once a job is on its own calendar no screen says so.

**Nobody has used it.** Prod holds no calendar at all today: none on a payer, none on a job, no
accepted day, no Their paper record.

**Four kinds of terms have no home yet.** See *What a calendar cannot hold*.

## What is built, exactly

### The precedence

One sentence: **a bill reads its job's own calendar for whoever pays that bill, else that payer's
calendar, else the pace guess, and a date the customer named still wins the expected day.**

It is `calendarFor` in `src/lib/jobs/payCalendar.ts`, over rows of `payer_pay_calendars`:

1. The row for this payer **and** this job. If it is the off switch, the answer is none, whatever
   the payer holds.
2. Else the payer's own row.
3. Else none, and the bill reads the pace guess as before #323.

`billedPayModel` (`src/lib/jobs/billedDuePay.ts`) then lets a promised date (*They said*) take the
expected day. The due day rides along under it.

### A GC's calendar against a customer's

The owner asks about both being set. They never compete, because **a bill has exactly one payer**.
`paySpeedPayer` (`src/lib/jobs/billToParty.ts`) decides it per bill, in this order:

1. An email typed on the bill itself: the payer is nobody on file. **That bill reads no calendar,
   not even its job's own.**
2. The bill's own pick, GC or customer.
3. The job's *Bills go to*. A GC job with no customer on it always bills the GC.

Only that one payer's rows are looked at. So a GC and a customer can each hold a calendar, and one
job can even hold two rows of its own, one for each. Each bill reads the rows of whoever pays it.

One consequence the owner should know. **A job's own calendar is stored under one payer.** Set it
while the GC pays, then flip *Bills go to* to the customer, and the job's bills read the customer's
calendar or the pace guess. The job's row is still stored and no screen shows it. See gap 5.

### What a calendar holds

| Field | Values |
|---|---|
| Bills must be in by | the last day of the month, or a day 1 to 28 |
| They pay on the | a day 1 to 30, or the last day |
| Of | the same month, the next month, or the month after that |
| They pay when the owner pays them | a tick. The due day then reads *no sooner than*. It adds no date. |
| Where the contract says it | a clause number and a few words |
| On a job only | **This job has no pay calendar**, the off switch |
| On one bill | the day they accepted it (`invoice_payer_acceptances`), which moves that bill's clock |

Who may set it: the office roles, checked again on the server (`can_write_payment_promises()`).

### What a calendar cannot hold

| The contract says | Today |
|---|---|
| Paid a number of days after the bill, or after it is approved | Since v2.7343, the window's second answer under *How they pay*, counted from the day the bill was accepted. #323 had left it out on purpose for a payer, since the measured pace is the better guess. |
| Pay when paid, with a real date | The tick only. Nothing records the day the owner paid the GC. |
| Retainage released on its own date | Since v2.7341 the release bill takes its own due day. Nothing marks a bill as a retainage release, so the office sets the day. |
| One bill due on a named date | Since v2.7341, *This bill is due on…* under a billed row's dates (`invoice_due_days`). Before, *They said* was the nearest thing, kept per job. |
| Dated draws not yet billed | No home. The forecast counts bills, and Cutoffs coming counts work by its payer's cutoff. |
| Paid three or more months after the cutoff | No home. The choice stops at the month after next. |
| Two pay runs a month, business days, holidays | No home, by #323's own choice. The measured lateness soaks most of it up. |
| Different terms for different bills on one job | No home. One calendar per job and payer. |

## Does the job's own calendar hold everywhere?

**Yes, on every screen that reads a calendar.** Each passes the job to `calendarFor`.

| Screen | Where it reads | Job's own wins |
|---|---|---|
| Pipeline billed rows, desk and phone | `JobsStagesTab.tsx` | Yes |
| Ready to Bill row, its header chip, a Working row's line | `JobsStagesTab.tsx` | Yes |
| Payment forecast | `billedPaymentForecast.ts` | Yes |
| Cutoffs coming | `cutoffsComing.ts` | Yes, on its own line. The line names the payer and not the job. |
| The job window's bills | `useJobBilledExpectedPay.ts` | Yes |
| Call mode, and the count of calls beside it | `paymentChase.ts` | Yes |
| Money waiting and the Pay speeds window's bills | `moneyWaiting.ts` | Yes for each bill. Since v2.7339 the payer's summary line reads its bills. |
| Dashboard Accounts Receivable | `arCustomerRollup.ts` | Yes for each bill. Since v2.7339 the customer's summary line reads its bills. |
| Lien runway and the Lien desk | `lienCalendarRows.ts` | Yes |
| Bill Customer's cutoff line | `BillCustomerPayCutoffLine.tsx` | Yes |

Two things do not follow the job:

- **The record**, until v2.7339. The lateness under a due day replayed the payer's payments on
  **all** their jobs through this job's calendar. A job on its own calendar is now scored on its
  own payments once it has two. See gap 4.
- **The two summary lines** named in the table, until v2.7339. Each now reads the calendar of the
  bill furthest past its day.

Screens that read **no** calendar yet, the payer's or the job's. None of this is new:

- In hand in another session (branch `pay-calendar-last-readers`): the Development page's Money
  look, Messages' They owe us, the residential flow, Quickfill's Billed awaiting payment.
- Parked on #323: the payment forecast email and the Money waiting email.
- Waiting on #318: the Bridge's Collect pile and cash runway, the Dashboard's Money in strip, the
  Monday Bridge email.
- Not built on #323: the Needs you line, GC Review's *expected pay by* box, the *~N days* on a
  customer's profile.

## What prod holds today

Read 2026-11-13 through the dev seat. Reads only. Counts only, and no name leaves the read.

- **Pay calendars: none.** No payer's, no job's, no off switch. #323 ran one save on a test
  customer that day, and the dev seat reads no row now.
- **Accepted days: none. Their paper records: none.** Every stored contract is on our own form.
- **40 open jobs name a GC**, across 13 GCs. Open here is Working, Ready to Bill or Billed. The
  GC pays on 36 of them.
- **One GC holds 18 of the 40**, and two of its jobs are among the biggest. That is the owner's
  case in the data: one payer, many small jobs, and a big one that may be on other terms.
- **Eight of the 40 are large against the rest**, across seven GCs.
- **None of the 40 is in a development.** Three open jobs are in one, and none of those has a GC.

So nothing the owner asked about is set yet, and a level for developments (#323's call 6) would
help no job today.

## The path a person takes today

Read from the components. Not pressed on screen, since prod has no calendar to press.

**When the payer already has a calendar** (the guide's path, *One job on a different calendar*):

1. **Jobs → Pipeline**, find the job's row.
2. Press the calendar's words under the row's dates. On a Ready to Bill row, press the *Send by*
   line.
3. Under **This calendar is for**, pick **Only <job>**.
4. Set the days, or tick **This job has no pay calendar**.
5. Press **Save for this job**.

**When the payer has no calendar**, which is every payer today, that press is on no row. The words
under the dates read *Pays in …* and open Pay speeds, whose line opens the payer's window with no
job. One door is left:

1. Open the job, or open **Bill Customer** on it.
2. In the **Customer Contract** row, press **Their paper…**. A job that already has a record
   reads **Edit the record**.
3. In the sheet, press **Set <payer>'s pay calendar…**.
4. Pick **Only Job <number>**, set the days, press **Save for this job**.
5. Close the sheet. Nothing needs recording on the paper.

A job whose contract is signed, or out for signing, on our own form shows neither press, so it has
no door at all. The way around is to set the payer's calendar on their profile, press the words on
the job's row, save the job's own, then remove the payer's if they should have none. The job's row
stays.

For one bill with a date of its own, the nearest thing today is the promised date on the row. It
wins the expected day. It is kept per job, so it moves every open bill on that job.

**Corrected 2026-11-13, on the walk for PR 1.** The Their paper door did not draw where this
section sends a person. The Pay calendar window's provider sat below the job window's and Bill
Customer's, so the sheet opened from either found no opener and showed no press. Until PR 1 is
live, the one way to a job's own calendar is the way around in the paragraph above: set the
payer's, press the words on the job's row, save the job's own.

## The gaps

| # | Gap | Size | Migration |
|---|---|---|---|
| 1 | **The door.** The job window has no way into its own calendar. Neither does a row whose payer has none. | S | No |
| 2 | **The mark.** No row, hover or window says a job is on its own calendar. The words are the same as the payer's. | S | No |
| 3 | **The trap.** A job switched to none loses its calendar words, and with them its only press. Nothing leads back to **Follow <payer> again** but the Their paper sheet. A payer's window lists none of the jobs that carry their own. | S, with 1 and 2 | No |
| 4 | **The record.** A job's own calendar is scored against the payer's payments on every job. The payments read already carry their job, so the job's own can be picked out. | S | No |
| 5 | **The payer on the row.** A job's calendar is stored under one payer. A bill typed to another email, or a job whose *Bills go to* later flips, reads past it with no word said. | S | No |
| 6 | **A bill's own due day.** One bill due on a named date: a retainage release, a dated draw once billed, a final payment. It would sit at the top of the ladder: bill, job, payer, guess. | M | Yes, a small side table like the accepted day's |
| 7 | **A number of days after the bill.** A second shape of terms, for a job or a payer: paid 45 days after it is accepted. | M | Yes, one column and the function |
| 8 | **Small ones.** The Their paper door does not carry the development, so it never offers *Also set on the other jobs*. Cutoffs coming does not name a job on its own line. The two summary lines above. | XS each | No |
| 9 | **Dated draws not yet billed**, and **a real date for pay when paid.** | L and M | Yes |
| 10 | **A development as its own level** (#323's call 6). | M | Yes |

Gaps 9 and 10 are named so they are not asked again. I would not build either now. No open GC job
is in a development. A draw schedule changes what the forecast counts, and wants its own card.

## The plan

| PR | What | Size | Migration |
|---|---|---|---|
| 1 | **The door.** A **Pay calendar** line in the job window, always there for the office. It says which calendar the job reads and opens the window on that job. Pay speeds, opened from a row, carries the row's job into the window. The Their paper door carries the development and the board's own label for the job. One kernel answer, `calendarSourceFor`: the calendar and whether it is the job's own, the payer's, switched off or none. The guide's section gains the second path. | S | No |
| 2 | **The mark.** *This job's own* before the calendar's words on a billed row, a Ready to Bill row, the Working line, the job window's bills, Call mode and the hover. *No pay calendar on this job* as a quiet press on a job switched off. Cutoffs coming names the job on a line that is one job's own. The payer's window lists the jobs that carry their own, each a press. The two summary lines read their bills. A word in the window when a job holds a row for a payer who no longer pays it (gap 5). | S | No |
| 3 | **The job's own record.** A job's own calendar is scored on that job's payments once it has two, and says so. Until then it says the record is the payer's on other jobs. The payer's summary line in Money waiting and Accounts Receivable reads its bills' calendars. | S | No |
| 4 | **This bill is due on…** A press under a billed row's dates, beside the accepted day's. The day wins over any calendar for that one bill. On call 3. | M | Yes |
| 5 | **A number of days after the bill.** The window's first choice becomes how they pay: on a set day of the month, or a number of days after the bill is accepted. On call 4. | M | Yes |

PRs 1 and 2 answer the ask. PR 3 keeps the new due day honest. PRs 4 and 5 are new kinds of terms
and wait for a real contract that needs them.

Files PRs 1 to 3 touch: `payCalendar.ts`, `PayCalendarModal.tsx`, `PayCalendarLine.tsx`,
`JobsStagesTab.tsx`, `TheirPaperSheet.tsx`, `cutoffsComing.ts`, `moneyWaiting.ts`,
`arCustomerRollup.ts`, `billedDuePay.ts`, the job form's fact rows, and the guide
`set-a-payers-pay-calendar.md`. None is one of the four files the other session is moving.

## Where it stands

- **PR 1, the door**, built 2026-11-13 after the owner's *Yes, build both*: the job window's
  **Pay calendar** row, Pay speeds carrying the row's job, the Their paper door carrying the
  development, `calendarSourceFor`, and every screen reading again after a save. The walk found
  the provider fault above and the PR fixes it. Walked on the local app with no save made.
- **PR 2, the mark**, built the same day on top of PR 1: *This job's own* on a billed row and on
  the cutoff line, *No pay calendar on this job* under a row switched off, the job named on its
  Cutoffs coming line, the payer's window listing the jobs that do not follow it, and the word
  for a calendar held for a payer who no longer pays the job (call 5, my first pick). Walked on
  live rows with made-up calendar reads and every write refused.
- **Moved from PR 2 to PR 3:** the two summary lines in Money waiting and Accounts Receivable.
  They rest on whose record scores a job, which is call 2.
- **PR 3, the job's own record**, built 2026-11-15 on Taunya's *build the entire PR train*
  (v2.7339). A job on its own calendar is scored on that job's payments once it has two
  (`recordFor`, `JOB_RECORD_MIN_PAYMENTS`), on its payer's until then, and the line under its due
  day says which. The Pay calendar window says it on the job's side. The two summary lines read
  their bills (`payerCalendarSummary`). It stands on **the first pick for call 2**, which the
  owner has not answered: the fragment says how to put it back.
- **PR 4, one bill's own due day**, built 2026-11-15 (v2.7341, migration `20261115170000`):
  `invoice_due_days` and `set_invoice_due_day`, *This bill is due on…* under every billed row's
  dates, the window that sets the day with its clause, and the day at the top of the ladder
  (`calendarSourceFor`'s `from: 'bill'`). It rides with the calendars, so every screen that reads
  one reads it. **Built as carded with call 3 unanswered**: the owner's first pick was to wait,
  and nothing reads differently until a day is set.
- **Not walked:** a real save. No calendar and no bill's own day is set on prod, so the first one
  set is the live walk.
- **PR 5, a number of days after the bill**, built 2026-11-15 (v2.7343, migration
  `20261115190000`): `payer_pay_calendars.days_after`, the window's first choice *How they pay*,
  and the kernel's second shape (`PayCalendar.daysAfter`): due that many days after the bill is
  accepted, with no cutoff. **Built as carded with call 4 unanswered**: the owner said that if no
  big job pays this way it is never built, and nothing reads differently until someone picks it.
  Call 4 was answered on 2026-11-25: none does, and the choice can be hidden until a contract needs it.
  **Hidden 2026-11-27 (v2.8714):** the window and the estimator's pay terms open on **Bills must be
  in by**. The choice is drawn only for terms already in days, and one switch in the kernel brings
  it back.
- **Left for a deploy:** the morning run (`messages-nudge-dispatch`) reads a bill's own day and
  terms in days in the code since v2.7452, built 2026-11-16 on the owner's ask of that day
  (`_shared/payTermsRead.ts`, each read soft alone). It is proved in tests alone: one made-up
  database read by the screen's loaders and by the function's own read gives each bill the same
  due day (`morningRunPayTerms.test.ts`). **Deployed 2026-11-16 at 10:52 AM Central** (version
  61), on Taunya's go that named the function, which the owner passed on that morning. It boots,
  and `npm run check:edge-drift` no longer names it. The 9 AM run of 2026-11-17 is the first
  morning on the new reads. Not proved on a real row: no calendar and no bill's own day is set.
- **What is left is the live walk.** Three things have never been saved for real: a calendar on
  a job, a due day on one bill, and terms in days, which the window no longer offers. Each is held
  by kernel tests, render smokes and the SQL bed.

## How to verify

- Local app with writes refused, as on #323: `npx vite --host 127.0.0.1 --port <free>
  --strictPort`, then `/dev-login?as=1&to=/jobs?tab=stages`. Abort every non-GET but the sign-in
  and the read RPCs, and answer the calendars read with made-up rows.
- The kernel is pure. `calendarSourceFor` gets the table in *The precedence*, plus a job row under
  a payer who no longer pays.
- The first real calendars are the walk. The save has never run on a payer with bills.

## The live walk

Two parts. The first is a look and writes nothing. The second is the first real save, and it waits
on Taunya: which job is on its own terms, and what its contract says.

**Part 1, a look after v2.8714 is live. No write.**

1. Open Jobs, then the Pipeline's billed rows (`/jobs?tab=stages`). Press the *Pays in* words
   under any billed row's dates, then the Pay calendar press on the payer's card.
2. The window's title reads *Pay calendar · <the payer>*. Its first line ends *a set day of the
   month. Leave it unset for one with no such terms.*
3. The first field is **Bills must be in by**. There is no *How they pay* and no press that reads
   *A number of days after the bill*.
4. Change a choice and read the blue box say the calendar back in dates. Do not press
   **Save pay calendar**. Close the window with Cancel.
5. Open a job's window and press its **Pay calendar** row. The same window opens with the switch
   at the top on that job. Close it the same way.
6. At 380 px wide the fields stack, and no press is under 44 px tall.

**Part 2, the first real save. It writes, so it needs Taunya's yes by name and her facts.**

1. Taunya names one job on its own terms, its cutoff day, its pay day, the month the pay day falls
   in, whether it is pay when paid, and the clause.
2. Open that job's **Pay calendar** row. Set the switch to that job alone. Fill the fields and read
   the blue box against the contract before saving.
3. Press **Save pay calendar**. The row in the job window now reads *This job's own* and the
   calendar's words.
4. On the Pipeline, the job's billed row reads *This job's own* before its due day, and **Cutoffs
   coming** names the job on its line. A billed row of another job of the same payer does not
   change.
5. On one billed row of that job press *This bill is due on…*, set a day, save, and see the day
   win over the calendar on that row alone. Take it off again unless Taunya wants it kept.
6. Next morning, read the morning run's line for that job: it names the same due day the row does.
7. Say what was saved and that it is real, so it is not taken for a test row.

A walk on a ZZ Test customer and job can stand in for part 2's steps 2 to 5 when Taunya has no
contract to hand. It proves the save and not the contract's words, and every row it makes is
deleted after.

## The owner's calls

My pick is first on each.

1. **Build the door and the mark?** Yes, PRs 1 and 2. Or leave it and use the Their paper door.
2. **Whose record scores a job on its own calendar?** That job's payments once it has two, the
   payer's until then, and the row says which. Or always the payer's, as today.
3. **Does one bill need a due day of its own?** Not yet. Wait for the first retainage release or
   dated draw that reads wrong, then build PR 4. Or build it now.
4. **Do any of the big jobs pay a number of days after the bill?** If none does, PR 5 is never
   built. If one does, say which contract and PR 5 goes ahead of PR 4.
   **Answered 2026-11-25 (UTC) in the managing session:** *None does. The "terms in days" choice can be hidden until a contract needs it.*
   It is quoted from that session's record of the user's answers.
   PR 5 was built before the answer, as v2.7343.
   The answer says hidden, not taken out, so what PR 5 built stays behind the hidden choice.
   Hidden 2026-11-27 as v2.8714: the window opens on **Bills must be in by**, and the choice is drawn only for terms already in days.
   The switch that brings it back is `PAY_CALENDAR_DAYS_AFTER_OFFERED` in `src/lib/jobs/payCalendar.ts`.
5. **When a job's *Bills go to* changes, should its own calendar go with it?** No. The contract was
   with the first payer, so the window says the job holds a calendar for someone who no longer
   pays it, and offers to clear it. Or yes, the job's calendar follows whoever pays.

And one thing only he can supply: which jobs are on their own terms, and what each contract says.
