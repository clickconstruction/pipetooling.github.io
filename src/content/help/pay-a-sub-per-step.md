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

## What's next

Approving the walk step releases the balance into Jobs → Sub Labor automatically — see the settlement section of this guide after the next update.
