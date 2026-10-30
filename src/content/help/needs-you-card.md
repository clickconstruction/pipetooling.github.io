---
title: work the Needs you list on the dashboard
category: Getting Started
roles: all
keywords: needs you, fill them in, lost bids, vehicles missing a record, job accounts, contracts out for signature, bid follow-ups, gc projects, trade partner quotes, call again, notifications, banners, deposits, returned check, bounced check, purchases, tally, lost bids, walk the list, dashboard, approvals, dispatch requests, snooze, dismiss, quickfill, vehicles, insurance, registration, service
where: /dashboard
order: 13
---
The Needs you card sits near the top of the Dashboard. It collects the things waiting on a decision from you.

Those things are money received but not applied, and purchases with no job. They are approvals that have sat too long, and jobs quiet too long for their stage. They are paperwork gaps, and the Wednesday GC review while it is still owed. GC means the general contractor. The card's header shows a count. Each item carries one button. When nothing needs you, the card disappears entirely. **Quickfill** shows the same card, from the same numbers, with the same buttons. On Quickfill the clock sessions line opens the People Hours station on that page.

Every line says whose it is. Your lines come first. The rest sit folded under who presses them. A fold is named for that person. One reads **The office is on these**. Another reads **Waiting on the owner**. Press {{button:outline|Show}} to open a fold. The count on the card is your lines. Beside it the card says how many are for others.

Inside each group the list is ordered **worst first**. Red alerts sit on top. Money waiting to be applied comes next, then the weekly GC deadline. The work queues follow, with the biggest pile first. Hygiene items come last. Walk the list follows the same order. So walking from the top always tackles the worst thing next.

## Two ways to work it

- **Cards** shows everything at once. Each row carries its number on the right. Its action sits on the far right, like {{button:blue|Match deposits}} or {{button:outline|Start call mode}}.
- **Walk the list** takes you through one item at a time, call-mode style. It walks your lines first, then the folds. You see a big card with the action front and center. You press {{button:outline|Skip for now}} to come back later. A progress bar shows where you are. A skipped item goes to the back of the round. It comes back later and is never gone. Once you have skipped everything, the round starts over from the top. Under the card, **Handled this visit** lists what you acted on or skipped since you opened the page. You tap one to bring its card back. An item your work cleared shows a ✓.

- **Fill them in** is on Quickfill only. On Quickfill an assistant's station opens on these rows when there are any. The first row is on top with its fields. Your other lines sit under the rows with their buttons. Press {{button:outline|Cards}} to see the list instead. Press {{button:outline|Fill them in}} to bring the rows back. The owner and the controller still open on their own lines. It walks the rows behind a few lines one at a time. The rows are lost bids with no reason and vehicles missing a record. They are also jobs with no job account, contracts out a week, and live jobs with no contract on file. Your own card purchases with no job come first. The supply-house charges still in their move window are rows too. So are the sub work orders drafted without a price. Each card says what the app already knows. For a lost bid you tap a reason and add what they said. You can add who you talked to. With a name, the call lands on the bid's contact log too. For a vehicle you enter only the record that is missing. That is the insurance plan and cost, the registration cost, or the last service. For a job account you pick one of three answers. It is on our account there, we asked the house, or no account is needed. For a contract you resend the email, text the link, or file it signed on paper. A resend or a text leaves it on the list until it is signed. For a job with no contract on file you file the paper copy, or say why no contract is needed. To send one, press {{button:outline|Send it from the sweep}}. The sweep shows the agreement before it goes out. For a purchase you tap the job it was for. The card shows your jobs from the day you bought it. Tap two jobs to split it. Type an amount on one line and the other line adjusts. Type a job number or a street in **Another job** to find any other job. Save puts it on the job, the same as the tally does. For a charge in the move window you pick one of three answers. Moved means you called the house and it moved the charge. Ask the house by email sends the request to the rep. No job account needed takes the reason. Moved with no account on record also takes the house's reference. For a sub work order you type the subcontract amount. Tap **From the bid** to take the bid's sub-labor total. The send stays on the Work board. Then you press {{button:blue|Save and next}}. {{button:outline|Skip}} sends the row to the back. Press a line's {{button:outline|Fill them in}} and the deck keeps to that line's rows. Then it walks the rest. Saved rows collect under the card with **Undo**. The end counts what you saved. It offers the station's Mark.

You switch between them with the **Cards / Walk the list** toggle at the card's bottom-right. The app remembers your choice. On a phone, an office login that has never picked opens on **Walk the list**. Office logins are assistant, controller, primary and estimator. The first pick you make is the one it keeps.

:::example a Needs you item
**Allocate 2 bank deposits** — 2 Mercury transactions still have balance to apply {{button:blue|Match deposits}}
:::

## What can show up, and where its button goes

Each item's button drops you exactly where the work happens. What you see depends on your role. The office gets the company list. The office is the owner, the assistant and the controller. Estimators get the bid items. A few are for devs only. Anyone with a company card can get the purchases item.

**Money**

- **Allocate N bank deposits**. {{button:blue|Match deposits}} opens the Accounts Receivable deposit matcher right over the card. When you close it, the count refreshes. There is nothing to navigate back from.
- ***A deposit the bank returned is still counted as paid ($13,680)***. This is a check matched to a job and then bounced. The card names the job, the amount and the bank's reason. {{button:outline|Open J878}} opens the job on ③ Payments received. There the row wears *Returned by the bank*. **Unlink and remove** takes it off the job and marks the deposit returned. See [match bank deposits to the bills they pay](?g=match-bank-deposits-to-bills). The item is amber because the job reads paid everywhere until then. A check that came back with a case opens its case right over the card. The case sits on top of To match with its next step. With several, the window opens on the list of them.
- **N purchases need a job**. {{button:outline|Open tally}} opens **Job Parts Tally**. The card counts purchases more than two days old. The Tally page header shows both numbers. It reads *105 unlinked · 100 over 2 days old — the Dashboard card's count*. So the two never look like a disagreement.
- **Team purchases waiting to be sorted** opens the sort-for-the-team window. Its *Sorted* list is the way back to a purchase you already sorted. See [sort the team's card purchases from the office](/help/sort-the-teams-card-purchases).
- **N bank-label suggestions have waited 3+ days for an OK**. {{button:outline|Open approvals}} opens **Banking → Accounting**. There **Approve all** clears the backlog. The item shows only once the oldest suggestion is 3 days old. The office may have switched on *rule matches approve themselves*. Then only the true exceptions come back here.
- **N GCs are waiting on your statement**. {{button:outline|Start round}} opens GC Review on the week's list, right over the card. There every GC is grouped by its account man. The office's line reads **N GC statements are ready to send**. {{button:outline|Open the list}} opens the same window. Close it and the line re-reads.
- **GC review is due today / still due this week**. {{button:outline|Open GC Review}} opens it. Once every GC is certified and sent on Wednesday, the item is replaced by a green *done for the week* note.

**Time and people**

- **N clock sessions are waiting on approval**. {{button:outline|Open approvals}} opens the **People → Hours** approvals queue. That is every pending session across all weeks, grouped by person and week. The item appears once the oldest unapproved session is 3+ days old. Unapproved time is missing from payroll, the Hours grid and the Overhead numbers until someone works the queue. See [clear the hours approvals backlog](?g=clear-the-hours-approvals-backlog).
- **N dispatch requests have waited 3+ days**. {{button:outline|Open Dispatch inbox}} scrolls to the Teams Inbox card. In Dispatch Mode it opens that mode's inbox. The item is amber at 3 days. It turns red once the oldest passes a week. The inbox itself lists open requests oldest first, with the same age chips.
- **Team reviews due**. {{button:outline|Open Hiring → Review}} opens the Rate deck on the first person due.
- **N HR reports are waiting**. Only devs see this one. {{button:outline|Open pending reports}} opens **People → HR**, oldest first. It uses the same 3-day amber and 7-day red scale.

**Jobs and paperwork**

- **N live jobs have no contract on file** opens with {{button:outline|Start the sweep}} on the Pipeline board. **N contracts have been out for signature a week** opens with {{button:outline|See them}}.
- **N sub work orders are waiting for a price**. {{button:outline|Price them}} opens Jobs → Work orders, on the drafts.
- **N open jobs have sat idle N+ days**. These are Working or Waiting jobs with no crew on site in 21 days or more. {{button:outline|Review them}} opens the Follow-ups deck on its Idle lens. Each card says what the job needs and has a door for it. On Quickfill the Job follow-ups station carries this line as its Idle lane. See *follow up on quiet jobs*.
- **Field capacity has run under 60% three weeks running**. {{button:outline|Open Capacity}} opens Job Summary's Capacity view. The card names the three complete weeks. It gives each week's utilization, the share of available hours that was worked. It reads like *48% · 52% · 41% for the weeks of Aug 24, Aug 31 and Sep 7*. It also gives the field hours clocked against the roster's available hours. The current week never counts until it is over.
- **N jobs are waiting on a follow-up**. {{button:outline|Start review}} starts the follow-up review on the Jobs board.
- **Lien windows**. A lien is a legal claim on the property for unpaid work. The item may be a notice or filing window closing soon. It may be a filed lien not yet served, or a demand deadline. A window closing soon opens the Lien desk. A filed lien not yet served, or a demand deadline, opens the job's Lien window. A cleared payment behind a conditional release gets {{button:outline|Issue releases}}. That opens the **cleared releases list** right over the card. You issue the unconditional version from the row. See [give a customer a lien release](?g=give-a-customer-a-lien-release).
- **N vehicles are missing insurance, registration or service**. Only the office sees this one. It covers each vehicle someone is driving. The card names the driver and what is missing. One vehicle reads ***The 2019 Ford F-150 has no registration or service on file***. {{button:outline|Open Vehicles}} opens **People → Vehicles**. Open the vehicle there. **Add to plan** on its **Insurance** card puts it on a plan with a cost. A vehicle already on a plan with no cost reads **insurance cost**. {{button:outline|Edit}} opens the vehicle's form, where **Registration** is its weekly cost. {{button:outline|Log service}} records a shop visit. A vehicle counts as serviced once any service is logged. Review prices a company truck from these. Until they are entered, they count as $0 there. See [manage company vehicles](/help/manage-company-vehicles).

**Bids**

Estimators and devs see these.

- **N bid follow-ups are due**. These are calls you promised a GC for a day, and the day is here or has passed. A missed day turns the card red. {{button:outline|Open the call queue}} opens the Call queue, with those builders on top. See [follow up with builders](/help/follow-up-with-builders).
- ***N lost bids have no reason recorded · all trades***. {{button:outline|Start call mode}} opens call mode on the Why we lost lens. The card counts every trade and says so on its number. The lens opens on one trade at a time and names it the same way. It reads *59 need a reason · Plumbing*.
- **N robot bids are waiting on your audit**. {{button:outline|Open Audits}} opens them. **N fixture names have no Division 22 code**. {{button:outline|Pin codes}} opens the audit. The audit folds spellings the same way the card counts them.

**GC projects**

The office and estimators see this one.

- **N people are waiting on us**. The line counts the people in GC mode waiting on an answer or on something we owe. Each person counts once. {{button:outline|Follow up}} opens Follow up on GC projects. The Follow up button there shows the same count. See [see who is waiting on us and what we owe them](/help/see-who-is-waiting-on-us-and-what-we-owe-them).

**Customers**

The office and estimators see this one.

- **Customers**. The line counts customers who need a reply, what we owe them and senders to sort. On Quickfill the Messages station carries this line and Today's sends. The Dashboard's card keeps both. {{button:outline|Messages}} opens Messages with **Customers** picked. See [answer everyone waiting on us from one page](/help/answer-everyone-waiting-on-us-from-one-page).

**Contracts**

A controller or a dev sees this one.

- **A clause change waits on your approval**. Someone in the office changed a contract clause, and it waits for you. Several read as **N clause changes wait on your approval**. {{button:outline|Review}} opens the oldest change's paper on [Contracts and clauses](/settings?tab=settings-clauses). See [change a contract clause](/help/change-a-contract-clause#approve-or-decline-a-change).

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
- **N rows sent back, no resubmit**. The reviewer marked Revise or Reject. A draft of the next revision with those rows is one tap. Nothing is sent until you share it.
- **A lead time runs past its stage window**. Ordered today, the product lands after the job's earliest stage window ends. You order now, pick a product in stock, or move the window.

The won bid's Job block on the Bid Board carries the same fact. It shows a chip: {{chip:blue|Rev 2 · shared · waiting on Dana W.}}.
