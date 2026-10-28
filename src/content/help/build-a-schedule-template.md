---
title: build a schedule template
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: gc mode, schedule, template, templates, phases, rows, builder, editor, version, kind, working days, milestone, set aside, quick lube
where: /gc?view=templates
order: 112
---
A schedule template is a whole job's schedule with no dates. It keeps phases and rows, who does each row, its days and what each waits on. Put it on the next job of the same kind with a start day.

## Open the Templates page

1. Open [GC projects](/gc).
2. Press {{button:outline|Templates}} beside Customers.

The list shows every template's current version. Each line reads its kind, its rows, its phases, its weeks, who saved it and the jobs drawn from it. Pick a kind under **Kind** to see one kind of job.

## Make a template from nothing

1. Press {{button:blue|New template}}.
2. Type its name at the top. Type its kind beside it, like *Quick lube*.
3. Pick **Days are**. *Mon to Fri* counts working days. *every day* counts weekends too.
4. Press {{button:outline|Add a phase}} and name it, like *Preconstruction and procurement*.
5. Press {{button:outline|Add a row}} on the phase.
6. Type what is done in the row. Pick who does it under **Who**. Type its days.
7. Pick what it waits on under **Waits on**. Type a gap in days when the next row waits a while.
8. Tick **Milestone** when the row is a date to meet, like *Roof on*.
9. Press {{button:blue|Save the template}}.

The line under the buttons says what the template makes from a Monday start. Each phase row reads its days from its rows.

:::fold Who a row is for

**Who** is a trade from the scope book's list, **Us** for our own crew, or **Office** for work nobody is hired for. A company is never named in a template. The company shows on the job once the trade is awarded.

:::

## Change a template

1. Press **Open** on the template's line.
2. Change any row, or add one.
3. Press **⋯** on a row to move it or take it off. The menu offers Move up, Move down, Move to another phase and Take it off.
4. Press {{button:blue|Save as version 2}}.

A save makes a new version. The jobs drawn from an older version keep what they drew. Press **Rename** to give the template a new name without a new version. Press **Set it aside** to keep it off the pick. Press **Bring it back** to offer it again.

## Save a job's schedule as a template

1. Press {{button:outline|From a job's schedule}}.
2. Pick a job being built.
3. Keep the job's name, or type another.
4. Press {{button:blue|Save as a template}}.

The job's lines land as rows with the stage as the phase. Our own lines are **Us** rows. The job's own work, its inspections and its dates to meet come too. The **Templates** card under the job's chart saves the same way.

Put a template on a job with [start a schedule from a template](/help/start-a-schedule-from-a-template).
