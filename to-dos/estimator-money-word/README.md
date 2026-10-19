---
name: "The estimator's word on money"
number: 129
group: ready
status: PLANNED 2026-10-19 — the flow traced, the mock-up drawn and re-drawn once; PR 1 (the job's people) starts now on the owner's word
summary: >
  On a job an estimator bid, the estimator often talks to the owner more than anyone, so they
  are the one who hears "the check goes out the 25th" or "I paid it Tuesday", and today they
  phone the assistant to have it marked. The estimator reads no job row, so no job window, no
  Pipeline, no bill, no promise chip and no Job activity; the Messages thread they already have
  can write down a heard day, and the day never reaches the job. This to-do gives the job's
  people, the office, the job's account manager and the bid's estimator, the job's money and
  one press for the customer's word on paying: a day, or that they say they paid. Paid stays
  the bank's word; the claim meets the deposit when it lands.
next: PR 1, the job's people and the gates; then the money line with Send the pay page and the door on the won bid's row.
size: S (the people) + M (the line and the door) + M (their word and the bridge) + S (the office side) + M (the lens, the card, the trail) + XS (primary)
blocker: none
opinion: the scope is the job's, not the role's; one sheet for both kinds of word; the paid claim does work for the office at allocation and makes none in Needs you
mockup: to-dos/estimator-money-word/mockup.html
---

# The estimator's word on money (#129)

## Where it stands

Drawn 2026-10-19 after a trace of the flow (below), re-drawn once on the question *is this the
best we can do* (the mock-up's last box records what moved). The owner said *we may build it right
now*; PR 1 starts from this to-do.

## The ask, in the owner's words

> Sometimes on a job that was bid by an estimator, the estimator is in better communication with
> the owners than the people doing the job, as such sometimes the estimator is keeping up with
> when the customer is paying, when they are going to pay, and they have to tell the assistant
> these things to mark it. I would like to figure out how the flow works and the best way to offer
> the estimator the tools to mark when jobs are paid and are going to pay.

And then: *this makes me think we should expose the text and calling tools to the estimators as
well as the assistants, so an estimator can see communication with the client.*

## What the trace found

**The estimator stands on no job.** `jobs_ledger`'s read policy is the office (dev, master,
assistant, controller) and primary; an estimator reads zero rows, by design
(`20260914280000_estimator_job_accounts.sql`). So no `/jobs`, no `/accounts-receivable`, money
hidden on Customers, and the read-only Job Detail pane the role is routed to does a plain
`jobs_ledger` select and loads nothing. The only door into a job is the Bid Board's job-accounts
strip (`list_bid_job_account_strip`, v2.3451), a SECURITY DEFINER read that names the newest job
on each bid.

**The money verbs were built for people who have a job.** The promise (`add_job_payment_promise`,
the Pipeline's *They said* sheet with the day, who said it and how) is gated by
`can_write_payment_promises()`: dev, assistant, master, controller. `can_read_payment_promises()`
adds primary. `mark_job_paid`, `mark_invoice_paid` and the bank allocation admit the same roles
plus primary, on any job.

**A job attaches to a bid one way.** `jobs_ledger.bid_id → bids`; bids carry no job. It is set by
the New Job form opened from a won bid (`prefillBidId`), by `snapshot_job_budget_from_bid`, by the
`estimates_link_job_stamps_bid` trigger and by `auto_create_job_from_signed_estimate`. Nothing is
keyed on the estimator: no view, RPC or policy says *jobs whose bid I estimated*. The job opened
from a bid copies neither `bids.estimator_id` nor `bids.account_manager_id`, so a primary who
estimated the bid loses the job under `primary_scope`, which runs on
`jobs_ledger.account_manager_user_id`.

**The estimator already has the conversation.** Estimators are on `gc_office_team()`, so they
have `/messages`, the thread with every text, email and Quo-recorded call, the reply box, take and
hand, mark owed, and Follow up's slot that writes down a heard day (`write_down`, kind
*payment*). The day lands in `message_promises` and stops: the bridge to the job
(`messages/promiseWrites.ts`) is a kernel nothing imports, GC projects only, money team only.

**Two things found on the way.** `estimator_can_reach_job_account(job)` checks that the job has
a bid, not that the bid is theirs. `list_job_payment_promises()` takes no job and returns every
live promise company-wide to any primary; and primary's paid verbs are not scoped to their jobs
while the Stages promise chip hides from them.

## The job's people

The scope is the job's, not the role's. The app already has the field that means *whose customer
this is*: `jobs_ledger.account_manager_user_id`, the one `primary_scope` runs on. One predicate:

> **`is_job_people(job)`** — the office, the job's account manager, and the bid's estimator or
> account manager (`bids.estimator_id`, `bids.account_manager_id` through `jobs_ledger.bid_id`).

It gates the promise read and write, the money strip, the trail, and later primary's paid verbs.
Opening a job from a bid copies the bid's estimator in as the job's account manager (the account
manager when the bid has one), so from then on the field says what it means and the office changes
it on the job when it wants the customer back. No policy on `jobs_ledger` changes: the estimator
still reads no row, and reads the money through one scoped RPC, as the job-accounts strip does.

## The word, one record

**Write down their word** is one press and one sheet, the Pipeline's own `SetPromisedPayDateModal`
with a switch at the top:

- **They'll pay by…** — the promise as today: the day, who said it, how. `heard_by` is the
  estimator. The board's chip, Job activity's *They said*, the pay-speed record, red when broken.
- **They say they paid…** — the same record, a `paid_claim` kind: how they say they paid (check
  in the mail, paid online, bank transfer, card by phone, not sure), the day they name, the amount
  (all of it unless typed), who said it, a note. The job stays Billed.

Both are `job_payment_promises` rows, so both show as *They said* in the trail, both void with
*Never said that*, and the Pipeline's row reads either as its chip. The Messages slot gains the
*They say they paid* reading beside the day, and the bridge lands both on the customer's open
billed job under the bill-payer rule, the job named in the thread first; two open jobs ask which.
Most of the estimator's words arrive in the thread; the Bid Board's press is for what was heard in
person.

## The office side

The claim does work for the office and makes none. A `paid_claim` is useful at one moment, when
the deposit lands: the Accounts Receivable bank-deposit allocation names the job whose live claim
fits the amount and the payer (*Theo wrote Oct 21: Dana says she paid, check #1187 in the mail
Oct 20*), so the press that allocates is one, and the word then reads *kept*. A check that comes
to the office goes through the Bill pane's Record payment as today, with the claim shown under the
amount. Nothing reaches Needs you for the office. A claim with nothing landed behind it after
seven days turns amber on the row, where the office leaves it alone, and comes back to the person
who heard it, as a Needs you line and the money line's amber: *Text Dana*, *Write down their
word*, *Never said that*.

## The line, the door, the lens

Under a won bid on the Bid Board, for the job's people: the job's number and stage, the bill day
and what is still open after the payment rule (the AR page's bill truth), the latest live word with
who said it, how and who heard it, and the payer's record from the pay-speed kernel (*keeps 3 of
4 · slips ~6 d*). One read per page, `list_bid_money_strip(p_bid_ids)` beside the job-accounts
strip. Its presses: **Send the pay page** (the customer's door with the job's box and the `{bill}`
line lit, so the papers read works for these jobs), **Write down their word**, and past their word
**Text Dana**. The won bid's row gets the customer's speech bubble the Pipeline row has (Call ·
Text · Email · Open their thread, who wrote last, the waiting dot), and a **Trail** press opens
Job activity read-only for the job's people: the bill, the sends, every *They said* and the
conversation on one timeline.

**Money on my bids**, beside Job accounts: every job born of my bids with money open, past their
word first, then no word, then waiting, then they-say-paid. With *Only my bids* off the office
reads who is talking to whom. The Dashboard's Needs you gets the card.

## The plan

| PR | What | Server |
|---|---|---|
| 1 · the job's people | `is_job_people(job)`; the promise read and write gates on it; `list_job_payment_promises(p_job_id)` scoped, the company-wide read retired; the job opened from a bid copies the account manager; `estimator_can_reach_job_account` uses it | one migration + SQL bed |
| 2 · the line + the door | `list_bid_money_strip`; the money line, read-only, with Send the pay page; the customer's door on the won bid's row | one migration |
| 3 · their word | the bridge from the Messages slot to the job, a day or they say they paid; the one sheet from the line; the `paid_claim` kind with its method | one migration |
| 4 · the office side | the allocation suggestion in AR; the stale claim back to the estimator; the amber on the row | none |
| 5 · the lens, the card, the trail | Money on my bids; the Dashboard card; read-only Job activity for the job's people | none |
| 6 · primary | primary's paid verbs narrowed to the job's people, the same predicate | one migration |

## How to verify

- PR 1: the SQL bed seeds an estimator on a bid with a job, an office user, a primary who is the
  job's account manager, and a stranger; `is_job_people` answers true, true, true, false;
  `add_job_payment_promise` by the estimator writes with `heard_by` them and the stranger's
  refuses in words; `list_job_payment_promises(job)` returns the row to the three and nothing to
  the fourth; a job opened from a bid carries the estimator as its account manager.
- PR 2: signed in as an estimator on prod (the dev-login recipe), the won bid's row shows the line
  with the bill truth the AR page shows for that job and no other job's; a bid of another
  estimator shows no line unless the person is office.
- PR 3: a day written from the thread shows on the Pipeline row's chip and in Job activity with
  the estimator as who heard it; *Never said that* on the Pipeline voids it.
- PR 4: a Mercury deposit of the claim's amount offers the claim's job first in the allocation;
  seven days with none, the estimator's Needs you carries the line.

## The owner's calls

- **Jobs from an estimate with no bid.** Should the estimate's author count among the job's
  people when the job is made from a signed estimate (`estimates.created_by`, copied by
  `auto_create_job_from_signed_estimate`)? The opinion is yes; it widens the rule to
  residential jobs the estimator wrote the estimate for.
- **Becoming the account manager on open.** A primary who bids as estimator already gets the job
  this way; for an estimator it is new. The office changes the account manager on the job when it
  wants the customer back, a control that exists today.
- **The stale day.** Seven days is the mock-up's number; a mailed check is usually in by then.
