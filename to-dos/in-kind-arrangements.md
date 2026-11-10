---
name: "One place for work paid in kind: each arrangement, what it has paid and what is left"
number: 301
group: gated
status: mock-up drawn 2026-11-10 · the owner picked the card on the customer and the Needs you line first, the list second · nothing built · the first arrangement is already recorded in the app
summary: >
  In kind became a kind of payment in v2.6816: a credit given instead of money pays a bill down without
  ever counting as cash. The first arrangement is a customer who is also our landlord: $22,643.46 of
  finished work paid off by $1,000 a month held back from the rent. Today that arrangement lives only as
  fourteen payment rows on fifteen bills and a memo on each. Nothing in the app says "this customer pays in
  kind, this much is left, this month's credit is due", and the open remainder reads as an ordinary
  receivable. This card holds the ask and that first ledger until the owner wants the page.
next: the owner's answers to the calls still open (the mock-up lists them), then the word to start PR 1
size: L as a train of four (S · M · S · M)
blocker: the owner's calls still open, and the word to start
opinion: build the arrangement as a thing the app knows (a row with its terms), shown on the customer page with a Needs you line when a month is due; the list comes second; suggest each month's credit with one press and do not enter it by itself
---

# One place for work paid in kind (#301)

Parked 2026-11-09. Diane, after the landlord's credits went in: *where in the app could that fourteen thousand dollars of in kind payments be shown? Perhaps we should make an in kind page?* Then: *I don't want to make it in kind page right now, but I would like to add this as a punch list item for this exact reason the notes of the ledger with [the landlord]. So this could be the first entry.*

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

## The mock-up

[`in-kind-arrangements-mockup.html`](in-kind-arrangements-mockup.html), drawn 2026-11-10 with made-up names and amounts. Frames A to H: today's reading, the card on the customer's page, the ledger for one partner, a month's credit in one press, the Needs you line, a one time trade for gravel, the list, and the smallest alternative. It ends with a second look and the owner's calls.

The owner widened the ask the same day: *sometimes we trade with others for gravel or other things and I still need to enter each month's credit*. So the design holds two cases. One is a standing arrangement with a credit each month. The other is a one time trade for goods.

## Decided 2026-11-10

**Where it lives: the card on the customer's page and a line on Needs you first, the list second.** November's credit was missed because nobody was told, and a page only helps a person who already remembered. The ledger window and the entry window are the same from every door.

## The calls still the owner's

1. **The monthly credit.** Suggested with one press, as frame D draws it, or entered by itself when exactly the usual rent leaves the bank. The session that drew the mock-up would start with the press: a payment to the landlord is not always rent, and a month with no rent is only known when it ends.
2. **When the reminder speaks.** The day the rent leaves the bank and the last day of a month with no rent, or a fixed day each month.
3. **What a trade for goods must record.** Who, what, the worth and the bill are the floor. Open: whether the ticket photo is required, and whether the goods must be placed on a job, the yard or the company before it saves.
4. **Whether the worth counts as a cost.** Gravel placed on a job would raise that job's material cost. The credited half of the rent would show as overhead. Both change profit numbers the owner reads today.
5. **A partner who gave first.** Whether goods taken before any work is done is a real case. If not, every arrangement starts from a bill.
6. **Who may see and enter.** The people who can record a payment today, or the owner only.
7. **The words.** The page is called In kind and each row an arrangement, since trade already means plumbing or electrical in the app.

## The shape

1. **The arrangement as a row (S).** A table for an in-kind arrangement: the customer, what is given, how often (every month or one time), the amount a month, the start month, the bills it pays and their order, the name the rent goes out under at the bank, a note. A month marked *no credit* is a row too, so a month with full rent paid never reads as forgotten. A migration with the repo's four fences. Nothing on screen yet.
2. **The card, the ledger and the press (M).** On the customer page, *Pays in kind*: the terms in a sentence, credited so far, what is left, the last month, and the month that is due (frame B). The open bills read *scheduled in kind* instead of late; Accounts Receivable, the chase flow and the payment forecast treat them that way; the collected line says how much came in kind; pay speed leaves in-kind payments out. The ledger window shows each month whole with the bills it went to (frame C). One press records the month's credit across the oldest open bills with the memo filled, the amount read from the rent that left the bank (frame D).
3. **The Needs you line (S).** A line when a month has rent at the bank and no credit, or has ended with neither, naming every month behind (frame E).
4. **A one time trade and the list (M).** The window for goods given instead of money: who, what, the worth off their ticket, the bill it pays and where the goods went (frame F). Then every arrangement on one page with what is owed each way (frame G). `/accounts-receivable` has no tabs today, so the list is a page of its own with a door from there.

## Where it plugs in

- The In kind kind and its words: `src/lib/jobs/inKindPayment.ts`, `supabase/functions/_shared/inKindPayment.ts` (v2.6816).
- What in kind is never counted as: `src/lib/moneyInWeek.ts`; never listed for deposits: `list_unlinked_payments_for_bank_payments` (migration `20261109180000`).
- The customer's money: `src/lib/customers/customerInvoiceRows.ts` (`lifetimeCollected` from `src/lib/billing/billTruth.ts`); pay speed: `src/lib/jobs/billedExpectedPay.ts`.
- Collections and the chase: `src/lib/bridge/collect/collectBills.ts`; guide `chase-late-payments`.
- The rent leaving the bank: the Mercury feed the Banking tabs already read.
- Help: `src/content/help/record-payments-so-they-count.md` already teaches the month-at-a-time credit.

## How to verify

The landlord customer's record is the live case: fifteen bills, fourteen In kind payments, $14,643.46 open as of 2026-11-09, and November 2026's credit not entered as of 2026-11-10. The mock-up uses made-up names and amounts.
