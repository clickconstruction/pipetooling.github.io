---
name: "One day of money, two screens: Money in and By day paid from one rule"
number: 440
group: gated
status: found 2026-11-24 on the live test of Bills sent (#422) · the first shared piece, the bank deposits on no bill, built the same day in v2.8493, with a mend for old months in its own PR · nothing else built · four owner calls open
summary: >
  The Dashboard's Money in bar and Bills sent's By day paid both answer what came in on a day, and
  they can still give two figures for one day. Each is right by its own rule, and neither says how
  it differs from the other. Since v2.8493 they share one rule for bank deposits, and By day paid
  names a deposit that is on no bill yet. Four differences are left: the day a check counts on, a
  payment whose check came back, test rows, and the day a week starts. The card lists each one and
  the call it needs, then proposes one rule for a day's money that both screens draw from.
next: The owner answers the four calls. Piece 1 needs no call and can be built first.
size: L as a train of four (S · S · M · M)
blocker: The owner's four calls. Call 1 is the same question as punch list #437, a held check.
opinion: build piece 1 now, since it needs no call; hold pieces 2 to 4 for the calls
---

# One day of money, two screens (#440)

This card follows [#422, Bills sent: who paid](./bills-sent-who-paid/README.md). The live test of that page on 2026-11-24 set one Monday beside the Dashboard's Money in bar. Money in showed seven payments and By day paid showed five. Both were right. Nothing on either screen said why.

## What each screen counts today

| | Money in (Dashboard) | By day paid (Bills sent) |
|---|---|---|
| Reads | payments, bank deposits, open bills, claims | the payment rows on jobs |
| Shows | this week and last week's leftovers | any month |
| A day's figure | what landed in the bank or in Stripe | what payments took off their bills |
| Week starts | Monday | Sunday |

## Where a day can still differ

| # | The case | Money in | By day paid | State |
|---|---|---|---|---|
| 0 | A bank deposit on no bill yet | Counts it the day it posts, *Landed · not applied yet* | Names it under the day, never adds it | Built, v2.8493. One rule, `src/lib/moneyInDeposits.ts` |
| 1 | A check typed in, not yet at the bank | *In the drawer*, on no day. It lands the day a deposit of the same amount posts | Counts it on the day the person named | Open. Call 1 |
| 2 | A payment whose check came back | Never counted as landed while the return case is open | Counted until someone takes it off the job | Open. Call 2 |
| 3 | A payment on a test bill or a ZZ test job | Counted | Left out (`billTestRows.ts`) | Open. No call needed |
| 4 | A Sunday payment | In the week that ends that day | In the week that starts that day | Open. Call 3 |
| 5 | A payment matched to a deposit after it was typed in | On the day the deposit posted | On the day the payment row names | Not checked. The two days are the same when Accounts Receivable made the payment. Read the rows before building |

A Stripe payment, a bank transfer typed by hand and a credit in kind already agree.

## The four calls

1. **Which day does a check count on?** The day it was typed in, or the day the bank posts it. Diane's rule of 2026-11-24 for a held check (#437) is that a check counts when the bank posts it. If that rule holds here, By day paid moves a typed-in check to its deposit's day and shows it apart until then, as Money in's drawer does.
2. **Does a payment whose check came back leave a day's figure?** Suggested: By day paid keeps the line, marks it *Came back*, and takes it out of the figure while the return case is open.
3. **One day for the week to start?** Money in's week runs Monday to Sunday. By day paid's **This week** tile starts on Sunday. Suggested: leave both, since each matches the screen around it, and keep the sentence in the guide that says so.
4. **Should Money in name what By day paid leaves out, the way By day paid now names deposits?** Suggested: no. Once the cases above are closed there is nothing left to name.

## The pieces

| # | What | Size | Waits on |
|---|---|---|---|
| 1 | Test rows out of Money in, by the rule By day paid reads (`isBillsTestRow`). A kernel test that feeds both screens one test payment | S | Nothing |
| 2 | A payment on an open return case is marked in By day paid and left out of its figure, by Money in's own list of such payments (`returnedPaymentIdsOfCases`) | S | Call 2 |
| 3 | A typed-in check's day. By day paid reads the match Money in makes (`matchMoneyInDeposits`) and places or holds the check by call 1 | M | Call 1, and #437 |
| 4 | One pure rule for a day's money: every payment and deposit with the day it counts on and whether it is in the figure. Both screens draw from it, and one test holds their figures equal for a week | M | Pieces 1 to 3 |

## Is this the best we can do?

For the leader, yes: one day, one figure, on either screen. The cheaper end is to stop after pieces 1 and 2, once call 2 is answered, and say the rest in the guide, as the week's start is said today. That leaves call 1 open, and call 1 is the one a leader will meet, since a check is most of the money.

## What is known

- The deposit rule is shared and tested. With it broken on purpose, both screens' suites fail.
- On the live site on 2026-11-24 the two screens agreed for the week once the deposits were counted: Money in's *Landed · not applied yet* chips and By day paid's lines named the same deposits.
- By day paid is to name only deposits Accounts Receivable lists, so a month from before that list's start date has no such line. That mend was in its own PR when this card was written.
