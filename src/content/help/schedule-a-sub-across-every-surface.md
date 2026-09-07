---
title: schedule a sub across every surface
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: subs, schedule a sub, stage, window, pick a start, sub portal, your days, day off, percent, progress, watchers, dispatch, sub lanes, subs on site, sub board, gc portal, offer to gc, ask for other dates, three-party, overview, map
order: 60
---
Three people share one plan for a stage: the **office** sets the window, the **sub** picks the days inside it, and the **GC** sees what was picked. Nobody types the same dates twice. This guide walks the plan across every screen it touches, in the order a job moves.

## The map

| Surface | Who | What it does |
|---|---|---|
| **Jobs → Subs → Work** | office | Set a stage's window, draft the order, answer the GC, watch the job |
| **Sub portal** (their private link) | sub | Pick a start inside the window, see their days, mark a day off, report a percent |
| **Schedule → Dispatch** (People / Day) | dispatch | See sub bookings as read-only lanes and badges next to the crew |
| **Projects → Forecast → Subs** | office | Every dated order on one board, off days striped |
| **GC portal** (their private link) | GC | The stages you offered, who is coming and when, ask for other dates |
| **Dispatch inbox** | office | One line per thing a sub or GC did, each with its next step |

## 1 · Set the window — Jobs → Subs → Work

{{gif:schedule-a-sub-subs-tab.gif|Jobs → Subs → Work: jobs grouped, the Window column with the GC chip, a bell on every job}}

**Subs** replaced Work Orders and Sub Labor. The **Work / Pay** switch at the top is the only choice: Work is by job (stages, windows, work orders), Pay is by sub (who's owed, the pay run — the old Sub Labor tab unchanged).

A **stage** is one of the job's line items read as a unit of sub work. A **window** is the span you want it done in.

1. On the job's header press {{button:outline|+ Add a stage…}}.
2. Pick the line item, the two days, then {{button:blue|Set the window}}.

{{gif:schedule-a-sub-add-stage.gif|Add a stage: pick the line item and the two days, then Set the window}}

The stage becomes its own row — *Window set · no order yet* — and counts on the **Stages waiting** tile until an order fulfils it. A sheet that already has an order shows {{button:outline|Set a window…}} instead; the order takes the window as its dates. Details in [set a window for a sub's stage](?g=set-a-window-for-a-subs-stage).

## 2 · Send the order, the sub picks a start

{{button:blue|Draft a work order…}} on the stage row opens the assembler with the window already in *Work window from / to* and the line-item amount as the price. Fill **Takes about (working days)**, pick the sub, tick the scope, send.

On their portal the offer carries the window as a calendar. They tap the day they can start, the working days fill the rest, and they sign with those dates.

{{gif:schedule-a-sub-pick-start.gif|The sub's offer card: tap the day you can start inside the window, then sign}}

Back on your row the Window cell reads *picked Sep 22 – Sep 23 by the sub*, the sheet's date follows, and the dispatch inbox gets one line: *Danny picked Sep 22 – 23 for Rough-in on #1482 · Put it on the board*. If none of the days work, **Can't do any of these days** sends a line asking you for another window instead.

## 3 · The sub's days

Their portal keeps two views of the same days.

**Your dates** sits on the job card. Until the day before the pick starts they can move it themselves with **Change** — still inside the window, still the same working days.

{{gif:schedule-a-sub-your-dates.gif|Your dates on the sub's job card: Change moves the pick inside the window}}

**Your days** is the month. A day is the unit: it says *one job*, *two jobs*, or *off* — never job names — and tapping a day lists the stops with an address and a **Map** link.

{{gif:schedule-a-sub-your-days.gif|Your days: one job, two jobs, a day off; tap a day to see where you'll be}}

**Mark this day off** on a day with nothing on it just keeps it out of the office's hands. On a booked day it also sends a dispatch line — *Danny marked Sep 15 off — Rough-in on #1482 is scheduled over it · Move it or ask the sub* — so the collision is yours to sort out, not theirs.

## 4 · Their part, their percent

Under the sheet's stage rail is one control: five buttons, an optional note, and **Send to office** once they've touched either. Anything under 100% just keeps you posted; **100% ✓** is what tells the office to call it in.

{{gif:schedule-a-sub-percent.gif|How far along is your part: tap a percent, add a note if it helps, Send to office}}

The percent shows as a chip on the Work row (*50% along*) and in the sheet story; a note becomes a dispatch line with the sub's words.

## 5 · Watch the job

Every job group has a bell. Assigned superintendents watch by default; **+ Subscribe someone…** adds anyone else. Watchers get an email as it happens — a percent, *my work here is done*, the days the sub picked — at most one an hour per kind.

{{gif:schedule-a-sub-watchers.gif|The bell on a job: who's watching, and Subscribe someone…}}

Everyone manages their own watches under **Settings → My email schedule → Jobs you watch**. See [watch a job for sub updates](?g=watch-a-job-for-sub-updates).

## 6 · Where dispatch sees the subs

Nothing here is typed by dispatch — it all comes from the picks.

- **Schedule → Dispatch → People** shows a **Subs** section under the crew: one read-only lane per sub, a bar across their picked days, off days hatched. Nothing drags; **Open ›** goes to the sheet.
- A crew cell on a day a sub is also on that job carries a small **sub badge** — so you don't send two crews to one rough-in.
- **Day** view has **Subs on site** for the chosen day, with *Add a site visit ›* when the crew should meet them.
- **Projects → Forecast → Subs** is the full board: every dated order, offered in outline, accepted solid, off days striped, a red outline on an overlap.
- The **crew day email** lists the subs on each stop.

## 7 · The GC

Off by default. On the job's GC picker turn on **Share stage dates with this GC**; then each stage row's Window shows an {{chip:blue|Offer to GC ›}} chip beside the dates (or **Offer several together…** on the job header for one bundle); once offered it reads {{chip:blue|On Summit's portal ›}}. The GC portal's **Stages** card shows the window, then *Danny · Sep 22 – 23* once picked, then the percent, then inspection and passed. When a stage passes inspection the next stage is offered for you if **Offer the next stage when one passes** is on.

The GC can press **Ask for other dates** on an offered stage: two days and a why. That lands as a dispatch line and on your row as your dates lightly struck through, {{chip:yellow|GC asked ›}}, then *Sep 21 – Oct 2 ·* {{button:green|Accept}} {{button:outline|Answer…}} and their reason in their words beneath. Click the dates for the calendar and both windows drawn on the months. If accepting moves the window off the sub's pick, the sub's card says *The office needs new dates* and opens their calendar; the GC sees **Re-scheduling** until they confirm. Details in [show a GC the stages you plan](?g=show-a-gc-the-stages-you-plan).

## What lands in the dispatch inbox

Every line names the person, the stage, the job — and a next step you can act on from the line.

| Line | Next step |
|---|---|
| picked Sep 22 – 23 for Rough-in on #1482 | Put it on the board |
| can't do any of Sep 14 – 25 for Rough-in | Set another window |
| marked Sep 15 off — Rough-in is scheduled over it | Move it or ask the sub |
| 75% along · "Cleanout is behind the water heater" | Read it, nothing to do |
| my work here is done on Rough-in | Call the inspection in |
| GC asks for Sep 21 – Oct 2 on Rough-in | Accept or Answer with… |
| Rough-in passed — Top-out is next | Offer it to the GC |

## Related guides

- [set a window for a sub's stage](?g=set-a-window-for-a-subs-stage)
- [assemble a sub work order](?g=assemble-a-sub-work-order)
- [watch a job for sub updates](?g=watch-a-job-for-sub-updates)
- [show a GC the stages you plan](?g=show-a-gc-the-stages-you-plan)
- [see what you're owed as a sub](?g=see-what-youre-owed-as-a-sub) — the sub's side of the same portal
- [manage subs end to end](?g=manage-subs-end-to-end) — paperwork, roster, money
