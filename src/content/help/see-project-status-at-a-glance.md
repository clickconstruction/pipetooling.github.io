---
title: see project status at a glance
category: Office
roles: dev, master_technician, assistant, controller, superintendent
keywords: projects, steps, progress bar, attention, waiting, unassigned, schedule, current step, assign, notify, not a user
order: 77
---
The Projects list reads like a job board. Every project row shows a progress bar, who the current step is waiting on, and warning pills.

A warning pill appears when something needs a decision.

## Which projects you see

Office accounts see every project. Those are dev, leader, assistant and controller. A **superintendent sees only the projects they are assigned to**. The same rule covers the project's Workflow page, its step line items, and its sub work orders. To give a superintendent a project, you open its Workflow page. You add them under **Superintendents:**. The project appears on their list right away.

:::example A superintendent's Projects list
The company has three projects. Sam is assigned to one of them, so Sam's list shows one row — the other two are not Sam's to see.
:::

## The progress bar

Each segment is one workflow step, in order. Its color says where it stands:

- **Green** is completed or approved
- **Orange** is in progress right now
- **Red** is sent back and needs rework
- **Striped** is skipped
- **Gray** is not started yet

You hover any segment to see the step's name and status.

:::example Reading a row
A row showing two green segments, one orange, and eight gray means the project is on step 3 of 11 — the orange one.
:::

## The current-step chip

Under the bar, a chip names the current step, its position, and its assignee:

{{chip:yellow|Rough In Walk [3/11] · Robert · day 4}}

"day 4" counts calendar days since the step was started. If nobody is assigned, the chip says **unassigned**.

## Warning pills

Pills appear only when something needs attention:

- {{chip:yellow|⚠ waiting on Robert · 4d}} means the current step has been in progress 3 days or more
- {{chip:yellow|⚠ current step unassigned}} means nobody owns the next move
- {{chip:red|⚠ no schedule on current step}} means the current step has no expected dates
- {{chip:red|⚠ sent back: Rough In Walk}} means a step was rejected and needs rework

Projects with warnings sort to the top of the list. So the ones needing a decision are always the first thing you see.

## The money line (dev and leader accounts)

Under the pills, rows with money show **Projected** and **Spent**. Projected is the workflow's projections, the money expected on the job. Spent is the step line items. These are the same numbers as the Workflow page's money panel, without opening it.

## Subs on the Workflow page

You open a project's Workflow. It shows a **Subs** strip in the header. There is one chip per subcontractor assigned to any step. Each chip says how many of their steps are still open. You hover a chip to see which step they are on right now.

## Who holds a step

On the Workflow page each stage card names its assignee. A card with nobody reads **Unassigned**. You pick someone with {{button:outline|Assign}}. The picker offers every active account in the company, office and field. It also offers your roster of subs and helpers. A name followed by *(not a user)* is a roster person without a login. That person is reached by e-mail rather than in the app.

:::example The first assignee turns notifications on
Assigning a person to a step that had nobody switches on the three **Notify** toggles for that step — started, complete, and reopened — so the person hears about it without anyone opening the Notify fold. Turn any of them off afterwards and the step keeps your choice, even if you reassign it later.
:::

## Where to act

You click the project name to open its Workflow page. There you assign the step, set expected dates, or approve the work.
