---
title: see what the office got done on any day
category: Office
roles: dev, controller
keywords: day book, office, outcomes, billed, deposits, contracts, approvals, clock, people, look back, week, month, rhythm, gaps, coverage, estimators, bids sent, hit rate, estimating strip
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

Every line is an act the app recorded with the person's name on it: a bill marked billed or sent, a deposit applied in Accounts Receivable, a contract sent or a signed one filed, a clock session approved, a job moved to a new status, a dispatch request answered, the schedule updated (*Updated the schedule · 6 people · 9 blocks · Thu–Fri* — every block added, moved, handed to someone else or removed on the Schedule board), a record deleted (those show muted, and are recoverable). Job numbers are links.

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
- {{chip:blue|Everything}} {{chip:gray|Billing}} {{chip:gray|Deposits}} {{chip:gray|Contracts}} {{chip:gray|Approvals}} {{chip:gray|Schedule}} narrow the lines to one kind.
- The **Person** select appears for people with payroll access and lists everyone in the office.

The strip under the controls totals the range: office hours, bills, deposits, contracts, approvals, status moves and schedule blocks changed. It never counts quiet days.

On **today's** rows, a line can end with what is still waiting, from the same counts the Dashboard's Needs You card reads: {{chip:gray|48 still waiting}} on approvals, {{chip:gray|1 left to match}} on deposits. On a **past** day, the Approved line ends with how many sessions were still waiting at the end of that day, worked out from the sessions' own clock-out and approval times; bills, deposits and contracts carry no such history, so they say what is left on today only.

## Estimators

Estimators are on the same tab, on the days they clock into a bid — the clock line names the bid (*1:00p – 5:00p (BP483)*). Their lines are the things that mean something for a bid: *Sent 2 bids · BP483 BP485 · to 3 GCs · $412,000*, *Priced 1 bid · 14 lines*, *Recorded a best effort*, *Asked 4 houses for prices · 1 quote in*, *Audited 1 bid · 14 verdicts*, *Answered 3 robot questions*, *Followed up 5 GCs*. The {{chip:gray|Estimating}} chip narrows to them, and the range strip counts bids sent.

Pick one person and an **Estimating** strip appears under the totals: sent, after due date, decided, hit rate over the trailing 90 days by value, lost with no reason, no follow-up in 7 days, prices asked → in, robot delta, hours per $100k sent — each against that person's own earlier window (*was 34%*). Nothing compares two estimators. A hit rate on fewer than five decided bids shows its count and reads grey, because two decisions are not a rate. *Bid vs actual →* opens the Bid Costs view for the margin a job later realised.

## Reading a month

**Month** turns the range into a grid: one row per kind of work (Billing, Deposits, Contracts, Approvals), one column per day, and in each cell the initials of who did it that day. It answers *is the work getting done, by whom, and where are the gaps* — nobody is scored by how much.

:::example One row of the grid
**Deposits** · applied on 9 of 20 working days
{{chip:blue|T}} {{chip:blue|T}} {{chip:gray|·}} {{chip:gray|·}} {{chip:blue|T RD}} {{chip:yellow|—}} {{chip:yellow|—}} {{chip:yellow|—}} {{chip:blue|T}}
:::

- A grey dot is a day nobody in the office clocked in (a weekend, a holiday). It neither breaks nor extends a run.
- {{chip:yellow|—}} amber marks three working days in a row with nothing on that row **while that kind of work was waiting**. The app knows that for approvals (from the sessions' own timestamps), so the Approvals row can go amber; for the other rows it cannot say what was waiting on a past day, so an empty run there is just empty.
- Today is outlined and never amber — the day is not over.
- Tap any cell to open that day's list. Pick a person and the grid shows only their initials, so a manager reads coverage and a person reads their own rhythm; the grid never puts two people side by side.

## Who sees what

- **Devs and controllers** see everyone, with dollar amounts. Nobody else can open the Day book for now — the tab, the line on Crew Day and the door on Bids are hidden for every other role, and the server refuses the read regardless.

The address bar carries the range and the person, so a manager can send a link to one person's week.

## What it is not

It is not a log of clicks, and a quiet day is not a mark against anyone. Counted fixtures and why-we-lost are not lines — nothing records who counted or who wrote the reason.
