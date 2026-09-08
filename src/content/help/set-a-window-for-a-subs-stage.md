---
title: set a window for a sub's stage
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: subs tab, stage, window, line item, rough-in, top-out, trim, work order, assembler, dates, when, schedule a sub, add a stage, set a window, subs work view
order: 61
---
A **stage** is one of a job's line items read as a unit of sub work — Rough-in, Top-out, Trim & final. A **window** is the span you want it done in. Give a stage a window and it becomes a row on **Jobs → Subs → Work** until a work order fulfils it; the assembler then takes the window as the order's dates, so the sub sees the same span you planned.

## Where it lives

**Jobs → Subs** replaced Work Orders and Sub Labor. It has two views on the same sub sheets:

- **Work** — by job. Every sub sheet with money open or an agreement behind it, plus every stage with a window. This is the old Work Orders board with a Window column.
- **Pay** — by sub. The pay run: who's owed, what's ready, the Pay button. This is the old Sub Labor tab, unchanged.

Old links still land: `?tab=work_orders` opens Work, `?tab=sub_sheet_ledger` opens Pay.

## Add a stage to a job

1. Open **Jobs → Subs → Work**. Jobs are grouped, the ones that need a move first.
2. On the job's header press {{button:outline|+ Add a stage…}}. Pick the line item and the two days, then {{button:blue|Set the window}}.
3. The stage appears as its own row: name, line-item amount, the window chip, *Window set · no order yet*.

:::example Rough-in on #1004
The office reads line item 1, Rough-in ($12,465), as a stage and sets **Sep 8 – Sep 19**. The row says *Draft a work order — the window comes along as its dates*.
:::

A job that has no sub sheet and no stage yet does not appear on the board. To start one, use {{button:blue|+ New work order}} and pick the job; the assembler lists that job's stages under **Stage** once any exist.

## Set a window on a sheet that already has an order

A sheet row with no window shows {{button:outline|Set a window…}}. Pick which line item the order fulfils and the span. The order is stamped with the stage, and if it had no dates yet it takes the window as its work window. Press **Change** under a window chip to move it.

## Draft the work order from the stage

{{button:blue|Draft a work order…}} on a stage row opens the assembler on that job with the window as *Work window from / to* and the line-item amount as the price. Pick the sub, tick the scope, send. From then on the stage rides on that order's sheet row — the stage name sits under the sub's name.

## What happens after you send the offer

The sub's portal shows the window as a calendar. They tap the day they can start, the order's **Takes about (working days)** fills the rest, and they sign with those dates. The row then reads *picked Sep 22 – Sep 23 by the sub* under the window chip, the sheet's date follows, and the Sub Board bar lands on the picked days. If they can't do any of the days, a dispatch line asks you for another window.

## Remove a stage

**Remove** on a stage row clears its window. The line item stays on the job; an order already written keeps its own dates.

## What the tiles say

- **On a handshake** — open money on sheets with nothing signed.
- **Stages waiting** — windows with no work order yet.
- **Offers out** and **Signed this month** — as before.

## Who sees what

Devs, leaders, assistants, controllers and estimators set and change windows. Superintendents open **Jobs → Subs** and see the Pay view only, as they saw Sub Labor before.

## See it on the calendar

On **Jobs → Subs → Work** the window shows as text — **Sep 22 – Oct 2** — with a small chip beside it for the GC: {{chip:gray|GC off}} when the job doesn't share stage dates, *Not shown · set on Edit* when it does but the stage's eye is off (flip it on **Edit Job → Stages**), {{chip:blue|On Summit's portal ›}} once they can see it, {{chip:yellow|GC asked ›}} when they've asked for other dates. Under the dates, one line says who set them and what the sub picked.

Click the dates and a **calendar** opens: the months the window touches, your window shaded, the sub's pick as a solid bar, the GC's ask as a dashed ring, today outlined, the sub's days off hatched, and the job's other stages as thin marks so you see Rough-in, Top-out and Trim in order. The panel beside it holds the facts and the moves — {{button:outline|Change our window…}}, {{button:green|Accept}} or {{button:outline|Answer with…}} on a GC ask, {{button:blue|Offer to Summit}} or {{button:outline|Take it off their portal}}. The calendar is for looking; the buttons do the work.

:::example When the GC asks for other dates
Your dates show lightly struck through — they're the ones being replaced — with the GC's dates and {{button:green|Accept}} {{button:outline|Answer…}} beneath, and their reason in their own words under that. Accept takes their dates; Answer lets you propose yours with a why they'll read.
:::
