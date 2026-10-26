---
name: "The Collect desk: a modal that says what clears the pile"
number: 177
group: close
status: BUILT and LIVE 2026-10-26. Seven PRs on main: A #6142 v2.5848, C #6146 v2.5854 (carrying B #6145 v2.5853), G #6151 v2.5858 (carrying D #6148 v2.5855, E #6149 v2.5856, F #6150 v2.5857); B, D, E and F closed with a note, since the merge queue squashes each PR and a stacked branch cannot merge once the one below it lands. Shipped after #6153 gave the deploy's vite build an 8 GB heap. A live test the same day found the sheet promising waits it never kept; #6172 v2.5873 fixed it: a no-date call waits three days off the sheet, a live promise waits for its day, a dispute leaves for the owner's strip, a second miss puts the owner on the call, the third tile reads the late pile, and lien chips load for every payer. Verified 2026-10-26 against the live pile on main's code, and in the deployed bundle.
summary: >
  Pressing the Bridge's Collect card opens a modal that reads the billed-not-paid pile by where
  each bill stands against its payer's own pace, names the few payers that hold it, gives each one
  move with the words to say and an owner, pulls the owner's decisions apart from the office's
  calls, records each call's answer as the Payment Chase touch it already is, and on Friday says
  whether the week moved and what Monday carries. Six kernels, one loader, one modal, a Friday
  scorecard, and two rules that move the Bridge card itself.
next: the owner plays with it. Left for a later PR: `billedExpectedPayModel` still reads the company median (only the Bridge's receipts band reads the pile's expected days); of the data fixes below, two are done; the duplicate payment and the stale percents are the owner's.
size: L (seven PRs; A–C are the modal, D closes the loop, E–F move the card, G is the owner's data list)
blocker: none. The four rules shipped as inputs with the defaults the live data settled: a pay application or a commercial payer's hand-marked bill reads as a GC, the GC pace comes from the GCs in the pile, the card's weeks read the late pile, promises come from the Payment Chase.
opinion: build A–C first and ship the modal read-only; D is where the value is but it waits on the office recording calls; E and F change what the red says and should each merge alone
mockup: https://claude.ai/artifact/77vsypbwrcnkbJYGpKekxK (Monday · Friday · After the call; version 24, 2026-10-25)
---

# The Collect desk: a modal that says what clears the pile

## The ask

The owner, 2026-10-25, looking at the Collect card (*$297k billed, not yet paid · 47 invoices late · the office bills $56.8k a week · customers pay $29.2k a week · 10.2 weeks · the weakest link*): *"I would like to be able to click on something on this card to see a modal of this broken down so that I as a user can have a better idea of what I need to do to overcome this limiting factor."* The mock-up was drawn on the real pile read that day and reviewed five times; the boards are the spec. This file turns them into rules, reads and a train.

## What the modal answers, in reading order

1. **How much of this waits on a call?** Only the late part. On 2026-10-25: $122k of $297k, 40 bills, 7 of them past a promise; $19k more doubtful; $158k not yet due by each payer's own pace.
2. **Who holds it?** Six payers held $274k, 92 %. Six moves, not 55 bills.
3. **What is the one move on each**, with the words to say and an owner and a day from the recorded plan.
4. **Only you can decide these** — the owner's decisions pulled out of the office's calls (a job's GC record, a lien affidavit, terms on a slow payer).
5. **What slows Collect before any call** and **when the calls are not enough**, folded by default.
6. **Friday asks three things**: how much of the ask landed, how many calls ended with a date, whether the notices went out.

## Decisions before the first PR

These four rules were invented on the boards. Each changes a number the owner will read. He confirms or changes them; the kernels take them as inputs, never as constants.

1. **A payer with a pay application on the job reads as a GC**, whatever its customer record says, and a GC with no pay history reads at the GC pace on record here (the median of the GCs who have paid us, 35 days from three payers today). Any other payer with no history reads at its segment's median (commercial 12, residential 2), not the company's 7. *Why:* Structura's $103k pay application read 19 days late at 7 days and comes due Oct 29 at 35. The forecast (`billedExpectedPayModel`) uses the company median today; PR F moves it.
2. **A late bill paid within 7 days of a recorded touch counts as paid after a call.** A bill paid on or before the day its pace predicted was coming anyway. *Why:* Friday must not flatter a week in which one pay application paid on its own run.
3. **A second miss on an account, a broken date or a no-answer, puts the owner's name on the next step.** *Why:* one rule for escalation across the call sheet, the touch record and Friday.
4. **The modal's weeks and the card's weeks read the same pile.** Today the card divides the whole billed-not-paid pile by the pace (to-do #107, calculation 3). Either the card moves to the late pile with the not-yet-due share grey (PR E), or the modal shows both figures and says which the card uses. The owner picks; the mock assumes E.

Two data fixes the owner makes by hand before any of this reads right: Structura becomes the GC on SpaceX BA-02N (today it is the customer, so the Lien desk and GC Review never see the $103k), and "GC test project, delete me" leaves the ledger ($4.4k in the pile, a fake promise). Both done 2026-10-26: the GC set through Edit Job's *Use bid's GC*, the test job deleted (a dev can restore it for 90 days from Recently deleted).

## The kernels (pure, `src/lib/bridge/collect/`, each with a test file)

### `collectPile.ts` — every open bill, by where it stands

Input: the AR rows bill truth already produces (`fin.data.ar.items` and the Collections bucket), each with its job, payer (customer, or the GC when `bill_to_party` or the invoice's own pick says so, the way `effectiveInvoiceParty` resolves it), `billed_at`, amount, remainder; the pay-speed data (`PaySpeedData`: customers, segments, company); the promises by job (`list_job_promised_pay_dates`); the pay applications by job (`job_pay_applications`, live rows); today.

Rules, in this order, one state per bill:

| state | rule |
|---|---|
| `collections` | the job carries `collections_at`; kept apart, off the bar, counted in the legend |
| `promised` | a promise on the job with a date on or after today |
| `broken` | a promise whose date is more than `BROKEN_PROMISE_GRACE_DAYS` (7) before today |
| `doubtful` | no promise, and today is more than `DOUBTFUL_AFTER_DAYS` (60) past the expected day |
| `late` | no promise, and today is past the expected day |
| `notdue` | everything else |

The **expected day** is `billed_at` plus the payer's pace. The **pace** is the payer's own median when it has `PAY_SPEED_MIN_SAMPLES`; else the GC pace here when the payer is a GC by record or by decision 1; else the segment median; else the company median. The pace and its source are returned per bill so the card can say *~35 d · first job · the GC pace, by the pay application*.

Output: the bills with their state, the totals and counts per state, the headline (sum of every state but `collections`), and `latePileUsd` = `late + broken` (the part a call can move) with `doubtfulUsd` apart.

### `collectPayers.ts` — who holds it

Group the bills by payer. Per payer: open, bills, jobs, oldest bill age, pace and its source and sample count, the promise state (none, kept, broken, with the date and who recorded it), the amount over 60 days old and the amount doubtful by pace, the last touch (`ChaseTouch` newest, with `arLastTouchLine`), the lien state (`lienArChip` over the desk's Do-now rows: notices due with their close dates, notices sent with their dates, affidavit windows), and the bills marked billed by hand (no `sent_to_customer_at`). Sort by open, biggest first. The **cut**: the smallest set of payers holding 90 % of the headline, capped at six; the rest is one line (*17 bills, 14 payers, none over $6.6k*).

### `collectMoves.ts` — the one move per payer, and the words

The move is the first rule that matches, and the opener is built only from facts the kernel holds; a fact it does not hold is asked for, never asserted.

| order | when | move | opener (the "Say:" line) |
|---|---|---|---|
| 1 | a broken promise on the account | **Call: the \<date\> promise** | *the $X promised for \<date\> has not landed. What happened, and what is the new date?* |
| 2 | a hand-marked bill on a GC payer (a pay application) | **Call: is the pay app approved?** | *pay application N, $X, marked billed here \<day\>. When did it go in, is it approved, and which pay run is it on?* |
| 3 | not yet due, no date, GC payer | **Call for the pay date** (before the due day) | as 2 |
| 4 | more than N bills (N = 6) on the account | **Send the statement, then call** | *N open bills, $X, the oldest from \<month\>. Which can you pay this week, and when?* |
| 5 | one or two bills late, the rest inside pace | **Ask about the \<amount\>** (outline button) | *the $X from \<day\> is N times your usual pace. Is something wrong with it?* |
| 6 | small bills under a threshold, no promise | **Send the statement** | no call |

Each move also names its **paper**: a notice due inside 30 days (*Draft the \<date\> notice ›*), an approved notice waiting for the run (*run the N approved notices ›*), an affidavit window (*Open the affidavit ›*), a bill past its own window (*a Legal desk question*). The owner and the day are read from this week's `BridgeCall.moves[].who`, never invented; with no call recorded the chip is empty and dashed.

A statement is a move, not a call. Friday's "calls that ended with a date" counts moves of kinds 1–5 only.

### `collectDecisions.ts` — only the owner can decide these

Rules that lift a row out of the office's sheet into the owner's strip, at most three, in money order: a payer with a pay application whose job records it as the customer (*put X on the job as the GC*); an affidavit window open on money over a threshold (*file the X lien by \<date\>*); a payer whose pace is over a threshold (*terms on the next bid*); a dispute recorded this week (*their words, your decision*). Each with a door: the job, the affidavit, the terms, the Needs You card.

### `collectWhatIf.ts` — the guess, stated as one

Given the pile, the pace, the asked-for sum (the cut's open less the bills that pay themselves inside pace), the Bill out-rate and the window length: if half the ask lands in three weeks, the pile is `headline + 3 × (billedPerWeek − paidPerWeek) − ask / 2`, the pace is `(window total + ask / 2) / 8`, the weeks follow, and the reading names the stage that would hold the link by `STAGE_PAIR_MARGIN`. Left alone: `headline + 12 × (billedPerWeek − paidPerWeek)`, the dial's own number. Both lines carry the words *a guess, stated as one*.

### `collectScorecard.ts` — Friday

Given Monday's recorded call (its moves, with `then`), the touches since, the payments since, the Lien desk's run record, and today's pile:

- **Landed, of the ask**: payments on the cut's bills since the call; **after a call** by decision 2, **on its own pace** otherwise.
- **Calls that ended with a date**: moves of kinds 1–5 whose payer has a `promised` touch since the call, or a payment, counted against the number of such moves (a statement is never in the denominator).
- **The notices**: drafted, signed, mailed, from the desk's items and filings since the call; *not yet* when the run has not recorded.
- **Monday carries**: every move not landed, re-ranked by `collectMoves` on today's facts, plus a watch line per promise date inside the next two weeks.
- The verdict words: the pile's net move (*$130k landed, $57k newly billed*), the pace on the week read into the window early, the weeks, the link by the pair rule. The owner agrees or not: `BridgeCall.outcome` as today, with *it moved* or *it did not really move*, both recorded.

### `collectOutcome.ts` — after the call

Four answers, mapped onto the Payment Chase kinds, nothing new in the record:

| answer | record | what then happens |
|---|---|---|
| Money is in the bank | a payment on the bills the remittance names (oldest first only when it names none) plus a `note` touch *paid after the call* | the pile falls; Friday counts it by decision 2; the payer gets its first pay speed |
| They named a date | `promised` with the date and their words; *"the check went out \<day\>"* is a promise for the mail day plus five; *"approved, on the next run"* is a promise for the run's date | the forecast moves; broken after the 7-day grace; a second miss carries the owner's name |
| No date | `cant_reach` for no answer or a wrong contact; `note` with their words when they spoke and named no day; *Resend the bill now* adds a `resend` | the row stays, gains *called \<day\>, no date*, is back on the sheet after `TOUCH_QUIET_DAYS` |
| They dispute it | `dispute` with what they dispute (the amount, the work, who owes it, a pay app they rejected) and their words | the row leaves the sheet to a Needs You card for the owner; the bills stay in the pile marked disputed; the lien clock keeps running |

## The loader (`src/lib/bridge/collect/loadCollectDesk.ts`)

One read per source, in parallel, all of them reads the app already makes somewhere:

- the AR rows: `useDashboardFinancials` (`fin.data.ar.items`, `arCollections`), with `customerId`, `jobId`, `dateYmd`, `amount`;
- payer resolution: `jobs_ledger` `bill_to_party`, `gc_customer_id`, `customer_id` and the invoices' own `bill_to_party` for the rows in the pile;
- pay speeds: `get_billed_customer_pay_speeds` (already in `loadBridgeData`, `data.paySpeeds`);
- promises: `list_job_promised_pay_dates` (already `data.promisedByJob`);
- touches: `list_payment_chase_touches` (the AR window's read, `useBilledMoneyData`);
- pay applications: `job_pay_applications` live rows for the pile's jobs, `job_id, application_number, application_date, current_payment_due, invoice_id`;
- lien: `list_lien_notice_months` and `list_lien_affidavit_windows`, plus `job_lien_desk_items` and `job_lien_filings` for the pile's jobs (the chips through `lienArChip`, the way `useArLienChips` does);
- this week's call: `bridge_calls` (already loaded for the scorecard);
- the window's flows: `data.invoicesSentByDay`, `data.paymentsReceivedByDay` (already loaded).

Nothing new on the server. ZZ test jobs leave through `loadZzTestJobIds` as on the Dashboard.

## The modal (`src/components/bridge/BridgeCollectDesk.tsx`)

Opens from the Collect card's arrow and from a *Break it down* line under the stage's desk (`BridgeLinkDesk`). Sections as the Monday board, in that order; the two bottom panels folded with one true line each, from the same counts as the panel. The move cell holds the button, the paper link, the owner chip and the *Say:* line. *After the call ›* on a row opens the outcome sheet over the modal; *Record this as the week's plan* writes the six moves into the Bridge call with their owners (`BridgeOrderModal` already writes a call); *Copy the call sheet* copies the rows as text; *Open the AR window* hands over. The header stamps the read day and the pay week. Esc closes with the one-layer guard the other Bridge modals use. Light and dark through the tokens; no raw hexes.

## The train

| PR | what | size |
|---|---|---|
| A | `collectPile.ts` + `collectPayers.ts` with tests on the 2026-10-25 figures (the SpaceX, Southern Post, RMC and H & I cases); decisions 1 and 4 as inputs | S |
| B | the loader and the modal, read-only: header, three tiles, the bar, the payer rows without moves, the folded panels; the help guide *the-bridge* gains the modal; `APP_DIRECTORY` unchanged (no route) | M |
| C | `collectMoves.ts`, `collectDecisions.ts`, `collectWhatIf.ts`; the move cells, openers, owner chips from the recorded call, the owner's strip, *Record this as the week's plan* | M |
| D | `collectOutcome.ts` and the outcome sheet over the Payment Chase touch; the mailed-check and next-run helpers; *paid after the call* note | S |
| E | the Collect card's weeks on the late pile with the not-yet-due share grey (to-do #107 calculation 3), the same `collectPile` read; changes what the red says, merges alone | S |
| F | the GC pace rule in `billedExpectedPayModel` and the forecast (decision 1): pay application → GC; segment median before company; the receipts band and the Money owed panel follow; merges alone | S |
| G | `collectScorecard.ts` and the Friday card: the three asks, landed after a call, Monday carries, the owner's *it moved / it did not really move* | M |

A–D are one surface and stack; E and F each move the Bridge card and merge alone with their own release notes; G waits on D for its counts. Every PR: a release note, a `docs/recent-features` fragment, plain words on every sentence (`plainWordsFailures` over the modal's copy in a test, the way the guides are held), a render smoke.

## Verify

As the dev on the Bridge with the Collect card lit. The modal's headline equals the card's pile less Collections. The late tile plus the doubtful equals the card's *N invoices late*. The six payer rows sum to the tile. Press a row's move: the AR window opens on that customer. Record the plan: the Monday sheet's call shows the six moves with their owners. Record a promise from the outcome sheet: the AR window's chase pill reads *promised* and the forecast's receipt moves. On Friday the scorecard's three lines read from touches, payments and the Lien desk alone, nothing typed.

## Where it stands

Designed 2026-10-25, built the same day, live 2026-10-26, fixed after a live test in #6172 (see status). Structura, Inc. is the GC on the SpaceX job and the "GC test project, delete me" job is deleted, both 2026-10-26. The duplicate $9,500 Heron payment the owner removes by hand: the app refuses any row on a bill Stripe marks paid. A guard fix that narrows the refusal to the rows Stripe holds (a migration, a SQL bed and the client rule) sits unpushed on the local branch `claude/stripe-double-row`, by the owner's call; revived, it needs a fresh version and migration number. The stale percents on working jobs are still his. `billedExpectedPayModel` is the one piece of the plan not moved to the pile's paces.
