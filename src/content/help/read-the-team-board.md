---
title: read the Team board
category: Jobs & Scheduling
roles: dev, master_technician, controller
keywords: team, team board, crew board, planned vs clocked, dispatch, clock sessions, ran long, no clock, not on a job, ledger
order: 37
---

Jobs → Team is the in-house twin of Subs. It shows your own people on the clock, job by job and day by day.

Subs tells you which contractor was on which job and where it stands. Team tells you the same for your own people on the clock. The Schedule Dispatch plan is the agreed side.

## The board

The board shows one week at a time. Every job is a row and every day is a column. Each chip is one person's clocked hours on that job that day. Under every chip runs a small track from 6 am to midnight. The **outlined band** is the dispatch block, the hours the plan gave them. The **filled bar** is the clock session, the hours they punched. A late start, an early leave, or an afternoon move to a second job reads without opening anything.

- {{chip:green|On plan}}: the person clocked on the job dispatch sent them to. The plan hours sit under the clocked hours.
- {{chip:yellow|Clocked, not planned}}: hours on a job with nothing on the dispatch plan for it.
- {{chip:yellow|▲ ran long}}: on plan, but the clock ran long. Long means more than half again over the block and more than an hour and a half past it. Paige at 12.39 h against a 2 h block is the shape this catches.
- {{chip:red|Planned, no clock}}: a dispatch block with no punch on that job. It is drawn dashed.
- {{chip:purple|Sub sheet}}: a sub sheet dated that day sits on its job row with its stage. So one board shows everyone who was on the job.

The top row, **No job on the session**, is hours clocked with no job or bid at all. Each chip there shows what dispatch had that person doing that day. That is the obvious link.

:::example A Saturday on the board
JP650 · ATI Schertz · Sat 9/5: Isiah and Malachi both show **plan 8.0 h · 8a–4p · no clock** in red. The top row shows **Isiah 0.72 h · dispatch: JP650 · ATI Schertz 8a–4p** in amber. Reading across: Isiah punched 43 minutes with no job, and dispatch already knows where he was.
:::

## The strip and the drawer

Four tiles summarise the week. They show field time clocked against planned, the on-plan percentage, hours not on a job, and planned-no-clock person-days. **Exceptions this week** underneath turns the same mismatches into a list, newest day first.

## Board or Ledger

{{button:blue|Board}} is the grid. {{button:outline|Ledger}} lists every person-day-job as a row, like sub sheets. Each row shows the date, job, person and the same mini track. It shows the plan and clocked windows, hours, plan hours and the difference. It shows the payroll state and a **where it stands** pill. The pill reads *On plan*, *Ran long*, *Not planned*, *No clock*, *Not on a job* or *Office*.

**Rows: people** flips the board so each row is a person and the chips are jobs. The week's planned bar and clocked bar sit beside the name. For a salaried person the planned bar is their salaried target. **Hide Office** drops the office rows. **Only exceptions** keeps just the rows with something to look at.

Quickfill's **Unassigned field time** card links here. {{button:outline|Open on Team board →}} on a week line opens that week with **Only exceptions** already ticked. What is left is the person-days with no job and the planned-no-clock chips.

## Acting on a chip

Devs, masters and controllers see the fix on every chip, on every Ledger row, and in the exceptions list. Nothing here edits the split by hand. Each button changes the clock session or the dispatch plan and the board reloads.

- **Not on a job**: {{button:blue|Link to J650}} puts the day's dispatch block on the sessions in one tap. {{button:outline|Pick job…}} searches instead. {{button:outline|Split day…}} opens the day editor when the hours belong to two jobs.
- **Planned, no clock**: {{button:outline|Add session}} records the punch that was missed. {{button:outline|Not coming in}} records an unpaid day off and the plan stays. {{button:outline|Adjust plan}} opens that day in Schedule Dispatch.
- **Clocked, not planned**: {{button:blue|Move to plan}} adds a dispatch block that matches the clocked span. So the plan learns from what actually happened.
- **Ran long**: {{button:outline|Split day…}} in case part of the day belonged elsewhere. Or {{button:outline|Looks right}} when the overrun was real.

## Looks right

Some overruns are just the job. {{button:outline|Looks right}} on a ran-long or clocked-not-planned chip accepts it. The chip turns green with *✓ accepted* under the hours. It leaves the exceptions list and the counts. {{button:outline|Undo accept}} on the same chip brings it back. Accepting is shared. Everyone in the office sees the same board.

How far past its block a day has to run before it counts as ran long is a company default. You set it at Settings → Company → **Defaults for everyone** → **Ran long on the Team board**. Gentle is 1.25× and 1 h over. Standard is 1.5× and 1.5 h over. Loose is 2× and 2 h over. Or you turn it off. The board's footer says which rule is in force.

:::example Isiah's Saturday
Top row · Isiah · 0.72 h · *dispatch: JP650 · ATI Schertz 8a–4p* → {{button:blue|Link to JP650}}. Toast: *Linked 1 session (0.72 h) to JP650 · ATI Schertz — split recomputed from the clock.* The chip moves down onto the ATI Schertz row in green.
:::

## What it is not

Man hours and cost per job stay on **Pipeline** and **Job Summary**. Wages are not on this tab. Putting a job on a person's hours always happens on the clock session. You do that from this board's actions or from People → Hours. See [put a person's clocked hours on the right job](?g=put-clocked-hours-on-the-right-job).
