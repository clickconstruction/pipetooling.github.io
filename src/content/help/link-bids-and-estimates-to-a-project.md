---
title: link bids and estimates to a project
category: Office
roles: dev, master_technician, assistant, controller
keywords: projects, bids, estimates, link, pills, create bid, create estimate, project card
order: 78
---
Every project card on the Projects page carries three segmented pills in its right rail: **Jobs**, **Bids**, and **Estimates**. The Bids and Estimates pills show everything linked to that project and let you create new ones already linked.

## Read the pills

Each pill is a row of segments: a grey label cap, one segment per linked item, and a {{button:outline-blue|+}} segment at the end.

- **Bids** — each segment shows the bid number (or its project name) with a dot for where it stands: grey pending, green won, red lost, teal started/complete. Click a segment to open the bid preview.
- **Estimates** — each segment shows the estimate's title (or its number) with a dot for its status: grey draft, blue sent, green accepted, red declined. Click a segment to open the estimate.

:::example A busy project
A card showing `Bids | 456 | 461 | +` and `Estimates | #12 | +` has two linked bids and one linked estimate. Hover any segment to see its status.
:::

## Create a bid or estimate already linked

Click the {{button:outline-blue|+ Bid}} or {{button:outline-blue|+ Estimate}} segment on the pill:

- **+ Bid** opens the New Bid form with the project already selected and the Project Name field pre-filled from the project. Fill in the rest and save.
- **+ Estimate** creates a new draft estimate linked to the project and takes you straight to it.

## Link an existing bid or estimate

- **Bids** — open the bid's edit form (from the Bid Board or any bids tab) and pick the project in the **Project** dropdown under Project Name. If the bid's free-text project name exactly matches a project, a one-tap **Suggested** button appears — click it to link without searching.
- **Estimates** — open a draft estimate and pick the project in the **Project** dropdown above Internal notes, then save the draft.

Unlinking is the same motion: set the dropdown back to **Not linked**.

## Who sees the pills

The Bids and Estimates pills show for office roles (dev, master, assistant, controller). Superintendents and field roles see only the Jobs pill.
