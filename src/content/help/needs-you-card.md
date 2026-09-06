---
title: work the Needs you list on the dashboard
category: Getting Started
roles: all
keywords: needs you, notifications, banners, deposits, purchases, tally, lost bids, walk the list, dashboard, approvals, dispatch requests, snooze, dismiss, quickfill
order: 13
---
The **Needs you** card near the top of the Dashboard collects the things waiting on a decision from you — money received but not applied, purchases with no job, approvals that have sat too long, jobs quiet too long for their stage, paperwork gaps, the Wednesday GC review while it's still owed — with a count in the header and one button per item. When nothing needs you, the card disappears entirely. **Quickfill** shows the same card, from the same numbers.

The list is ordered **worst first**: red alerts on top, then money waiting to be applied, then the weekly GC deadline, then the work queues with the biggest pile first, and hygiene items last. Walk the list follows the same order, so walking from the top always tackles the worst thing next.

## Two ways to work it

- **Cards** shows everything at once — each row carries its number on the right and its action on the far right, like {{button:blue|Match deposits}} or {{button:outline|Start call mode}}.
- **Walk the list** takes you through one item at a time, call-mode style: a big card with the action front and center, {{button:outline|Skip for now}} to come back later, and a progress bar showing where you are. Skipping past the end loops back to the first item.

Switch between them with the **Cards / Walk the list** toggle at the card's bottom-right — the app remembers your choice.

:::example a Needs you item
**Allocate 2 bank deposits** — 2 Mercury transactions still have balance to apply {{button:blue|Match deposits}}
:::

## What can show up, and where its button goes

Each item's button drops you exactly where the work happens. What you see depends on your role — the office (owner, assistant, controller) gets the company list; estimators get the bid items; a few are for devs only. Anyone with a company card can get the purchases item.

**Money**

- **Allocate N bank deposits** — {{button:blue|Match deposits}} opens the Accounts Receivable deposit matcher *right over the card*; when you close it, the count refreshes. Nothing to navigate back from.
- **N purchases need a job** — {{button:outline|Open tally}} → **Job Parts Tally**. The card counts purchases more than two days old; the Tally page header shows both numbers ("105 unlinked · 100 over 2 days old — the Dashboard card's count") so the two never look like a disagreement.
- **Team purchases waiting to be sorted** — opens the sort-for-the-team window.
- **N bank-label suggestions have waited 3+ days for an OK** — {{button:outline|Open approvals}} → **Banking → Accounting**, where **Approve all** clears the backlog. Shows only once the oldest suggestion is 3 days old; if the office has switched on *rule matches approve themselves*, only the true exceptions come back here.
- **N GCs are waiting on your statement** — {{button:outline|Start round}} starts the statement round on the Jobs board.
- **GC review is due today / still due this week** — {{button:outline|Open GC Review}}. Once every GC is certified and sent on Wednesday, the item is replaced by a green *done for the week* note.

**Time and people**

- **N clock sessions are waiting on approval** — {{button:outline|Open approvals}} → **People → Hours** approvals queue: every pending session across all weeks, grouped by person and week. Appears once the oldest unapproved session is 3+ days old — unapproved time is missing from payroll, the Hours grid and the Overhead numbers until someone works the queue. See [clear the hours approvals backlog](?g=clear-the-hours-approvals-backlog).
- **N dispatch requests have waited 3+ days** — {{button:outline|Open Dispatch inbox}} scrolls to the Teams Inbox card (or opens Dispatch Mode's inbox). Amber at 3 days, red once the oldest passes a week; the inbox itself lists open requests oldest first with the same age chips.
- **Team reviews due** — {{button:outline|Open Hiring → Review}} opens the Rate deck on the first person due.
- **N HR reports are waiting** *(dev only)* — {{button:outline|Open pending reports}} → **People → HR**, oldest first; the same 3-day / 7-day amber-red scale.

**Jobs and paperwork**

- **N live jobs have no contract on file** — {{button:outline|Start the sweep}} on the Pipeline board; **N contracts have been out for signature a week** — {{button:outline|See them}}.
- **N sub work orders are waiting for a price** — {{button:outline|Price them}} → Jobs → Work orders, drafts.
- **N open jobs have sat idle N+ days** — {{button:outline|See them}} → Job Summary's cycle view.
- **N jobs are waiting on a follow-up** — {{button:outline|Start review}} starts the follow-up review on the Jobs board.
- **Lien windows** — a notice or filing window closing soon, a filed lien not yet served, or a demand deadline: each opens the job(s) on the Pipeline board. A cleared payment behind a conditional release — {{button:outline|Issue releases}} — opens the **cleared releases list** right over the card, issuing the unconditional version from the row (see [give a customer a lien release](?g=give-a-customer-a-lien-release)).

**Bids** *(estimators and devs)*

- **N lost bids have no reason recorded · all trades** — {{button:outline|Start call mode}} on the Why we lost lens. The card counts every trade and says so on its number; the lens opens on one trade at a time and names it the same way ("59 need a reason · Plumbing").
- **N robot bids are waiting on your audit** — {{button:outline|Open Audits}}; **N fixture names have no Division 22 code** — {{button:outline|Pin codes}} opens the audit, which folds spellings the same way the card counts them.

**Dev only**

- **Roadmap tasks with nobody's name on them** — {{button:outline|Open Plan}} → the Roadmap page's Plan view. Roadmap items sit in their own group *after* the company list, so a planning gap never outranks a customer's money.
- **Bulk deletions detected** — {{button:outline|Review deletions}} → Settings → Recently deleted.
- **Someone tried to become a dev** — {{button:outline|Review accounts}} → Settings → Advanced, at the admin-code form.

## The number on the card is the number on the page

Every item's count is read by the same code as the page it opens — or the page repeats the card's figure in the card's words (like the Tally header above). If a card says 12 and the page says 12, that is by design, not luck; if they ever differ, tell a dev — the click is recorded with both numbers so it can be traced.

## Snooze and Dismiss

Work queues clear themselves when the work is done. The red **alert** items (bulk deletions, admin-code attempts) don't — an alert never knows you've dealt with it — so they carry small **Snooze 24h** / **Dismiss** links. Dismissing hides the alert until the count goes up (or it happens again). Both are remembered **on this device only**: dismiss an alert on your desk computer and it still shows on your phone.

## Where the card lives

The Dashboard is where the office lands on sign-in — owner, assistant and controller alike — so the card is the first thing you see (estimators land on Bids, and their items show there under the same name). Quickfill carries the same card for people who work from that page.
