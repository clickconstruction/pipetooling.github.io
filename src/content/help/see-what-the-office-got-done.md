---
title: see what the office got done on any day
category: Office
roles: dev, master_technician, assistant, controller
keywords: day book, office, outcomes, billed, deposits, contracts, approvals, clock, people, look back, week, month, rhythm, gaps, coverage
order: 41
---
The **Day book** is a view under **People → People**. It lists what each office person got done on each day, read from the records the app already keeps. Nobody types anything into it.

:::example One person's day
**Taunya** · 8.6h · 7:52a – 4:31p
Billed 3 · J102 J258 J273 · $14,200
Applied 4 deposits · 3 jobs · $21,460
Sent 2 contracts · J650 J878
Approved 12 clock sessions · 5 people · 61.5h
Moved 2 jobs to Paid · J516 J864
:::

## Where the lines come from

Every line is an act the app recorded with the person's name on it: a bill marked billed, a deposit applied in Accounts Receivable, a contract sent or a signed one filed, a clock session approved, a job moved to a new status, a dispatch request answered, a record deleted (those show muted, and are recoverable). Job numbers are links.

Some things leave no record here: phone calls, texts, and email written outside the app. A day with clock time and none of the lines above says so:

:::example A quiet day
**Jordan** · 7.9h · 8:01a – 3:55p
Nothing the app can see. Calls, texts and outside email leave no record here.
**Jordan's note at clock-out** — Called all 9 GCs on the statement round.
:::

The note is the one already asked for at clock-out. If it was left, it shows; if not, nothing asks for it.

## Walking the range

The row of controls at the top does everything:

- {{button:outline|◀}} {{button:outline|▶}} step a week (or a month) at a time; {{button:outline|This week}} comes back to today.
- {{button:outline|Week}} lists the days; {{button:outline|Month}} reads the month as a rhythm (below).
- {{chip:blue|Everything}} {{chip:gray|Billing}} {{chip:gray|Deposits}} {{chip:gray|Contracts}} {{chip:gray|Approvals}} narrow the lines to one kind. *Schedule* joins once schedule changes are recorded.
- The **Person** select appears for people with payroll access and lists everyone in the office.

The strip under the controls totals the range: office hours, bills, deposits, contracts, approvals and status moves. It never counts quiet days.

On **today's** rows, a line can end with what is still waiting, from the same counts the Dashboard's Needs You card reads: {{chip:gray|48 still waiting}} on approvals, {{chip:gray|1 left to match}} on deposits.

## Reading a month

**Month** turns the range into a grid: one row per kind of work (Billing, Deposits, Contracts, Approvals), one column per day, and in each cell the initials of who did it that day. It answers *is the work getting done, by whom, and where are the gaps* — nobody is scored by how much.

:::example One row of the grid
**Deposits** · applied on 9 of 20 working days
{{chip:blue|T}} {{chip:blue|T}} {{chip:gray|·}} {{chip:gray|·}} {{chip:blue|T RD}} {{chip:yellow|—}} {{chip:yellow|—}} {{chip:yellow|—}} {{chip:blue|T}}
:::

- A grey dot is a day nobody in the office clocked in (a weekend, a holiday). It neither breaks nor extends a run.
- {{chip:yellow|—}} amber marks three working days in a row with nothing on that row **while that kind of work was waiting**. Until the app can say what was waiting on a past day, nothing turns amber; an empty run is just empty.
- Today is outlined and never amber — the day is not over.
- Tap any cell to open that day's list. Pick a person and the grid shows only their initials, so a manager reads coverage and a person reads their own rhythm; the grid never puts two people side by side.

## Who sees what

- **Dev, controller, and a pay-approved master** see everyone, with dollar amounts.
- **Everyone else in the office** sees their own days, with counts and job numbers and no amounts.

The address bar carries the range and the person, so a manager can send a link to one person's week.

## What it is not

It is not a log of clicks, and a quiet day is not a mark against anyone. Estimators' bids and schedule changes are coming next.
