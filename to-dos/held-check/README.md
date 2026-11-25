---
name: "A held check: recorded the day it comes, counted the day the bank makes it good"
number: 437
group: ready
status: asked 2026-11-24 by Diane, with a payer's check deposited and not yet good at the bank · every place a typed check counts was read in the code, and everything the app knows about a check clearing · a first draw, a critique and a second draw the same day · the same day she asked for a badge on the Pipeline card and for the path when a check fails, both added · piece 1 is built as v2.8525, no release before the bank clears the check, and it found that the bank posts a check days before the day it names · call 1 answered the same day: cleared is the bank's named day · calls 2 to 6 answered 2026-11-25 (UTC) in the managing session: the bank's posting counts a check with no press, every check, a leader, a controller or a dev may release before the bank clears it (the card's pick, a leader only, overturned), a payer whose check came back waits six more days, and the payer's page keeps the drawn words · pieces 2 to 7 are not built
summary: >
  A paper check typed on a bill counts everywhere the moment it is saved: the bill reads Paid, the
  customer's page says all paid up, chasing stops, the job leaves the lien lists. Only three things
  wait for the bank. The owner wants a check recorded the day it arrives, counted only when it
  clears, and no lien released before then. The bank's own row already holds the check, its number
  and the day the bank expects it. The card proposes a held check: the Dashboard says a check is at
  the bank and what it fits, one press holds it for those bills, nothing counts while it is held,
  and the bank's posting counts it and tells the office which liens to release.
next: Two small pieces can start. The mend to piece 1 (S) holds its early release to a leader, a controller or a dev. Piece 2 (S) puts the bank's own day on Money in. Then the screens of pieces 3 to 7, drawn on the day the bank posts, are redrawn on the bank's named day before piece 3 is built.
size: L as a train of seven (S · S · M · M · S · S · M)
blocker: Nothing for the two small pieces. Two questions the answers left open wait on the owner before pieces 3 and 4, both under The calls. Counsel's three questions gate nothing in the build.
ask: owner · decide · Do Count it now and the sooner release for a returned payer go to a leader, a controller or a dev, as the early release does?
opinion: build — one rule for every check, made from what the bank already tells the app; piece 1 closes a hole in #435 as built
---

# A held check: recorded the day it comes, counted the day the bank makes it good (#437)

The plan and its mock-up are [`mockup.html`](./mockup.html), served at `/to-dos/held-check/mockup.html`.
The second draw can be pressed: five stops, and four things the bank can do.
Every name, address, job, check number and amount on it and in this card is made up.
The repo is public, so nothing here is copied from the live app or from the matter that raised the question.

This card follows [#435, a lien payoff](../lien-payoff/README.md), and answers its first call for the owner.
It builds on [#76, returned checks](../ar-returned-checks.md) and on the Dashboard's Money in line.

## The ask

2026-11-24, Diane, with a payer's check at the bank and not yet good:

> Once it clears … I would like to then count it and suggest to assistant [Taunya] to release these liens. How
> can I make it easy for assistant [Taunya] to record the check in a way where it shows when the check clears
> we will release the liens. But not before then? I think this may touch on areas including billing.

## In three lines

1. **The door is the bank's own row.** When a check is deposited, the Dashboard says so and names the bills it fits. One press holds it for those bills. Nobody types the check.
2. **A held check counts nowhere.** Its bills stay open, each marked with the check and the day the bank expects it. Chasing stops for those bills. The lien clocks keep running.
3. **The bank's answer does the rest.** When the bank has posted it and the bank's named day has come, the app counts it and tells the office which liens to release. When the bank fails it, nothing has to be undone.

## What happens today

A check typed on a bill goes through `mark_invoice_paid`, which has no branch for the kind of money.
It counts at once:

- The bill flips to `paid`, and a job paid to zero flips to `paid` and moves to *Paid in Full*.
- The customer's page says *You're all paid up* (`customer-portal`).
- The sub's page says *Customer paid*, and the office is nudged to queue their pay (`subPortalCustomerPaid.ts`).
- *Paid in full* and *Payment progress* emails go to the office.
- The chase list, the statements, the Collections mark and the Uncollectible mark all stop or clear (`paymentChase.ts`).
- The job leaves the lien lists and the year-to-sue watch.
- Bills sent, the customer's lifetime totals and their pay speed count it (`billsPaid.ts`).

Three things wait for the bank:

- The prompt for an unconditional waiver, seven days (`checkClearing.ts`).
- The close of a Stripe invoice, seven days (`heldStripeMark.ts`, the `close-held-stripe-marks` sweep).
- The Dashboard's Money in line, which follows the bank (`moneyInWeek.ts`).

Two faults sit in that:

- **The seven days run from the day typed, not from the bank.** A check typed the day it is deposited closes its Stripe invoice before the bank expects to post it, and Stripe never takes that back.
- **Two screens can show two days for one check.** The Bill tab counts from the payment's typed day and Accounts Receivable from the day the deposit posted.

## What the app already knows

- **The bank's row.** `mercury_transactions` holds a deposited check as `pending`, with the check number and the day the bank expects it in `raw` (`checkNumber`, `estimatedDeliveryDate`), and images of the check. Piece 1 reads that day and the check number (`checkCleared.ts`).
- **Two days, not one.** The bank posts a check deposit within a day or three. The day it names is about a week after the deposit. A check reads posted days before the day the bank names.
- **Posted deposits only.** Accounts Receivable lists a deposit once `posted_at` is set, and can then split it over bills and jobs, Stripe bills among them (`BankPaymentsModal.tsx`).
- **A failed deposit.** The bank marks a check `failed` with its reason. Of the failed check deposits the returned-check work counted, most never posted and the rest came back within six days of posting (`bankReturnedDeposits.ts`).
- **Money in.** The Dashboard already draws *In the drawer* and *At the bank*, with a guessed posting day.
- **Their word.** A paid claim, *They say they paid*, never marks a job paid and pairs with the deposit when it lands (`paidClaims.ts`).

## Four words for a check

| The word | What is true | What the app does |
|---|---|---|
| In the drawer | The office has the paper. It is not deposited. | Holds it for its bills. Asks for the deposit after three days. |
| At the bank | It is deposited. The bank shows it as pending and names the day it expects it. | Holds it for its bills. Shows the bank's day. Counts nothing. |
| Cleared | The bank posted it, and the day the bank named has come. | Counts it on its bills that day. Tells the office what to release. |
| Came back | The paying bank refused it, before or after posting. | Ends the hold. The bills chase again. After posting, the returned-check case takes over. |

## The badge on the Pipeline card

Asked the same day: a badge, so a person can tell at a glance that a job is not paid yet and a check is held for it.
A job's card says which of three things is true, in the section where the card already lives.
A held check never moves the card. Only money the bank posted does.

| Where the card is | What is true | The badge, in the card's dates |
|---|---|---|
| Billed Awaiting Payment or Collections | Not paid. A check is held for it. | **Check at the bank** with the bank's day, or **Check in the drawer**. It takes the place of *Expected* or *They say paid*. No reminder is due. |
| Paid in Full | Counted, because the bank posted it. It can still come back for about six days. | **Check clearing** with the last of those days, amber. It goes by itself. |
| Billed again, after a return | The check came back. | **Check came back** with the day and the bank's reason, red, with **Open the case ›**. |

Each section's head counts them: *Billed Awaiting Payment (12) · 1 with a check at the bank*, *Paid in Full (40) · 2 clearing*.
The card's dates are `billedDatesLedger.ts`, where *They say paid* already takes the money row.

## When a check fails

The bank can fail a check three ways.
They are different problems, and the returned-check work already tells the first from the second by the bank's reason (`bankReturnedDeposits.ts`).

| What happened | What is true | What the app does by itself | What the office presses |
|---|---|---|---|
| The bank could not read it | The deposit failed with no reason from the paying bank. The check never reached it. This is the usual failure, and the check is usually deposited again. | Puts the check back *in the drawer*. The hold stands and its bills stay marked. The Dashboard says *Deposit check 1184 again*. A new deposit of the same amount takes the hold back. | Nothing in the app. Deposit it again, or **Let it go** if a new check is coming. |
| It came back before it was counted | The paying bank refused it: no funds, a stop, a closed account. | Ends the hold. Nothing was counted, so no bill, job, page or email has to be undone. The card's badge turns red, the bills are chased again, and the liens read on record. The payer is marked as one whose check came back. | **Open the case ›**: add the returned-check fee to a bill, write down what they say, and hold the new check when it comes. |
| It came back after it was counted | The bank posted it, the app counted it, and within about six days the bank took it back. | Opens the returned-check case that exists today and tells the office once. The card's *Check clearing* badge turns red where it sits. | **Take it off the job**: the payments come off, the bills read open, and the card moves back to Billed. The case names any release made on that check. |

Three gaps in the last row need building.
The Collections mark a job lost when it read paid does not come back.
A sub told *Customer paid* is not told otherwise.
A release made on the check is not named on the case.

## The first draw, and is it the best we can do

The first draw put the hold inside the Lien desk's check pane, with a *Count it* press on the day the bank posted.

1. **She has to know to go to the Lien desk.** The check reached the bank from her phone, and the app already holds the bank's row. It should come to her.
2. **It only works where a lien is filed.** A check for an ordinary job had no such door, so the rule would hold for some checks and not others.
3. **A second press can be forgotten.** She said which bills on day one. A press on the day it clears adds a day's delay and no new choice.
4. **The day reads as a promise.** It is the bank's estimate. If the bank is late, the screen says cleared and the money is not there.
5. **The old way still counts at once.** *Record payment* on the same bill takes a check and marks it paid: two rules, and a check counted twice.
6. **Quiet where it must not be.** If a held bill drops out of everything, the lien's own clocks drop out with it.

The second draw answers each.
The door is the bank's row, on the Dashboard, for any check.
The bank's posting counts it, with no second press.
Every screen says *the bank expects it* and acts on the fact, never the date.
The bill's own payment press knows the check is held.
Lien days stay in view beside the bank's day.

## The screens of the second draw

1. **The Dashboard, the day it is deposited.** *A check is at the bank*, with its amount, number, payer and the bank's day, and what it fits: *4 bills at one place, to the cent, behind 3 filed liens*. The press reads **Hold it for these 4 bills**. *It is for something else ›* opens the hold with nothing placed. *See the check ›* opens the bank's image.
2. **The hold.** The check's facts as values the bank wrote, none typed. The bills it may be for, liened ones first, each with *Open* and *Holds*, and three totals: the check, held for bills, left.
3. **While it waits.** The Bill tab, Bills sent, the Pipeline row and Payoffs each carry the same chip. *Record payment* on a held bill says the check is held, with *Count it now…* for a leader and a reason. Payoffs offers no release press.
4. **The bank answers.** Posted: *Check 1184 cleared. It is counted on 4 bills. 3 liens are paid and still on record.* Late: *The bank expected it Wed, Dec 2. It is still pending.* Could not read it: *It is back in the drawer. Deposit it again.* Sent back: *Check 1184 came back: insufficient funds. It was never counted, so nothing has to be undone.*
5. **The liens.** Payoffs reads *Paid Dec 2 by check 1184. The release is owed.* with **Make the release ›**, only after the bank posts.

## What each screen says while a check is held

| The screen | Today, once a check is typed | With a held check |
|---|---|---|
| The job's Bill tab | *Paid* | The bill stays open with the chip. **Record payment** says the check is held for this bill. |
| Pipeline | The job moves to *Paid in Full*. | The job stays in Billed with the chip. No reminder is due. |
| Bills sent | *Paid*, with the day typed. | *Check at the bank*. The day's paid totals leave it out until the bank posts it. |
| Chasing and statements | Stop, for good. | Stop for the held bills only, and start again if the check comes back. |
| The customer's page | *You're all paid up* | The bill stays listed, with *We have your check. It is clearing.* The pay page says the same. |
| The sub's page | *Customer paid* | Nothing, until the bank posts it. |
| Paid in full emails | Sent. | Sent the day the bank posts it. |
| The Stripe invoice | Closes seven days after the day typed. | Stays open while held. Closes seven days after the bank posts. |
| The lien lists | The job leaves them. | The job stays, with the chip. No lien day is hidden. |
| Payoffs and the release tab | Offer the release, with an amber line. | Offer nothing until the bank posts it. A leader, a controller or a dev may release sooner with a typed reason. |

## What must never happen

| The mistake | The guard |
|---|---|
| A lien is released on a check the bank has not made good | The release reads the bank's fact. It is offered only when the paying deposit has posted. A check typed the old way, with no deposit, waits its seven days as now. |
| One check is counted twice | A held bill refuses a second check payment and says which check holds it. A held deposit is not offered to other bills in Accounts Receivable. |
| A payer is chased for money the office holds a check for | One rule, *this bill has a check held for it*, read by the chase list, the statements and the reminders. |
| A lien day is missed because a check came in | A hold never takes a job off a lien list and never holds a lien paper by itself. The desk shows the lien's day beside the bank's day. |
| A hold that never ends | A check in the drawer asks for its deposit after three days. A check past the bank's day reads *late* until the bank posts or fails it. |
| A check comes back and nobody notices | The hold ends itself. The Dashboard says so in red, the card's badge turns red, the bills chase again, and the liens read on record. |
| A check the bank could not read is treated as a bad check | The app tells the two apart by the bank's reason. An unread check goes back in the drawer with its hold. No fee, no mark on the payer. |
| It was held for the wrong bills | **Let it go** ends a hold any time before the bank posts. After that, a payment moves as it does today. |
| The bank posts it, then takes it back | The returned-check case that exists today takes the payments off. The case names any release made on that check. |

## The build, in order

| # | The piece | Size | Kernel and tests | Migration | What proves it |
|---|---|---|---|---|---|
| 1 | **No release before the bank.** Payoffs and the release tab hold while the paying check has not cleared. The Lien desk's check pane refuses a check that is still pending at the bank. A leader's *Release it anyway* keeps its typed reason. | S | Built, v2.8525. The gates read one rule, `checkCleared.ts`: the paying deposit has posted and the bank's named day has come. A posted deposit with no named day waits seven days from its posting. A check with no deposit waits seven days from the typed day. The deposit is found by Accounts Receivable's link, else by the check's number. | None | Kernel and render tests, and a read-only look at a real check at the bank. No walk with a real write. |
| 2 | **The bank's own day.** The app reads the day the bank expects a pending check, and its check number. Money in shows that day in place of its guess. | S | `bankCheckFacts` beside the bank kernel. Tests on a pending, a posted and a failed row. | None | Kernel tests, the line on the Dashboard |
| 3 | **The held check.** The Dashboard's *A check is at the bank* with what it fits, the hold with its lines, *Let it go*, the count when the bank posts, the three Dashboard lines, and Payoffs' waiting step. | M | `heldCheck.ts`: what a check fits, the states, the lines, what each screen says. The count is a database function with a bed. | One table for a held check and its lines, with the four fence calls, and the function that counts it when the bank's row posts | Kernel tests, a database bed, a walk on ZZ test jobs with a made-up bank row |
| 4 | **Billing says so.** The badge on the Pipeline card, in its dates, with the count on the section's head. The chip on the Bill tab and Bills sent. Chasing and statements skip a held bill. **Record payment** steers a check to a hold. | M | One rule, `billHeldCheck`, read by each screen. Tests beside each reader. | None | Render tests on each screen |
| 5 | **The customer's page and the pay page** say the check is held. | S | The page's kernel gains the line. | None | The owner's look at the words |
| 6 | **A check in the drawer.** A paper check not yet deposited is held by hand and takes its bank row when the deposit appears. A check the bank could not read falls back here. | S | `heldCheck.ts` pairs a drawer check with a pending row, as Money in does. | None | Kernel tests |
| 7 | **When it comes back after it was counted.** The card's *Check clearing* badge in Paid in Full. On a return, the Collections mark comes back, a sub told *Customer paid* is told otherwise, and the case names any release made on the check. | M | The returned-check kernel gains the three. Tests beside it. | A small one, to put the Collections mark back when the payments come off | Kernel tests, a played-back return on a ZZ test job |

Piece 1 is the safety fix for #435 as built, where Payoffs, the release tab and the check pane only warned while a check cleared.
It is built, v2.8525.
It also reads the bank's day and the check number, the kernel half of piece 2, and gives Payoffs its waiting step and a line that says a check for a place is at the bank.
As built, anyone who can open the release tab may release early with a typed reason.
Call 4's answer of 2026-11-25 holds that to a leader, a controller or a dev, and that mend is not built.
Pieces 2 and 3 are the plan itself.
Pieces 4 to 7 follow in any order.

### How the count works

The office chose the bills when it made the hold, so the bank's posting needs no second choice.
The bank's row changes to posted through the webhook or the sync, and a trigger on `mercury_transactions` already opens a returned-check case on such a change.
The count hangs on the same change: it writes one payment a held line, dated the day the bank posted and tied to the deposit, as Accounts Receivable's own apply does.
A line that no longer fits, because its bill changed or was paid another way, is left held with its reason, and the rest are counted.
A Stripe bill paid whole by check is a ledger row, and Stripe closes it seven days after that day, as today.

## The calls

**For the company's owner**

1. What does cleared mean? Answered 2026-11-24 by Diane: the bank's day. The bank does two things on two days. It posts a check within a day or three, and it names a later day, about a week out. A check has cleared when the bank posted it and the bank's day has come, as piece 1 is built. The answer set aside was the day the bank posts it, about a week sooner, with a caution for the days after.
2. Does the count need a press? Pick: no. The office chose the bills on day one. The bank's posting counts the check, and the Dashboard says it did. **Answered 2026-11-25:** *The bank's posting. No press.* Call 1 still names the day.
3. Every check, or only where a lien waits? Pick: every check. One rule is easier to keep than two. A leader keeps *Count it now* with a reason, for a cashier's check or a payer who is always good. **Answered 2026-11-25:** *Every check.*
4. Who may release before the bank clears it? Pick: a leader only, with a typed reason. As built in piece 1, anyone who can open the release tab may, with a typed reason. **Answered 2026-11-25, in the user's own words:** *"A leader, a controller, or a dev"*. That is neither of the two options the card offered, and it overturns the card's pick of a leader only.
5. What does the payer's page say? Pick: *We have your check. It is clearing.* **Answered 2026-11-25:** *"We have your check. It is clearing."*
6. A payer whose check came back before. Pick: their next check still counts when the bank posts it. The release waits the six days after, unless a leader releases sooner with a reason. **Answered 2026-11-25:** *Six more days before a release, unless released with a reason.*

Calls 2 to 6 were answered on 2026-11-25 (UTC) in the managing session.
Each answer above is quoted from that session's record of the user's answers.

Two questions the answers leave open, both put to the managing session and neither decided here:

- **Who presses the other early presses.** Call 4 names a leader, a controller or a dev for a release before the bank clears a check. The card gives *Count it now* (call 3) and the sooner release for a payer whose check came back (call 6) to a leader, and the answer to call 6 names nobody. Do those two go to the same three? The same is asked of **The bank confirmed the funds** on [#435](../lien-payoff/README.md).
- **Which of the bank's two days a counted check is shown on.** Call 1 counts a check on the bank's named day, about a week after the bank posts it. Call 1 of [#440](../one-day-of-money-two-screens.md) was answered the same day: *The day the bank posts it, the same rule as #437.* Once a check is counted, does By day paid show it on the day the bank posted it, where Money in shows the deposit, or on the named day? *How the count works* above dates the payment the day the bank posted, and was written before call 1 was answered.

**For the office**

1. Where should the line appear first? Pick: Needs you on the Dashboard, and on the deposit's row in Money in.
2. What if a check fits two sets of bills? Pick: the line names both and opens the hold with nothing placed.
3. Who is told when it clears? Pick: every office seat, with the liens to release in the same line.

**For counsel** (questions only)

1. The release is due ten days after a written request. What if the bank has not posted the check by then?
2. May the release wait a further week after the bank posts, for a payer whose check has come back before?
3. May the payer be told in writing that the release follows once the check clears?

## Where it plugs in

- The bank's row: `mercury_transactions`, `supabase/functions/_shared/mercuryTransaction.ts`, the failed rule in `supabase/functions/_shared/bankReturnedDeposits.ts`.
- Clearing today: `src/lib/jobs/checkClearing.ts`, `src/lib/jobs/heldStripeMark.ts`, `supabase/functions/close-held-stripe-marks/index.ts`.
- The Dashboard: `src/lib/dashboardNeedsYou.ts`, `src/lib/moneyInWeek.ts`, `src/lib/moneyInWeekLoad.ts`, `src/components/DashboardMoneyInStrip.tsx`.
- Accounts Receivable: `src/components/jobs/BankPaymentsModal.tsx`, `apply_mercury_bank_payment_allocations`.
- The bill's own press: `src/components/jobs/BilledPaymentConfirmationModal.tsx`, `mark_invoice_paid`.
- Chasing and the pages: `src/lib/jobs/paymentChase.ts`, `supabase/functions/customer-portal/index.ts`, `supabase/functions/_shared/payLink.ts`, `supabase/functions/_shared/subPortalCustomerPaid.ts`.
- Bills sent: `src/lib/billing/billsPaid.ts`.
- The Pipeline card's dates: `src/lib/jobs/billedDatesLedger.ts`.
- The Lien desk's Payoffs, release tab and check pane: [#435](../lien-payoff/README.md).

## How to verify

Every walk runs on ZZ test jobs.
A made-up pending bank row is played into the page for the Dashboard line and the hold, as the returned-check walks did.
The count is proved in a database bed: a held check with three lines, the bank row set to posted, three payments read back, one line changed first and read back as left held.
Then a failed row before posting, read back as a hold ended with no payment made.
