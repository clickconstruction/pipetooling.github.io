---
name: "One place for work paid in kind: each arrangement, what it has paid and what is left"
number: 301
group: close
status: built 2026-11-10 in eight PRs and walked on prod with ZZ Test rows; the landlord's arrangement set up and November 2026 entered the same day · left: the readers that still read these bills as late, and the owner's four small calls; the chip beside a customer's name is built on the Customers list, the customer's page, a job and Bill Customer (v2.6845, v2.6848), with the receivables readers left
summary: >
  In kind became a kind of payment in v2.6816: a credit given instead of money pays a bill down without
  ever counting as cash. The first arrangement is a customer who is also our landlord: $22,643.46 of
  finished work paid off by $1,000 a month held back from the rent. Today that arrangement lives only as
  fourteen payment rows on fifteen bills and a memo on each. Nothing in the app says "this customer pays in
  kind, this much is left, this month's credit is due", and the open remainder reads as an ordinary
  receivable. Since v2.6827 to v2.6836 a customer's page holds the deal, its ledger of lines and the month
  that is due, and the In kind page lists every one. This card holds what is left.
next: The sweep of the readers under Left. December 2026's credit comes from its Needs you line.
size: L as a train of five (S · M · S · S · M); left: the sweep of the other readers (M)
ver: v2.6827 · 6829 · 6831 · 6834 · 6836 · 6841 · 6845 · 6848
blocker: none
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

### Mock-up 2: the chip beside a customer's name

[`in-kind-arrangements-chip-mockup.html`](in-kind-arrangements-chip-mockup.html), drawn 2026-11-10 with made-up names. The owner, once the first arrangement was live: *where in the app should a user be able to see the in kind balance due or credit for a customer, such as next to a customer's name?* It draws one chip with three things to say (on schedule with what is to come, a month due, they gave first) and where it goes: the Customers list with its total split, the customer's page, a job and the Bill window, then *Who owes what*. It leaves the chip off what the customer sees, the crew's screens, search and Messages. The owner said *Yes, build it* on 2026-11-10, with the five calls as drawn. Built: the chip and one shared read (v2.6845), the Customers list with its total split and its *In kind* filter, the customer's page, the job window's chip and strip, and Bill Customer's question (v2.6848). A job already on the deal skips the question and records in kind. Left from this mock-up: frame E, *Who owes what* and the other receivables readers, which is the sweep under Left.

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

## What shipped (2026-11-10)

1. **v2.6827, the tables and the verbs.** `in_kind_arrangements`, `in_kind_lines`, `in_kind_line_payments`, `jobs_ledger.in_kind_arrangement_id`, and `in_kind_line_add` (one transaction, a dry run, a Stripe bill passed over and named), `in_kind_line_remove`, `in_kind_line_set_cost`, `in_kind_arrangement_set_jobs`.
2. **v2.6829, the card, the ledger and Add a line.** On the customer's page, for the office. The money strip reads *scheduled in kind, none late*.
3. **v2.6831, the month's credit and the Needs you line.** The bank read, the month's window with the suggested credit, *No credit this month*, the due line, `in-kind-credit-due`.
4. **v2.6834, not chased, not forecast, not in pay speed.** The chase queue, the payment forecast, the Billed row's dates block, and a `pay_speed_exclusions` row for every In kind payment.
5. **v2.6836, the cost side and the list.** Overhead or a job's material, and the page **In kind** reached from Accounts Receivable.

## Left

- **Nothing on the first arrangement.** It was set up on 2026-11-10 through *Set up paying in kind*, and November 2026's credit of $1,000 was entered the same day through *Enter it early* (v2.6841), ahead of the bank. If the rent paid in November turns out different, take that line back and enter the month again. The customer's one job that was off the deal was put on it and its bill recorded in kind the same day, on the owner's word.
- **Readers that still read these bills as open and aged**: the Dashboard's receivables card, *Who owes what*, the Bridge's Collect pile, the Pipeline's 30/90-day chips. Each has its own row list and select. (The Customers list's open balance is split since v2.6845.)
- **The money emails, closed in v2.6931 (2026-11-11).** The emailed Payment forecast counted a deal's bill as money coming, and Money waiting listed the customer as slow over it, on the Pay speeds window and in its email. Both leave such a bill out now and count it in one line. Still open beside them: the Pay speeds window's **By customer** list colours a deal's bill late, and the **Billed awaiting payment** report email (`billed-report-email`) ages it into its 30 to 90 and 90+ chips.
- **The residential reminder flow** (`messages-nudge-dispatch`, `residentialLoad`) still reads an in-kind bill's expected day from pay history. A hold on the contact stops a reminder today.
- **Cost readers that do not see in-kind lines**: the Bridge's profit grid and People Review. And the lines are the office's to read, so a primary or a superintendent sees a job's cost without them.
- **A combine of two jobs** carries no line across (`migrate_job_ledger_costs_and_delete` does not name the tables).
- **Bill Customer with two open arrangements, closed in v2.6934 (2026-11-11).** The question required exactly one open deal, so a customer with two got an ordinary money window. It asks now. *In kind* holds every press and opens the customer's page, where a person puts the job on a deal, and *With money* bills as usual. No picker in the window: a wrong pick would put a bill on the wrong deal's ledger.
- **Not walked live**, covered by the database bed or unit tests only: a line on a bill row (the walk's ZZ jobs were billed with no bill row), a bill on Stripe passed over, the forecast's last line, the overhead pool's display.

## Where it plugs in

- The In kind kind and its words: `src/lib/jobs/inKindPayment.ts`, `supabase/functions/_shared/inKindPayment.ts` (v2.6816).
- What in kind is never counted as: `src/lib/moneyInWeek.ts`; never listed for deposits: `list_unlinked_payments_for_bank_payments` (migration `20261109180000`).
- The customer's money: `src/lib/customers/customerInvoiceRows.ts` (`lifetimeCollected` from `src/lib/billing/billTruth.ts`); pay speed: `src/lib/jobs/billedExpectedPay.ts`.
- Collections and the chase: `src/lib/bridge/collect/collectBills.ts`; guide `chase-late-payments`.
- The rent leaving the bank: the Mercury feed the Banking tabs already read.
- Help: `src/content/help/record-payments-so-they-count.md` already teaches the month-at-a-time credit.

## How it was verified

Walked on prod on 2026-11-10 from a dev server against a customer named *ZZ Test In Kind 2026-11-10* with three ZZ Test jobs, all deleted afterwards: set up, a $350.00 line that paid one job off and put $50.00 on the next in one press, a line counted on a job (that job's Costs tab), the Pipeline's Billed row reading *Scheduled in kind*, monthly terms, the bank read, the Needs you line, October's window, the list page, a line moved to overhead and a line taken back. The walk found three things, fixed before the PRs went up: *Still to come* counted a job not billed yet, the failure words read badly, and the page needed a search door. `npm run test:pg:in-kind` holds the database side.

## The live case

The landlord customer's record is the live case: fifteen bills, fourteen In kind payments, $14,643.46 open as of 2026-11-09, and November 2026's credit of $1,000 entered on 2026-11-10 through *Enter it early*. The mock-up uses made-up names and amounts.
