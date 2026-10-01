---
title: schedule a sub across every surface
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: subs, schedule a sub, stage, window, pick a start, sub portal, your days, day off, percent, progress, watchers, dispatch, sub lanes, subs on site, sub board, gc portal, offer to gc, ask for other dates, three-party, overview, map
order: 60
---
Three people share one plan for a stage. The office sets the window, the sub picks the days inside it, and the GC sees what was picked.

A sub is a subcontractor, an outside crew you hire. A GC is the general contractor who runs the site. A stage is one piece of the job's sub work. Nobody types the same dates twice. This guide walks the plan across every screen it touches, in the order a job moves.

## The map

| Surface | Who | What it does |
|---|---|---|
| **Jobs → Subs → Work** | office | You set a stage's window. You draft the order. You answer the GC. You watch the job. |
| **Sub portal**, their private link | sub | They pick a start inside the window. They see their days. They mark a day off. They report a percent. |
| **Schedule → Dispatch**, People or Day | dispatch | It shows sub bookings as read-only lanes. Badges sit next to the crew. |
| **Projects → Forecast → Subs** | office | Every dated order on one board. Off days are striped. |
| **Edit Job → Bill / Edit** | office | Which stages wait their turn, In order or Any time. Which ones the GC sees, the eye. The customer preview. |
| **GC portal**, their private link | GC | Where the job is. The stage sequence in our voice. Ask for other dates on the next stage. |
| **Dispatch inbox** | office | One line per thing a sub or GC did. Each has its next step. |

## 0 · The plan — the Bill tab

Every line item on the job is a stage. Under each row in **① Line Items** the **In order / Any time** selector says whether it waits its turn. See *split a job into stages and bill stage by stage*. In-order rows are numbered top to bottom and wait for the one above. Any-time rows, the change orders, have their own dates. The rows you set to In order are the stages the rest of this guide schedules. The draws, the stage payments you bill, follow them.

:::example Under each line in ① Line Items
**Rough-in**
{{button:dark|In order}} {{button:outline|Any time}}

**Relocate water heater**
{{button:outline|In order}} {{button:amber|Any time}}
:::

## 1 · Set the window — Jobs → Subs → Work

{{gif:schedule-a-sub-subs-tab.gif|Jobs → Subs → Work: jobs grouped, the Window column with the GC chip, a bell on every job}}

**Subs** replaced Work Orders and Sub Labor. The **Work / Pay** switch at the top is the only choice. Work is by job: stages, windows, work orders. Pay is by sub: who is owed, and the pay run. Pay is the old Sub Labor tab unchanged.

A **stage** is one of the job's line items read as a unit of sub work. A **window** is the span you want it done in.

1. On the job's header you press {{button:outline|+ Add a stage…}}.
2. You pick the line item and the two days, then press {{button:blue|Set the window}}.

{{gif:schedule-a-sub-add-stage.gif|Add a stage: pick the line item and the two days, then Set the window}}

The stage becomes its own row, *Window set · no order yet*. It counts on the **Stages waiting** tile until an order fulfils it. A sheet that already has an order shows {{button:outline|Set a window…}} instead. The order takes the window as its dates. Details are in [set a window for a sub's stage](?g=set-a-window-for-a-subs-stage).

## 2 · Send the order, the sub picks a start

You press {{button:blue|Draft a work order…}} on the stage row. It opens the assembler, the work order builder. The window is already in *Work window from / to*. The line-item amount is the price. You fill ***Takes about (working days)***. You pick the sub, tick the scope, and send.

On their portal the offer carries the window as a calendar. They tap the day they can start, the working days fill the rest, and they sign with those dates.

{{gif:schedule-a-sub-pick-start.gif|The sub's offer card: tap the day you can start inside the window, then sign}}

Back on your row the Window cell reads *picked Sep 22 – Sep 23 by the sub*. The sheet's date follows. The dispatch inbox gets one line: *Danny picked Sep 22 – 23 for Rough-in on #1482 · Put it on the board*. If none of the days work, they press **Can't do any of these days**. That sends a line asking you for another window instead.

## 3 · The sub's days

Their portal keeps two views of the same days.

**Your dates** sits on the job card. Until the day before the pick starts they can move it themselves with **Change**. It stays inside the window, with the same working days.

{{gif:schedule-a-sub-your-dates.gif|Your dates on the sub's job card: Change moves the pick inside the window}}

**Your days** is the month. A day is the unit. It says *one job*, *two jobs*, or *off*, never job names. Tapping a day lists the stops with an address and a **Map** link.

{{gif:schedule-a-sub-your-days.gif|Your days: one job, two jobs, a day off; tap a day to see where you'll be}}

**Mark this day off** on a day with nothing on it just keeps it out of the office's hands. On a booked day it also sends a dispatch line: *Danny marked Sep 15 off — Rough-in on #1482 is scheduled over it · Move it or ask the sub*. So the collision is yours to sort out, not theirs.

## 4 · Their part, their percent

Under the sheet's stage rail is one control. It has five buttons, an optional note, and **Send to office** once they have touched either. Anything under 100% just keeps you posted. **100% ✓** is what tells the office to call it in.

{{gif:schedule-a-sub-percent.gif|How far along is your part: tap a percent, add a note if it helps, Send to office}}

The percent shows as a chip on the Work row, *50% along*, and in the sheet story. A note becomes a dispatch line with the sub's words.

## 5 · Watch the job

Every job group has a bell. Assigned superintendents watch by default. **+ Subscribe someone…** adds anyone else. Watchers get an email as it happens, at most one an hour per kind. That covers a percent, *my work here is done*, and the days the sub picked.

{{gif:schedule-a-sub-watchers.gif|The bell on a job: who's watching, and Subscribe someone…}}

Everyone manages their own watches under **Settings → My email schedule → Jobs you watch**. See [watch a job for sub updates](?g=watch-a-job-for-sub-updates).

## 6 · Where dispatch sees the subs

Nothing here is typed by dispatch. It all comes from the picks.

- **Schedule → Dispatch → People** shows a **Subs** section under the crew. It has one read-only lane per sub, a bar across their picked days, and off days hatched. Nothing drags. **Open ›** goes to the sheet.
- A crew cell on a day a sub is also on that job carries a small **sub badge**. So you do not send two crews to one rough-in.
- **Day** view has **Subs on site** for the chosen day, with *Add a site visit ›* when the crew should meet them.
- **Projects → Forecast → Subs** is the full board. It shows every dated order: offered in outline, accepted solid, off days striped, and a red outline on an overlap.
- The **crew day email** lists the subs on each stop.

## 7 · The GC

{{gif:show-a-gc-the-stages-you-plan.gif|Edit Job → Stages: the eye on each stage, and See it as the customer beside it}}

Sharing is off by default. On the job's GC picker you turn on **Share stage dates with this GC**. Then you choose which stages the GC sees with the **eye** on **Edit Job → Stages**. See *show a GC the stages you plan*. On the Work board each stage row's Window shows the read-out beside the dates. It reads {{chip:blue|On Summit's portal ›}} when the eye is on. It reads *Not shown · set on Edit* when it is off. The GC portal shows one sequence, like *Stage 2 of 4 · Top-out · on site now*. It speaks in the company's voice: never a sub's name, never "offered". When a stage passes inspection, the next Order stage's eye turns on for you. That happens if **Offer the next stage when one passes** is on.

The GC can press **Ask for other dates** on an offered stage: two days and a why. That lands as a dispatch line. On your row your dates show lightly struck through, with {{chip:yellow|GC asked ›}}. Then comes *Sep 21 – Oct 2 ·* {{button:green|Accept}} {{button:outline|Answer…}} and their reason in their words beneath. You click the dates for the calendar, with both windows drawn on the months. Accepting may move the window off the sub's pick. Then the sub's card says *The office needs new dates* and opens their calendar. The GC sees **Re-scheduling** until they confirm. Details are in [show a GC the stages you plan](?g=show-a-gc-the-stages-you-plan).

## What lands in the dispatch inbox

Every line names the person, the stage and the job. It also names a next step you can act on from the line.

| Line | Next step |
|---|---|
| *picked Sep 22 – 23 for Rough-in on #1482* | Put it on the board |
| *can't do any of Sep 14 – 25 for Rough-in* | Set another window |
| *marked Sep 15 off — Rough-in is scheduled over it* | Move it or ask the sub |
| *75% along · "Cleanout is behind the water heater"* | Read it, nothing to do |
| *my work here is done on Rough-in* | Call the inspection in |
| *GC asks for Sep 21 – Oct 2 on Rough-in* | Accept or Answer with… |
| *Rough-in passed — Top-out is next* | Offer it to the GC |

## Related guides

- [set a window for a sub's stage](?g=set-a-window-for-a-subs-stage)
- [assemble a sub work order](?g=assemble-a-sub-work-order)
- [watch a job for sub updates](?g=watch-a-job-for-sub-updates)
- [show a GC the stages you plan](?g=show-a-gc-the-stages-you-plan)
- [see what you're owed as a sub](?g=see-what-youre-owed-as-a-sub), the sub's side of the same portal
- [manage subs end to end](?g=manage-subs-end-to-end), for paperwork, roster and money
