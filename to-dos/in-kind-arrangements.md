---
name: "One place for work paid in kind: each arrangement, what it has paid and what is left"
number: 301
group: gated
status: mock-up drawn 2026-11-10 · the owner picked the card on the customer and the Needs you line first, the list second, and a ledger of lines entered as needed (amount, date, memo; overhead unless put on a job) · nothing built · the first arrangement is already recorded in the app
summary: >
  In kind became a kind of payment in v2.6816: a credit given instead of money pays a bill down without
  ever counting as cash. The first arrangement is a customer who is also our landlord: $22,643.46 of
  finished work paid off by $1,000 a month held back from the rent. Today that arrangement lives only as
  fourteen payment rows on fifteen bills and a memo on each. Nothing in the app says "this customer pays in
  kind, this much is left, this month's credit is due", and the open remainder reads as an ordinary
  receivable. This card holds the ask and that first ledger until the owner wants the page.
next: the owner's word to start PR 1; the four small calls still open can be answered along the way
size: L as a train of four (S · M · S · M)
blocker: the owner's word to start
opinion: build the arrangement as a thing the app knows (a row with its terms and its lines), shown on the customer page with a Needs you line when a month is due; the list comes second; nothing is entered by itself
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

[`in-kind-arrangements-mockup.html`](in-kind-arrangements-mockup.html), drawn 2026-11-10 with made-up names and amounts. Frames A to H: today's reading, the card on the customer's page, the ledger for one partner, a month's credit in one press, the Needs you line, a ledger of lines as things are delivered, the list, and the smallest alternative. It ends with a second look and the owner's calls.

The owner widened the ask the same day: *sometimes we trade with others for gravel or other things and I still need to enter each month's credit*. So the design holds two cases. One is a standing arrangement with a credit each month. The other is a partner who gives things as they come, such as concrete by the load.

## Decided 2026-11-10

**Where it lives: the card on the customer's page and a line on Needs you first, the list second.** November's credit was missed because nobody was told, and a page only helps a person who already remembered. The ledger window and the entry window are the same from every door.

**Entered as needed, never by itself.** The owner: *The monthly credit needs to be entered on an as-needed basis, some jobs don't have recurring things like that. It's someone delivers concrete and I need to list the days they deliver concrete and the amount.* So an arrangement is a ledger of lines, and a line is added the day something is given. Most arrangements have no schedule and no reminder. The rent credit keeps its monthly reminder and its suggested amount, which the owner liked as drawn, and still takes a person's press. That last sentence is the drawing session's reading of the two answers together.

**A line records the amount, the date and a memo of the details.** Nothing else must be filled: no ticket photo, no quantity box.

**A line counts as overhead, unless that line is put on a job.** The owner: *an individual gives us things and we record those as line items and sometimes they do need to apply to a job*. Put on a job, the line counts as that job's material.

## The calls still the owner's

1. **When the rent reminder speaks.** The day the rent leaves the bank and the last day of a month with no rent, or a fixed day each month.
2. **A partner who gave first.** Whether goods taken before any work is done is a real case (frame F6). If not, every arrangement starts from a bill.
3. **Who may see and enter.** The people who can record a payment today, or the owner only.
4. **The words.** The page is called In kind and each row an arrangement, since trade already means plumbing or electrical in the app.

## The shape

1. **The arrangement and its lines as rows (S).** A table for an in-kind arrangement: the customer, what is given, the bills it pays and their order, a note, and for a monthly one the amount a month, the start month and the name the rent goes out under at the bank. A table for its lines: the date, the amount, the memo, and overhead or the job it is put on. A month marked *no credit* is a line too, so a month with full rent paid never reads as forgotten. A migration with the repo's four fences. Nothing on screen yet.
2. **The card, the ledger and Add a line (M).** On the customer page, *Pays in kind*: the terms in a sentence, given so far, what is left, and for a monthly one the month that is due (frame B). The open bills read *scheduled in kind* instead of late; Accounts Receivable, the chase flow and the payment forecast treat them that way; the collected line says how much came in kind; pay speed leaves in-kind payments out. The ledger window shows each line with what it counts as and the bills it went to (frames C and F). *Add a line* takes the amount, the date and the memo, counts as overhead unless a job is picked, and writes today's In kind payments across the oldest open bills (frame F).
3. **The monthly press and the Needs you line (S).** For an arrangement with a monthly amount, one press records the month's credit with the amount read from the rent that left the bank (frame D). A Needs you line appears when a month has rent at the bank and no credit, or has ended with neither, naming every month behind (frame E).
4. **The cost side and the list (M).** A line's amount reaches the overhead numbers, or the job's material cost when it is put on a job. Then every arrangement on one page with what is owed each way (frame G). `/accounts-receivable` has no tabs today, so the list is a page of its own with a door from there.

## Where it plugs in

- The In kind kind and its words: `src/lib/jobs/inKindPayment.ts`, `supabase/functions/_shared/inKindPayment.ts` (v2.6816).
- What in kind is never counted as: `src/lib/moneyInWeek.ts`; never listed for deposits: `list_unlinked_payments_for_bank_payments` (migration `20261109180000`).
- The customer's money: `src/lib/customers/customerInvoiceRows.ts` (`lifetimeCollected` from `src/lib/billing/billTruth.ts`); pay speed: `src/lib/jobs/billedExpectedPay.ts`.
- Collections and the chase: `src/lib/bridge/collect/collectBills.ts`; guide `chase-late-payments`.
- The rent leaving the bank: the Mercury feed the Banking tabs already read.
- Help: `src/content/help/record-payments-so-they-count.md` already teaches the month-at-a-time credit.

## How to verify

The landlord customer's record is the live case: fifteen bills, fourteen In kind payments, $14,643.46 open as of 2026-11-09, and November 2026's credit not entered as of 2026-11-10. The mock-up uses made-up names and amounts.
