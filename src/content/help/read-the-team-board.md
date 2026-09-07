---
title: read the Team board
category: Jobs & Scheduling
roles: dev, master_technician, controller
keywords: team, team board, crew board, planned vs clocked, dispatch, clock sessions, ran long, no clock, not on a job, ledger
order: 37
---

Jobs → **Team** is the in-house twin of **Subs**. Subs tells you which contractor was on which job and where it stands; Team tells you the same for your own people on the clock, with the Schedule Dispatch plan as the "agreed" side.

## The board

One week at a time. Every job is a row, every day a column, and each chip is one person's clocked hours on that job that day. Under every chip runs a small track from 6 am to midnight: the **outlined band** is the dispatch block, the **filled bar** is the clock session. A late start, an early leave, or an afternoon move to a second job reads without opening anything.

- {{chip:green|On plan}} — the person clocked on the job dispatch sent them to. The plan hours sit under the clocked hours.
- {{chip:yellow|Clocked, not planned}} — hours on a job with nothing on the dispatch plan for it.
- {{chip:yellow|▲ ran long}} — on plan, but the clock ran more than half again over the block and more than an hour and a half past it. Paige at 12.39 h against a 2 h block is the shape this catches.
- {{chip:red|Planned, no clock}} — a dispatch block with no punch on that job. Drawn dashed.
- {{chip:purple|Sub sheet}} — a sub sheet dated that day sits on its job row with its stage, so one board shows everyone who was on the job.

The top row, **No job on the session**, is hours clocked with no job or bid at all. Each chip there shows what dispatch had that person doing that day — the obvious link.

:::example A Saturday on the board
JP650 · ATI Schertz · Sat 9/5: Isiah and Malachi both show **plan 8.0 h · 8a–4p · no clock** in red. The top row shows **Isiah 0.72 h · dispatch: JP650 · ATI Schertz 8a–4p** in amber. Reading across: Isiah punched 43 minutes with no job, and dispatch already knows where he was.
:::

## The strip and the drawer

Four tiles summarise the week: field time clocked against planned, the on-plan percentage, hours not on a job, and planned-no-clock person-days. **Exceptions this week** underneath turns the same mismatches into a list, newest day first.

## Board or Ledger

{{button:blue|Board}} is the grid. {{button:outline|Ledger}} lists every person-day-job as a row, like sub sheets: date, job, person, the same mini track, plan and clocked windows, hours, plan hours, the difference, payroll state, and a **where it stands** pill — *On plan*, *Ran long*, *Not planned*, *No clock*, *Not on a job*, *Office*.

**Rows: people** flips the board so each row is a person and the chips are jobs, with the week's planned (or salaried target) and clocked bars beside the name. **Hide Office** drops the office rows; **Only exceptions** keeps just the rows with something to look at.

## Acting on a chip

Devs, masters and controllers see the fix on every chip, on every Ledger row, and in the exceptions list. Nothing here edits the split by hand — each button changes the clock session or the dispatch plan and the board reloads.

- **Not on a job** — {{button:blue|Link to J650}} puts the day's dispatch block on the sessions in one tap; {{button:outline|Pick job…}} searches instead; {{button:outline|Split day…}} opens the day editor when the hours belong to two jobs.
- **Planned, no clock** — {{button:outline|Add session}} records the punch that was missed; {{button:outline|Not coming in}} records an unpaid day off (the plan stays); {{button:outline|Adjust plan}} opens that day in Schedule Dispatch.
- **Clocked, not planned** — {{button:blue|Move to plan}} adds a dispatch block that matches the clocked span, so the plan learns from what actually happened.
- **Ran long** — {{button:outline|Split day…}}, in case part of the day belonged elsewhere.

:::example Isiah's Saturday
Top row · Isiah · 0.72 h · *dispatch: JP650 · ATI Schertz 8a–4p* → {{button:blue|Link to JP650}}. Toast: *Linked 1 session (0.72 h) to JP650 · ATI Schertz — split recomputed from the clock.* The chip moves down onto the ATI Schertz row in green.
:::

## What it is not

Man hours and cost per job stay on **Pipeline** and **Job Summary**; wages are not on this tab. Putting a job on a person's hours still happens on the clock session (People → Hours, or Quickfill's Crew Jobs / Bids) — see [put a person's clocked hours on the right job](?g=put-clocked-hours-on-the-right-job).
