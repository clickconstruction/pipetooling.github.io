---
title: see project status at a glance
category: Office
roles: dev, master_technician, assistant, controller, superintendent
keywords: projects, steps, progress bar, attention, waiting, unassigned, schedule, current step
order: 77
---
The Projects list reads like a job board: every project row shows a progress bar, who the current step is waiting on, and warning pills when something needs a decision.

## Which projects you see

Office accounts (dev, master, assistant, controller) see every project. A **superintendent sees only the projects they are assigned to** — the same rule covers the project's Workflow page, its step line items, and its sub work orders. To give a superintendent a project, open its Workflow page and add them under **Assigned Superintendents**; the project appears on their list right away.

:::example A superintendent's Projects list
The company has three projects. Sam is assigned to one of them, so Sam's list shows one row — the other two are not Sam's to see.
:::

## The progress bar

Each segment is one workflow step, in order, colored by where it stands:

- **Green** — completed or approved
- **Orange** — in progress right now
- **Red** — sent back (needs rework)
- **Striped** — skipped
- **Gray** — not started yet

Hover any segment to see the step's name and status.

:::example Reading a row
A row showing two green segments, one orange, and eight gray means the project is on step 3 of 11 — the orange one.
:::

## The current-step chip

Under the bar, a chip names the current step, its position, and its assignee:

{{chip:yellow|Rough In Walk [3/11] · Robert · day 4}}

"day 4" counts calendar days since the step was started. If nobody is assigned, the chip says **unassigned**.

## Warning pills

Pills appear only when something needs attention:

- {{chip:yellow|⚠ waiting on Robert · 4d}} — the current step has been in progress 3+ days
- {{chip:yellow|⚠ current step unassigned}} — nobody owns the next move
- {{chip:red|⚠ no schedule on current step}} — the current step has no expected dates
- {{chip:red|⚠ sent back: Rough In Walk}} — a step was rejected and needs rework

Projects with warnings sort to the top of the list, so the ones needing a decision are always the first thing you see.

## The money line (dev and master accounts)

Under the pills, rows with money show **Projected** (the workflow's projections) and **Spent** (step line items) — the same numbers as the Workflow page's money panel, without opening it.

## Subs on the Workflow page

Opening a project's Workflow shows a **Subs** strip in the header — one chip per subcontractor assigned to any step, with how many of their steps are still open. Hover a chip to see which step they're on right now.

## Where to act

Click the project name to open its Workflow page — assign the step, set expected dates, or approve the work from there.
