---
name: "Bills and estimates in a message: /bill, /estimate and their fills"
number: 127
group: gated
status: DRAFTED 2026-10-19 — the ask, what the box reaches today, the papers in the / list, the {amount} and {estimate} fills, three ways to share an estimate's link, and the plan beside this file for the owner's pick; nothing built
summary: >
  The office should be able to drop a customer's own bill or estimate into a text in a press or two. Today the
  reply box knows one paper: {bill}, the newest Stripe bill's pay page, and only in a job's box. {amount} is never
  filled there, and an estimate's link cannot be had at all once the email is out, because only its hash is kept.
  This to-do draws /bill and /estimate listing that customer's actual papers in the / list (#126), each pick putting
  in a line about that paper, and the {amount} and a new {estimate} blank filling on their own.
next: The owner reads the mock-up and picks the estimate link's way, the words a paper puts in and where paid bills and drafts go.
size: S (the papers read and the fills) + S (the papers in the / list) + M (a second estimate link, if picked)
blocker: The owner's pick, above all the estimate link's way.
opinion: build the papers in the / list and the fills, and give an estimate a second link for texts so the emailed one keeps working
mockup: to-dos/bills-and-estimates-in-a-message/mockup.html
---

# Bills and estimates in a message (#127)

## The ask, in the owner's words

> I'm looking at screenshots like this and I think we should make it super easy to pull in the customers' estimates
> and bills.

(The screenshot: the reply box with `/pay` typed, the bill line filled with its pay page, and the reminder line
showing `{amount}` in amber.) Then: *Draw /bill and /estimate listing the customer's papers, and the {amount} and
{estimate} fills, as a to-do with mock-ups for my pick.*

## What the box reaches today

- **`{bill}`** (v2.5628): the pay page of the job's **newest** bill billed through Stripe (`billing/billLink.ts`,
  `billLinkIo.ts`). Only a job's box reads it (`JobCustomerBox`): the job window and the Pipeline's sheet. A thread on
  the Messages page has no one job and leaves it empty. A customer with two open bills gets the newer one, always.
- **`{amount}` and `{link}`** are never filled in the reply box: `replyFills` (`quickReplies/filling.ts`) takes the
  first name, yours, the job's name and the bill's link, nothing else. That is the amber `{amount}` in the screenshot.
  Tell the customer fills `{amount}` for an estimate (`tellFills`), and nothing else does.
- **Attach** (`AttachPicker`) lists the job's files (plans, the scope, the contract, pay applications, change orders,
  the schedule), their portal's pages and a file from this computer. No bill and no estimate is on it.
- **The bills are already read well elsewhere.** Follow up's *They owe us* (`followUp/theyOweUs.ts`, R8 · 6) gives
  each customer's open bills: what is still open after payments (`computeBillTruth`, the AR page's own rule), the pay
  page, the bill's number, the job, the day it was billed and whether it is late. Its `reminderLine` already fills
  `{amount}` and a pay link for the Paid reminder. The papers below read through it, not around it.
- **Estimates** (`estimates`): number, title, `total_cents`, `status` (draft, sent, customer_accepted, declined,
  superseded), `sent_at`, `customer_id`, `job_ledger_id`. **Its link cannot be read back.** The table keeps only
  `public_token_hash`; **Resend link** mints a new token, which retires the emailed link, and emails the customer again
  (`_shared/estimateLinkResend.ts`). So `{estimate}` needs a decision, below.

## The design

### 1. `/bill` and `/estimate` list the customer's papers

In the `/` list (#126), a few words also call that person's papers, under the lines:

- **bill**, **bills**, **invoice**, **pay**, **owe** → *Dana's bills*: each open bill first, newest first, then the
  paid ones. A row reads *#1042 · Helotes re-pipe · $1,840.00 open · billed Oct 12 · 6 days late*.
- **estimate**, **estimates**, **quote**, **price** → *Dana's estimates*: sent and not yet answered first, then
  approved ones. A row reads *Estimate 1044 · Kitchen re-pipe · $3,200.00 · sent Oct 14, not approved yet*.

In a job's box the job's own papers come first, then the customer's other jobs'. In a thread on the Messages page
every job of theirs counts. A line whose shortcut is the word (`/bill`, #126 C) still leads the list; the papers
follow it.

**A pick puts in a line about that paper.** The team's own line for it when there is one (the most used line that
holds `{bill}`, or `{estimate}`), filled for the paper picked; else the app's words:

| Paper | The app's words |
|---|---|
| An open bill | {first}, here is your bill {number} for {job}. {amount} is open. You can pay it here: {bill} |
| A paid bill | {first}, here is a copy of your paid bill {number} for {job}: {bill} |
| A sent estimate | {first}, here is your estimate {number} for {job}, {amount}. Open it to choose the option you want: {estimate} |

A pick counts as the line's press when it is the team's line. Nothing sends until **Send**.

### 2. The fills

- **`{amount}`**: what is open on the bill the line is about. In a job's box with no pick, the job's newest open bill;
  after a pick, the picked paper's (an estimate's total). Filled from They owe us, so it agrees with the AR page.
- **`{bill}`**: as today, the newest bill's pay page in a job's box, and the picked bill's after a pick; now also in a
  thread, from the person's newest open bill on any job.
- **`{estimate}`** (new): the link to the newest sent estimate, or the picked one. How that link is made is the owner's
  call, next.

### 3. The estimate's link: three ways

- **A. Resend's link.** Picking an estimate mints a new token, as **Resend link** does. The customer's emailed link
  stops working, and a customer who opens the old email lands on *not found*. Cheapest, but it breaks a link they have.
- **B. A second link for the message** (recommended). Each share makes its own token, kept hashed in a new table beside
  the estimate's (`estimate_share_links`: the estimate, the hash, who made it and when, when it ends). The accept page
  (`get-estimate-for-customer`) opens the estimate from either hash. The emailed link keeps working, and the history
  says who shared it and when. A link made but never sent just ends on its day.
- **C. Their customer page.** `{estimate}` links to the customer's portal, and the portal gains an Estimates card. No
  token per estimate, but one more page to build, and the link opens on the portal rather than the estimate.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The papers read | `followUp/theyOweUs.ts` (open bills, amount left, pay page), its query layer; `billing/billLinkIo.ts` | `messages/papersIo.ts`: a person's bills (open and paid) and estimates (sent and approved) across their jobs; a kernel `messages/papers.ts` for the order and the words |
| The `/` list | `quickReplies/slash.ts` (`slashLines`), `reply/SlashList.tsx` | the paper words, a papers group under the lines, a paper row |
| The fills | `quickReplies/filling.ts` (`replyFills`), `blanks.ts` (`BLANK_CHIPS`) | `amount` and `estimate` in `replyFills`; `{estimate}` a blank the editor offers |
| The box | `reply/ReplyBox.tsx`, `JobCustomerBox` (reads `{bill}` once per job) | the papers read once per person, as the lines are |
| B's link | `send-estimate-to-customer`, `get-estimate-for-customer`, `_shared/estimateLinkResend.ts` | one migration (the table, its fences, an RPC that makes a link), the accept function's second lookup, its redeploy |

## The plan

1. **The papers read and the fills** (S): `papers.ts` with tests, `papersIo.ts`, `{amount}` and the wider `{bill}` in
   `replyFills`. No migration.
2. **The papers in the `/` list** (S): the paper words, the group, a pick's line, a smoke. The guide *reply to a person
   from their thread* gains **Put in a bill or an estimate**.
3. **The estimate's link** (M, the owner's pick): for B, a migration (`estimate_share_links`, the read-only and twin
   fences, `share_estimate_link(estimate_id)` returning a URL once), `get-estimate-for-customer` reading either hash,
   and its deploy; `{estimate}` fills from it. For A, `{estimate}` calls Resend's path with a warning in the box. For C,
   the portal's Estimates card first.

## How to verify

- PR 1: on the dev server, a job's box with a reminder line shows `{amount}` as the open amount the AR page shows for
  that bill; a customer with two open bills fills the newer.
- PR 2: `/bill` in a thread of a customer with bills on two jobs lists both jobs' bills, open first; a pick fills the
  box with that bill's number, amount and pay page; nothing sends.
- PR 3 (B): a shared estimate link opens the estimate; the emailed link still opens it; a share's link that is past its
  day says so.

## The owner's calls

1. **The estimate's link**: A, B (the recommendation) or C.
2. **The words a paper puts in**: the three lines above, or the team's own.
3. **Paid bills**: offered as a copy (drawn), or left out.
4. **Draft estimates**: left out until sent (drawn), or offered with a note.
5. **The words that call papers**: bill, invoice, pay, owe and estimate, quote, price, or fewer.
