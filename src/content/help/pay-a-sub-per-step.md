---
title: pay a sub per step
category: Office
roles: dev, master_technician, assistant, controller, superintendent
keywords: sub, subcontractor, work order, commitment, step, offer, accept, retainage, pay
order: 78
---
A **sub work order** ties a subcontractor to one workflow step for an agreed amount — "Behar does Top Out for $6,400." It lives on the step card, so the work and the money stay on the same screen.

## Add a work order

1. Open the project's Workflow page and expand the step.
2. In the **🔧 Sub work order** panel, click {{button:outline|+ Add}}.
3. Pick the sub from your roster, enter the agreed amount, and click {{button:blue|Add work order}}.

The work order starts as a draft — nothing is promised yet.

## Offer and accept

- {{button:blue|Offer to Behar Kraja}} marks the amount as offered to the sub.
- {{button:blue|Mark accepted}} records that the sub agreed. Superintendents can mark accepted; only office roles can create, offer, or cancel.

The status rail on each work order shows the whole journey: **Offered · Accepted · In progress · Complete · Approved · Settled**. The middle segments follow the step itself — when the tech starts and completes the step, the rail moves with it.

:::example Reading the rail
Offered and Accepted green, In progress orange: the sub agreed and is on the job. Everything green through Approved with Settled orange: the walk passed — time to release the money.
:::

## Balance figures

Each work order shows **Paid to date**, **Backcharges**, **Balance**, and (when set) **Retainage held** — pulled live from the linked Sub Labor sheet once one exists, so this panel and Jobs → Sub Labor always agree.

## Settle — release the money

Once the step is **complete or approved**, the work order shows {{button:blue|Settle → release $5,760}}.

1. Click it — a confirmation shows exactly what will be created: the sub, the amount (minus retainage), and the job number when there's one linked job.
2. {{button:blue|Confirm}} creates the sub's sheet in **Jobs → Sub Labor** automatically, named after the step and project, already tied back to this step.

From there, record payments and backcharges in Sub Labor exactly as you do today — the work order's balance figures follow along.

:::example The full loop
Add a $6,400 work order with 10% retainage → Offer → Mark accepted → tech completes the step → Settle releases $5,760 to Sub Labor → record the check there when it's written.
:::
