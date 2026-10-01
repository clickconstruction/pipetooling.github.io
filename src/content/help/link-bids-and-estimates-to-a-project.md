---
title: link bids and estimates to a project
category: Office
roles: dev, master_technician, assistant, controller
keywords: projects, bids, estimates, link, pills, create bid, create estimate, project card
order: 78
---
Every project card on the Projects page carries three pills: Jobs, Bids and Estimates. The Bids and Estimates pills show what is linked and let you create new ones already linked.

The three pills are segmented. They sit in the card's right rail. The pills are **Jobs**, **Bids** and **Estimates**.

## Read the pills

Each pill is a row of segments. The first is a grey label cap. Then comes one segment per linked item. A {{button:outline-blue|+}} segment sits at the end.

- **Bids**: each segment shows the bid number, or its project name. A dot shows where it stands. Grey is pending, green is won, red is lost, and teal is started or complete. Click a segment to open the bid preview.
- **Estimates**: each segment shows the estimate's title, or its number. A dot shows its status. Grey is draft, blue is sent, green is accepted, and red is declined. Click a segment to open the estimate.

:::example A busy project
A card showing `Bids | 456 | 461 | +` and `Estimates | #12 | +` has two linked bids and one linked estimate. Hover any segment to see its status.
:::

## Create a bid or estimate already linked

Click the {{button:outline-blue|+ Bid}} or {{button:outline-blue|+ Estimate}} segment on the pill:

- **+ Bid** opens the New Bid form. The project is already selected. The Project Name field is pre-filled from the project. Fill in the rest and save.
- **+ Estimate** creates a new draft estimate linked to the project. It takes you straight to it.

## Link an existing bid or estimate

- **Bids**: open the bid's edit form from the Bid Board or any bids tab. Pick the project in the small **Project** control at the top right of the form, beside the title. It reads *Not linked* until you pick one. Most bids never need it. If the bid's free-text project name exactly matches a project, a one-tap **Suggested** button appears. Click it to link without searching.
- **Estimates**: open a draft estimate. Pick the project in the **Project** dropdown above Internal notes. Then save the draft.

Unlinking is the same motion. Set the dropdown back to **Not linked**.

## Who sees the pills

The Bids and Estimates pills show for office roles. Those are dev, leader, assistant and controller. Superintendents and field roles see only the Jobs pill.
