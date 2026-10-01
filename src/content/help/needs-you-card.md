---
title: work the Needs you list on the dashboard
category: Getting Started
roles: all
keywords: needs you, notifications, banners, deposits, returned check, bounced check, purchases, tally, lost bids, walk the list, dashboard, approvals, dispatch requests, snooze, dismiss, quickfill
order: 13
---
The Needs you card sits near the top of the Dashboard. It collects the things waiting on a decision from you.

Those things are money received but not applied, and purchases with no job. They are approvals that have sat too long, and jobs quiet too long for their stage. They are paperwork gaps, and the Wednesday GC review while it is still owed. GC means the general contractor. The card's header shows a count. Each item carries one button. When nothing needs you, the card disappears entirely. **Quickfill** shows the same card, from the same numbers.

The list is ordered **worst first**. Red alerts sit on top. Money waiting to be applied comes next, then the weekly GC deadline. The work queues follow, with the biggest pile first. Hygiene items come last. Walk the list follows the same order. So walking from the top always tackles the worst thing next.

## Two ways to work it

- **Cards** shows everything at once. Each row carries its number on the right. Its action sits on the far right, like {{button:blue|Match deposits}} or {{button:outline|Start call mode}}.
- **Walk the list** takes you through one item at a time, call-mode style. You see a big card with the action front and center. You press {{button:outline|Skip for now}} to come back later. A progress bar shows where you are. A skipped item goes to the back of the round. It comes back later and is never gone. Once you have skipped everything, the round starts over from the top. Under the card, **Handled this visit** lists what you acted on or skipped since you opened the page. You tap one to bring its card back. An item your work cleared shows a ✓.

You switch between them with the **Cards / Walk the list** toggle at the card's bottom-right. The app remembers your choice. On a phone, an office login that has never picked opens on **Walk the list**. Office logins are assistant, controller, primary and estimator. The first pick you make is the one it keeps.

:::example a Needs you item
**Allocate 2 bank deposits** — 2 Mercury transactions still have balance to apply {{button:blue|Match deposits}}
:::

## What can show up, and where its button goes

Each item's button drops you exactly where the work happens. What you see depends on your role. The office gets the company list. The office is the owner, the assistant and the controller. Estimators get the bid items. A few are for devs only. Anyone with a company card can get the purchases item.

**Money**

- **Allocate N bank deposits**. {{button:blue|Match deposits}} opens the Accounts Receivable deposit matcher right over the card. When you close it, the count refreshes. There is nothing to navigate back from.
- ***A deposit the bank returned is still counted as paid ($13,680)***. This is a check matched to a job and then bounced. The card names the job, the amount and the bank's reason. {{button:outline|Open J878}} opens the job on ③ Payments received. There the row wears *Returned by the bank*. **Unlink and remove** takes it off the job and marks the deposit returned. See [match bank deposits to the bills they pay](?g=match-bank-deposits-to-bills). The item is amber because the job reads paid everywhere until then.
- **N purchases need a job**. {{button:outline|Open tally}} opens **Job Parts Tally**. The card counts purchases more than two days old. The Tally page header shows both numbers. It reads *105 unlinked · 100 over 2 days old — the Dashboard card's count*. So the two never look like a disagreement.
- **Team purchases waiting to be sorted** opens the sort-for-the-team window.
- **N bank-label suggestions have waited 3+ days for an OK**. {{button:outline|Open approvals}} opens **Banking → Accounting**. There **Approve all** clears the backlog. The item shows only once the oldest suggestion is 3 days old. The office may have switched on *rule matches approve themselves*. Then only the true exceptions come back here.
- **N GCs are waiting on your statement**. {{button:outline|Start round}} opens GC Review on the week's list. There every GC is grouped by its account man.
- **GC review is due today / still due this week**. {{button:outline|Open GC Review}} opens it. Once every GC is certified and sent on Wednesday, the item is replaced by a green *done for the week* note.

**Time and people**

- **N clock sessions are waiting on approval**. {{button:outline|Open approvals}} opens the **People → Hours** approvals queue. That is every pending session across all weeks, grouped by person and week. The item appears once the oldest unapproved session is 3+ days old. Unapproved time is missing from payroll, the Hours grid and the Overhead numbers until someone works the queue. See [clear the hours approvals backlog](?g=clear-the-hours-approvals-backlog).
- **N dispatch requests have waited 3+ days**. {{button:outline|Open Dispatch inbox}} scrolls to the Teams Inbox card. In Dispatch Mode it opens that mode's inbox. The item is amber at 3 days. It turns red once the oldest passes a week. The inbox itself lists open requests oldest first, with the same age chips.
- **Team reviews due**. {{button:outline|Open Hiring → Review}} opens the Rate deck on the first person due.
- **N HR reports are waiting**. Only devs see this one. {{button:outline|Open pending reports}} opens **People → HR**, oldest first. It uses the same 3-day amber and 7-day red scale.

**Jobs and paperwork**

- **N live jobs have no contract on file** opens with {{button:outline|Start the sweep}} on the Pipeline board. **N contracts have been out for signature a week** opens with {{button:outline|See them}}.
- **N sub work orders are waiting for a price**. {{button:outline|Price them}} opens Jobs → Work orders, on the drafts.
- **N open jobs have sat idle N+ days**. {{button:outline|See them}} opens Job Summary's cycle view.
- **Field capacity has run under 60% three weeks running**. {{button:outline|Open Capacity}} opens Job Summary's Capacity view. The card names the three complete weeks. It gives each week's utilization, the share of available hours that was worked. It reads like *48% · 52% · 41% for the weeks of Aug 24, Aug 31 and Sep 7*. It also gives the field hours clocked against the roster's available hours. The current week never counts until it is over.
- **N jobs are waiting on a follow-up**. {{button:outline|Start review}} starts the follow-up review on the Jobs board.
- **Lien windows**. A lien is a legal claim on the property for unpaid work. The item may be a notice or filing window closing soon. It may be a filed lien not yet served, or a demand deadline. Each opens the job or jobs on the Pipeline board. A cleared payment behind a conditional release gets {{button:outline|Issue releases}}. That opens the **cleared releases list** right over the card. You issue the unconditional version from the row. See [give a customer a lien release](?g=give-a-customer-a-lien-release).

**Bids**

Estimators and devs see these.

- ***N lost bids have no reason recorded · all trades***. {{button:outline|Start call mode}} opens call mode on the Why we lost lens. The card counts every trade and says so on its number. The lens opens on one trade at a time and names it the same way. It reads *59 need a reason · Plumbing*.
- **N robot bids are waiting on your audit**. {{button:outline|Open Audits}} opens them. **N fixture names have no Division 22 code**. {{button:outline|Pin codes}} opens the audit. The audit folds spellings the same way the card counts them.

**Dev only**

- **Roadmap tasks with nobody's name on them**. {{button:outline|Open Plan}} opens the Roadmap page's Plan view. Roadmap items sit in their own group after the company list. So a planning gap never outranks a customer's money.
- **Bulk deletions detected**. {{button:outline|Review deletions}} opens Settings → Recently deleted.
- **Someone tried to become a dev**. {{button:outline|Review accounts}} opens Settings → Advanced, at the admin-code form.

## The number on the card is the number on the page

Every item's count is read by the same code as the page it opens. Or the page repeats the card's figure in the card's words, like the Tally header above. If a card says 12 and the page says 12, that is by design, not luck. If they ever differ, tell a dev. The click is recorded with both numbers so it can be traced.

## Snooze and Dismiss

Work queues clear themselves when the work is done. The red **alert** items do not. Those are bulk deletions and admin-code attempts. An alert never knows you have dealt with it. So they carry small **Snooze 24h** and **Dismiss** links. Dismissing hides the alert until the count goes up, or until it happens again. Both are remembered **on this device only**. Dismiss an alert on your desk computer and it still shows on your phone.

## Where the card lives

The Dashboard is where the office lands on sign-in. That is the owner, the assistant and the controller alike. So the card is the first thing you see. Estimators land on Bids, and their items show there under the same name. Quickfill carries the same card for people who work from that page.

## Submittals

Four cards each open the bid's Submittals tab. A submittal is the product paperwork you send the GC to approve.

- **Won 5 days, no submittal started**. The GC usually asks in the first week. You build Rev 1, the first revision, from the picks. After 45 days the card lets the job go.
- **Shared N days, nobody has opened it**. The card names who never opened their link. You ask the GC to nudge them, or you send the link again.
- **N rows sent back, no resubmit**. The reviewer marked Revise or Reject. *Rev N+1 from the rows sent back* is one tap.
- **A lead time runs past its stage window**. Ordered today, the product lands after the job's earliest stage window ends. You order now, pick a product in stock, or move the window.

The won bid's Job block on the Bid Board carries the same fact. It shows a chip: {{chip:blue|Rev 2 · shared · waiting on Dana W.}}.
