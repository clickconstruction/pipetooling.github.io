---
title: see the money flow on a workflow
category: Office
roles: dev, master_technician
keywords: projections, money flow, workflow, steps, before, after, running total, projected, spent, line items
order: 76
---
Projections used to live only in the panel at the top of the Workflow page. Now you can anchor each projection to a **step** — before it or after it — and the page shows the money moving through the job alongside the work.

## Anchor a projection to a step

1. On the Workflow page, click {{button:primary|+ Add Projection}} (or **Edit** on an existing one).
2. Fill the label, memo, and amount as usual.
3. Under **Attach to step**, pick the step — then choose **Before the step** or **After the step**.

Leave "Not attached" and the projection behaves exactly as before, living only in the top panel. The top panel's **Projections / Ledger / Left** totals include anchored and unanchored projections alike.

## Reading the flow

Anchored projections appear as slim **$ marker rows** between the step cards, right where the money lands in the sequence. Each marker shows:

- the memo and amount,
- {{chip:blue|projected to here $X}} — every anchored projection from the top of the workflow down to this marker, and
- {{chip:amber|spent $Y}} — the actual **Line Items For Office** recorded on the steps above this marker.

When the blue and amber numbers drift apart, that's where the plan and reality diverge. Click a marker to expand it — edit, delete, or check its placement.

## The Money drawer on each card

Every expanded step card also gets a **Money** line (`Money · $X projected · $Y items`). Open it to see that step's before/after projections, its actual line-item total, and a **+ Add projection here** shortcut that pre-fills the step for you.

## The ledger rail

On wide screens, a running ledger appears down the **left side**: every card and marker row shows the balance at that point (projected-to-here minus spent-to-here, green when ahead, red when spending has outrun the plan), and a small card with the **project margin** and current balance stays pinned while you scroll. The rail hides on narrow screens — the marker pills carry the same numbers there.

Anchored money markers follow the same visibility as Projections — devs and Masters only. Deleting a step doesn't delete its projections; they simply return to the top panel as unattached.
