---
title: see the money flow on a workflow
category: Office
roles: dev, master_technician
keywords: projections, money flow, workflow, steps, before, after, running total, projected, spent, line items
order: 76
---
A projection is money you expect to land on a job. You can now anchor each one to a step on the Workflow page.

Projections used to live only in the panel at the top of the Workflow page. Now you anchor a projection to a **step**, before it or after it. The page then shows the money moving through the job alongside the work.

## Anchor a projection to a step

1. You open the Workflow page and click {{button:blue|+ Add Projection}}. Or you click **Edit** on an existing one.
2. You fill the label, memo, and amount as usual.
3. Under **Attach to step**, you pick the step. Then you choose **Before the step** or **After the step**.

You can leave "Not attached" instead. Then the projection behaves exactly as before and lives only in the top panel. The top panel's **Projections / Ledger / Left** totals include anchored and unanchored projections alike.

## Reading the flow

Anchored projections appear as slim **$ marker rows** between the step cards. Each one sits right where the money lands in the sequence. Each marker shows three things:

- the memo and amount,
- {{chip:blue|projected to here $X}}, which is every anchored projection from the top of the workflow down to this marker, and
- {{chip:yellow|spent $Y}}, which is the actual **Line Items For Office** recorded on the steps above this marker.

The blue and amber numbers may drift apart. That is where the plan and reality diverge. You click a marker to expand it. There you edit it, delete it, or check its placement.

## The Money drawer on each card

Every expanded step card also gets a **Money** line. It reads *Money · $X projected · $Y items*. You open it to see that step's before and after projections and its actual line-item total. It also has a **+ Add projection here** shortcut that pre-fills the step for you.

## On the Forecast timeline

The same numbers follow the job onto **Projects → Forecast → Specific**. A job's workflow may have projections or line items. Then the stage gutter gains a **balance** column. It shows the running balance as of each stage, in green or red. The toolbar shows the same **margin** and **balance** chips. The column composes with the % column in Edit mode. It hides itself entirely for jobs with no money data.

With dates showing, a **balance line** also runs under the day rail. It stays flat where nothing happens. It steps up or down on the day money lands. A projection lands on its step's start day when it is before the step. It lands on the end day when it is after the step. A line item lands on its own date when it has one. Otherwise it lands at the end of its step. Days where the balance dips negative get a soft red wash. A dashed line marks $0. A **Balance** cell at the left shows where the line ends. The strip scrolls and pans with the timeline.

:::example Reading the line
A dip below the dashed $0 line means spending has landed before the money that covers it — the red-washed days show exactly how long you'd be out of pocket.
:::

## The ledger rail

On wide screens, a running ledger appears down the **left side**. A ledger is a running list of money in and out. Every card and marker row shows the balance at that point. The balance is projected-to-here minus spent-to-here. It is green when ahead and red when spending has outrun the plan. A small card with the **project margin** and current balance stays pinned while you scroll. The rail hides on narrow screens. The marker pills carry the same numbers there.

Anchored money markers follow the same visibility as Projections. Devs and Leaders only see them. Deleting a step does not delete its projections. They simply return to the top panel as unattached.
