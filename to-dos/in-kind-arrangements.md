---
name: "One place for work paid in kind: each arrangement, what it has paid and what is left"
number: 301
group: gated
status: parked 2026-11-09 by the owner, not to build now · nothing designed · the first arrangement is already recorded in the app
summary: >
  In kind became a kind of payment in v2.6816: a credit given instead of money pays a bill down without
  ever counting as cash. The first arrangement is a customer who is also our landlord: $22,643.46 of
  finished work paid off by $1,000 a month held back from the rent. Today that arrangement lives only as
  fourteen payment rows on fifteen bills and a memo on each. Nothing in the app says "this customer pays in
  kind, this much is left, this month's credit is due", and the open remainder reads as an ordinary
  receivable. This card holds the ask and that first ledger until the owner wants the page.
next: the owner's word to start; then a mock-up of the arrangement's strip on the customer page and of the list, with made-up data
size: M as a train of three (S · M · S)
blocker: the owner parked it
opinion: build the arrangement as a thing the app knows (a row with its terms), shown on the customer page first; a page that lists every arrangement comes second, since there is one today
---

# One place for work paid in kind (#301)

Parked 2026-11-09. Diane, after the landlord's credits went in: *where in the app could that fourteen thousand dollars of in kind payments be shown? Perhaps we should make an in kind page?* Then: *I don't want to make it in kind page right now, but I would like to add this as a punch list item for this exact reason the notes of the ledger with Tom. So this could be the first entry.*

The repo and the `/to-dos/` pages are public, so this card names the customer only as *the landlord customer*. The ledger below is the real one; the customer's name, the two houses and the bank lines stay in the app and in the office's own notes.

## The first entry: the landlord's rent credit

The landlord owns the house we rent and two houses we did improvement work on. The work came to **$22,643.46** across fifteen jobs, all done before 2026-04-01. Rent is **$2,000 a month**, paid from Mercury. From **April 2026** we pay $1,000 and the other $1,000 is a credit against the work, until the work is paid off. A month with no rent paid at all credits the whole $2,000. Two small payments to the landlord in 2026 were reimbursements, not rent, and count for nothing here.

| Rent month | Rent paid | Credited in kind | Credited so far | Left to credit |
|---|---|---|---|---|
| Apr 2026 | $0 | $2,000 | $2,000 | $20,643.46 |
| May 2026 | $1,000 | $1,000 | $3,000 | $19,643.46 |
| Jun 2026 | $1,000 | $1,000 | $4,000 | $18,643.46 |
| Jul 2026 | $1,000 | $1,000 | $5,000 | $17,643.46 |
| Aug 2026 | $0 | $2,000 | $7,000 | $15,643.46 |
| Sep 2026 | $1,000 | $1,000 | $8,000 | $14,643.46 |
| Oct 2026 | $2,000 | $0 | $8,000 | $14,643.46 |

November was not settled when this was written. At $1,000 a month the rest takes about fifteen more months.

**How it is recorded (2026-11-09).** Each of the fifteen jobs carries one line item and one bill, dated 2026-04-01 and recorded through Bill Customer's HouseCall Pro channel, the only channel that emails nobody. Each bill's note says it was never sent and is paid by rent credit. The credits are fourteen In kind payments, oldest job first, each with a memo like *Rent credit, April 2026: $726.50 of the $2,000 credit for that month*. Eight jobs are Paid. One job carries the running balance. Six are untouched. Each new month is one more In kind payment on the job still open.

## What is wrong with how it reads today

- **The remainder looks like money owed and late.** The $14,643.46 sits in Accounts Receivable, in Billed Awaiting Payment and on the customer page as an open balance on bills dated April. Nothing tells a reader it is scheduled, not overdue. The chase flow could queue it. Nothing has emailed the customer, because the bills went out on no channel that sends.
- **Pay speed reads 0 days.** Each credit is dated the day its bill is dated, so the customer's days-to-pay median is 0 over 14 samples. The number means nothing for an arrangement like this.
- **"Collected" reads $8,000.** The customer page counts in-kind payments as collected, as v2.6816 chose. The page does not say how much of that came in kind.
- **Nothing says the next credit is due.** Someone has to remember each month. The bank feed already shows the $1,000 rent payment leaving Mercury, so the app could notice it and propose the matching credit.
- **The agreement itself is nowhere.** The terms (who, how much a month, from when, against what total) live in people's heads and in the payment memos.

## The shape, if the owner picks it up

1. **The arrangement as a row (S).** A table for an in-kind arrangement: the customer, what is given (rent credit), the amount a month, the start month, the total it pays off, a note. A migration with the repo's four fences. Nothing on screen yet.
2. **Its strip on the customer page (M).** *Pays in kind: rent credit, $1,000 a month since April 2026. $8,000 of $22,643.46 credited, $14,643.46 left, about 15 months. Next credit: November.* The open bills under it read *scheduled in kind* instead of late; Accounts Receivable, the chase flow and the payment forecast treat them that way; pay speed leaves in-kind payments out. A press records this month's credit on the oldest open bill with the memo filled.
3. **The list (S).** Every arrangement in one place (a section of Billing, or its own page if there are several by then), with credited, left and the next month due. Optionally a Needs-you line when a month's rent left Mercury and no credit followed.

## Where it plugs in

- The In kind kind and its words: `src/lib/jobs/inKindPayment.ts`, `supabase/functions/_shared/inKindPayment.ts` (v2.6816).
- What in kind is never counted as: `src/lib/moneyInWeek.ts`; never listed for deposits: `list_unlinked_payments_for_bank_payments` (migration `20261109180000`).
- The customer's money: `src/lib/customers/customerInvoiceRows.ts` (`lifetimeCollected` from `src/lib/billing/billTruth.ts`); pay speed: `src/lib/jobs/billedExpectedPay.ts`.
- Collections and the chase: `src/lib/bridge/collect/collectBills.ts`; guide `chase-late-payments`.
- The rent leaving the bank: the Mercury feed the Banking tabs already read.
- Help: `src/content/help/record-payments-so-they-count.md` already teaches the month-at-a-time credit.

## How to verify

The landlord customer's record is the live case: fifteen bills, fourteen In kind payments, $14,643.46 open as of 2026-11-09. Any mock-up uses made-up names and amounts.
