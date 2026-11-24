---
name: "A held check: recorded the day it comes, counted the day the bank makes it good"
number: 437
group: gated
status: asked 2026-11-24 by Diane, with a payer's check deposited and not yet good at the bank · every place a typed check counts was read in the code, and everything the app knows about a check clearing · a first draw, a critique and a second draw the same day · nothing is built · waiting on the owner's five calls
summary: >
  A paper check typed on a bill counts everywhere the moment it is saved: the bill reads Paid, the
  customer's page says all paid up, chasing stops, the job leaves the lien lists. Only three things
  wait for the bank. The owner wants a check recorded the day it arrives, counted only when it
  clears, and no lien released before then. The bank's own row already holds the check, its number
  and the day the bank expects it. The card proposes a held check: the Dashboard says a check is at
  the bank and what it fits, one press holds it for those bills, nothing counts while it is held,
  and the bank's posting counts it and tells the office which liens to release.
next: The owner answers the five calls. Piece 1, no release before the bank, waits on nothing and can be built first.
size: L as a train of six (S · S · M · M · S · S)
blocker: The owner's calls, the first two above all. Counsel's three questions gate nothing in the build.
opinion: build — one rule for every check, made from what the bank already tells the app; piece 1 closes a hole in #435 as built
---

# A held check: recorded the day it comes, counted the day the bank makes it good (#437)

The plan and its mock-up are [`mockup.html`](./mockup.html), served at `/to-dos/held-check/mockup.html`.
The second draw can be pressed: five stops, and three things the bank can do.
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
3. **The bank's answer does the rest.** When the bank posts it, the app counts it and tells the office which liens to release. When the bank fails it, nothing has to be undone.

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

- **The bank's row.** `mercury_transactions` holds a deposited check as `pending`, with the check number and the day the bank expects it in `raw` (`checkNumber`, `estimatedDeliveryDate`), and images of the check. No code reads that day.
- **Posted deposits only.** Accounts Receivable lists a deposit once `posted_at` is set, and can then split it over bills and jobs, Stripe bills among them (`BankPaymentsModal.tsx`).
- **A failed deposit.** The bank marks a check `failed` with its reason. Of the failed check deposits the returned-check work counted, most never posted and the rest came back within six days of posting (`bankReturnedDeposits.ts`).
- **Money in.** The Dashboard already draws *In the drawer* and *At the bank*, with a guessed posting day.
- **Their word.** A paid claim, *They say they paid*, never marks a job paid and pairs with the deposit when it lands (`paidClaims.ts`).

## Four words for a check

| The word | What is true | What the app does |
|---|---|---|
| In the drawer | The office has the paper. It is not deposited. | Holds it for its bills. Asks for the deposit after three days. |
| At the bank | It is deposited. The bank shows it as pending and names the day it expects it. | Holds it for its bills. Shows the bank's day. Counts nothing. |
| Cleared | The bank posted it. | Counts it on its bills that day. Tells the office what to release. |
| Came back | The bank failed it, before or after posting. | Ends the hold. The bills chase again. After posting, the returned-check case takes over. |

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
4. **The bank answers.** Posted: *Check 1184 cleared. It is counted on 4 bills. 3 liens are paid and still on record.* Late: *The bank expected it Wed, Dec 2. It is still pending.* Failed: *It was never counted, so nothing has to be undone.*
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
| Payoffs and the release tab | Offer the release, with an amber line. | Offer nothing until the bank posts it. A leader may release sooner with a typed reason. |

## What must never happen

| The mistake | The guard |
|---|---|
| A lien is released on a check the bank has not made good | The release reads the bank's fact. It is offered only when the paying deposit has posted. A check typed the old way, with no deposit, waits its seven days as now. |
| One check is counted twice | A held bill refuses a second check payment and says which check holds it. A held deposit is not offered to other bills in Accounts Receivable. |
| A payer is chased for money the office holds a check for | One rule, *this bill has a check held for it*, read by the chase list, the statements and the reminders. |
| A lien day is missed because a check came in | A hold never takes a job off a lien list and never holds a lien paper by itself. The desk shows the lien's day beside the bank's day. |
| A hold that never ends | A check in the drawer asks for its deposit after three days. A check past the bank's day reads *late* until the bank posts or fails it. |
| The bank fails it and nobody notices | The hold ends itself. The Dashboard says so in red, the bills chase again, and the liens read on record. |
| It was held for the wrong bills | **Let it go** ends a hold any time before the bank posts. After that, a payment moves as it does today. |
| The bank posts it, then takes it back | The returned-check case that exists today takes the payments off. The case names any release made on that check. |

## The build, in order

| # | The piece | Size | Kernel and tests | Migration | What proves it |
|---|---|---|---|---|---|
| 1 | **No release before the bank.** Payoffs and the release tab hold while the paying check has not cleared. The Lien desk's check pane refuses a check that is still pending at the bank. A leader's *Release it anyway* keeps its typed reason. | S | The two gates read one new rule, `checkCleared`: the linked deposit has posted, else the typed day plus seven. Tests for each. | None | Kernel and render tests |
| 2 | **The bank's own day.** The app reads the day the bank expects a pending check, and its check number. Money in shows that day in place of its guess. | S | `bankCheckFacts` beside the bank kernel. Tests on a pending, a posted and a failed row. | None | Kernel tests, the line on the Dashboard |
| 3 | **The held check.** The Dashboard's *A check is at the bank* with what it fits, the hold with its lines, *Let it go*, the count when the bank posts, the three Dashboard lines, and Payoffs' waiting step. | M | `heldCheck.ts`: what a check fits, the states, the lines, what each screen says. The count is a database function with a bed. | One table for a held check and its lines, with the four fence calls, and the function that counts it when the bank's row posts | Kernel tests, a database bed, a walk on ZZ test jobs with a made-up bank row |
| 4 | **Billing says so.** The chip on the Bill tab, the Pipeline row and Bills sent. Chasing and statements skip a held bill. **Record payment** steers a check to a hold. | M | One rule, `billHeldCheck`, read by each screen. Tests beside each reader. | None | Render tests on each screen |
| 5 | **The customer's page and the pay page** say the check is held. | S | The page's kernel gains the line. | None | The owner's look at the words |
| 6 | **A check in the drawer.** A paper check not yet deposited is held by hand and takes its bank row when the deposit appears. | S | `heldCheck.ts` pairs a drawer check with a pending row, as Money in does. | None | Kernel tests |

Piece 1 is the safety fix for #435 as built, where Payoffs, the release tab and the check pane only warn while a check clears.
It can land before anything else.
Pieces 2 and 3 are the plan itself.
Pieces 4 to 6 follow in any order.

### How the count works

The office chose the bills when it made the hold, so the bank's posting needs no second choice.
The bank's row changes to posted through the webhook or the sync, and a trigger on `mercury_transactions` already opens a returned-check case on such a change.
The count hangs on the same change: it writes one payment a held line, dated the day the bank posted and tied to the deposit, as Accounts Receivable's own apply does.
A line that no longer fits, because its bill changed or was paid another way, is left held with its reason, and the rest are counted.
A Stripe bill paid whole by check is a ledger row, and Stripe closes it seven days after that day, as today.

## The calls

**For the company's owner**

1. What does cleared mean? Pick: the day the bank posts it. Most failed checks fail before that. The rest came back within six days after, so the release tab carries a caution for those days and does not block.
2. Does the count need a press? Pick: no. The office chose the bills on day one. The bank's posting counts the check, and the Dashboard says it did.
3. Every check, or only where a lien waits? Pick: every check. One rule is easier to keep than two. A leader keeps *Count it now* with a reason, for a cashier's check or a payer who is always good.
4. Who may release before the bank posts? Pick: a leader only, with a typed reason.
5. What does the payer's page say? Pick: *We have your check. It is clearing.*

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
- The Lien desk's Payoffs, release tab and check pane: [#435](../lien-payoff/README.md).

## How to verify

Every walk runs on ZZ test jobs.
A made-up pending bank row is played into the page for the Dashboard line and the hold, as the returned-check walks did.
The count is proved in a database bed: a held check with three lines, the bank row set to posted, three payments read back, one line changed first and read back as left held.
Then a failed row before posting, read back as a hold ended with no payment made.
