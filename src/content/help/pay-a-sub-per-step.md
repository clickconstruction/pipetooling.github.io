---
title: pay a sub per step
category: Office
roles: dev, master_technician, assistant, controller, superintendent
keywords: sub, subcontractor, work order, commitment, step, offer, accept, retainage, pay
order: 78
---
A sub work order ties a subcontractor to one workflow step for an agreed amount. It lives on the step card, so the work and the money stay together.

A sub is a subcontractor. An example is "Behar does Top Out for $6,400." Top Out is a workflow step. The work and the money stay on the same screen.

## Add a work order

1. Open the project's Workflow page and expand the step.
2. In the **🔧 Sub work order** panel, click {{button:outline|+ Add}}.
3. Pick the sub from your roster, enter the agreed amount, and click {{button:blue|Add work order}}.

The work order starts as a draft. Nothing is promised yet.

## Offer and the sub's answer

1. {{button:blue|Offer to Behar Kraja…}} opens the offer editor. It holds the amount plus a proposed work window, pre-filled from the step's expected dates.
2. {{button:blue|Send offer}} notifies the sub by push and email. The rail shows **Awaiting answer**.
3. The sub accepts or declines from their own dashboard. You are notified either way:
   - **Accepted** means the sub said yes. If the step had no expected dates, the agreed window becomes them.
   - **Declined** means the sub said no. The reason shows on the card. {{button:blue|Re-offer…}} is ready to go, to change the amount or dates.

While an offer waits, three buttons help. {{button:outline|Withdraw offer}} takes it back to draft. {{button:outline|Nudge}} resends the notification. {{button:blue|Mark accepted}} still works when the sub answered you by phone. Superintendents can mark accepted. Only office roles create, offer, or cancel.

The status rail on each work order shows the whole journey: ***Offered · Accepted · In progress · Complete · Approved · Settled***. The middle segments follow the step itself. When the tech starts and completes the step, the rail moves with it.

:::example Reading the rail
Offered and Accepted green, In progress orange: the sub agreed and is on the job. Everything green through Approved with Settled orange: the walk passed — time to release the money.
:::

## Balance figures

Each work order shows **Paid to date**, **Backcharges** and **Balance**. It shows **Retainage held** when set. Retainage is the part of the pay held back until the job is done. Backcharges are costs charged back to the sub. The figures are pulled live from the linked Sub Labor sheet once one exists. So this panel and Jobs → Subs → Pay always agree.

## See who's booked when

**Projects → Forecast → Subs** lays every sub's work orders on a timeline. Accepted work is solid. Unanswered offers are ghosted with a **?**. A red outline shows when two bookings overlap. Click a bar to open that project's workflow.

## Settle: release the money

Once the step is **complete or approved**, the work order shows {{button:blue|Settle → release $5,760}}.

1. Click it. A confirmation shows exactly what will be created. That is the sub, the amount minus retainage, and the job number when there is one linked job.
2. {{button:blue|Confirm}} creates the sub's sheet in **Jobs → Subs → Pay** automatically. It is named after the step and project, already tied back to this step.

From there, record payments and backcharges in Sub Labor exactly as you do today. The work order's balance figures follow along.

:::example The full loop
Add a $6,400 work order with 10% retainage → Offer → Mark accepted → tech completes the step → Settle releases $5,760 to Sub Labor → record the check there when it's written.
:::
