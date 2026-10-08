---
title: see what the office got done on any day
category: Office
roles: dev, controller
keywords: day book, office, outcomes, billed, deposits, contracts, approvals, clock, people, look back, week, month, rhythm, gaps, coverage, estimators, bids sent, hit rate, estimating strip
order: 41
---
The **Day book** lists what each office person got done on each day. Nobody types anything into it.

The Day book reads the records the app already keeps. You find it under **People → People**. The same view sits under **Bids → Day book** for the estimating side.

:::example One person's day
**Taunya** · 8.6h · 7:52a – 4:31p
Billed 3 · J102 J258 J273 · $14,200
Applied 4 deposits · 3 jobs · $21,460
Sent 2 contracts · J650 J878
Approved 12 clock sessions · 5 people · 61.5h
Moved 2 jobs to Paid · J516 J864
:::

## Where the lines come from

Every line is an act the app recorded with the person's name on it. The acts are these:

- A bill marked billed or sent.
- A deposit applied in Accounts Receivable.
- A contract sent, or a signed one filed.
- A clock session approved.
- A job moved to a new status.
- A dispatch request answered.
- The schedule updated. The schedule line reads like *Updated the schedule · 6 people · 9 blocks · Thu–Fri*. The line covers every block added, moved, handed to someone else or removed on the Schedule board.
- A record deleted. A deleted record's line shows muted. The record can be recovered.

Job numbers are links.

Some things leave no record here: phone calls, texts and email written outside the app. A day with clock time and none of the lines above says so:

:::example A quiet day
**Jordan** · 7.9h · 8:01a – 3:55p
Nothing the app can see. Calls, texts and outside email leave no record here.
**Jordan's note at clock-out** — Called all 9 GCs on the statement round.
:::

The note is the one already asked for at clock-out. If it was left, it shows. If not, nothing asks for it.

## Walking the range

The row of controls at the top does everything:

- {{button:outline|◀}} {{button:outline|▶}} step a week at a time. In Month view they step a month. {{button:outline|This week}} comes back to today.
- {{button:outline|Week}} lists the days. {{button:outline|Month}} reads the month as a rhythm. The month view is covered below.
- {{chip:blue|Everything}} {{chip:gray|Billing}} {{chip:gray|Deposits}} {{chip:gray|Contracts}} {{chip:gray|Approvals}} {{chip:gray|Schedule}} narrow the lines to one kind.
- The **Person** select appears for people with payroll access. The select lists everyone in the office.

The strip under the controls totals the range. The strip counts office hours, bills, deposits, contracts, approvals, status moves and schedule blocks changed. The strip never counts quiet days.

On **today's** rows, a line can end with what is still waiting. The line uses the same counts the Dashboard's Needs You card reads. An approvals line can end {{chip:gray|48 still waiting}}. A deposits line can end {{chip:gray|1 left to match}}.

On a **past** day, the Approved line ends with a count. The count is how many sessions were still waiting at the end of that day. The app works that out from the sessions' own clock-out and approval times.

Deposits, contracts and bills carry history too. The history comes from the days a dev or controller opened the Dashboard. On those days the app records the Needs You card's counts once a day. The app records the Ready to Bill stage's count too. So a past Applied line can end {{chip:gray|1 left to match}}. A Sent contracts line can end {{chip:gray|103 jobs still without one}}. A Billed line can end {{chip:gray|13 left to bill}}. A day nobody looked has no figure. Bills have no live count here, so today's Billed line reads the same way.

## Estimators

Estimators are on the same tab, on the days they clock into a bid. The clock line names the bid: *1:00p – 5:00p (BP483)*. An estimator's lines are the things that mean something for a bid:

- *Sent 2 bids · BP483 BP485 · to 3 GCs · $412,000*
- *Priced 1 bid · 14 lines*
- *Recorded a best effort*
- *Asked 4 houses for prices · 1 quote in*
- *Audited 1 bid · 14 verdicts*
- *Answered 3 robot questions*
- *Followed up 5 GCs*

The {{chip:gray|Estimating}} chip narrows to them. The range strip counts bids sent.

You pick one person and an **Estimating** strip appears under the totals. The strip shows these measures:

- sent
- after due date
- decided
- hit rate over the trailing 90 days by value. Hit rate is the share of decided bid dollars we won.
- lost with no reason
- no follow-up in 7 days
- prices asked → in
- robot delta, the usual gap between the robot's price and theirs
- hours per $100k sent

Each measure is set against that person's own earlier window, as in *was 34%*. Nothing compares two estimators. A hit rate on fewer than five decided bids shows its count and reads grey. The reason is that two decisions are not a rate. *Bid vs actual →* opens the Bid Costs view for the margin a job later realised.

## Reading a month

**Month** turns the range into a grid. There is one row per kind of work: Billing, Deposits, Contracts and Approvals. There is one column per day. Each cell holds the initials of who did that work that day. The grid answers *is the work getting done, by whom, and where are the gaps*. Nobody is scored by how much.

:::example One row of the grid
**Deposits** · applied on 9 of 20 working days
{{chip:blue|T}} {{chip:blue|T}} {{chip:gray|·}} {{chip:gray|·}} {{chip:blue|T RD}} {{chip:yellow|—}} {{chip:yellow|—}} {{chip:yellow|—}} {{chip:blue|T}}
:::

- A grey dot is a day nobody in the office clocked in, like a weekend or a holiday. A grey dot neither breaks nor extends a run.
- {{chip:yellow|—}} amber marks a gap. A gap is three straight working days with nothing on that row **while that kind of work was waiting**. For approvals, the app knows that from the sessions' own timestamps. For deposits, contracts and billing, the app knows from the counts it recorded that day. The recorded counts start from the day a dev or controller first opened the Dashboard. So those rows can go amber. A day nobody looked stays plain.
- Today is outlined and never amber. The day is not over.
- You tap any cell to open that day's list. You pick a person and the grid shows only their initials. So a manager reads coverage, and a person reads their own rhythm. The grid never puts two people side by side.

## Who sees what

- **Devs and controllers** see everyone, with dollar amounts. Nobody else can open the Day book for now. The tab, the line on Crew Day and the door on Bids are hidden for every other role. The server also refuses to send them the data.

The address bar carries the range and the person. So a manager can send a link to one person's week. You switch to another tab and the range leaves the address bar with the Day book. You come back and it opens on the week you left.

## What it is not

The Day book is not a log of clicks. A quiet day is not a mark against anyone. Counted fixtures and why-we-lost reasons are not lines. Nothing records who counted or who wrote the reason.
