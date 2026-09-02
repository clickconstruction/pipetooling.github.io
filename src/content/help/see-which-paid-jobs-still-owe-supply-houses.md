---
title: see which paid jobs still owe my supply houses
category: Billing & Money
roles: assistant, controller, master_technician
keywords: job accounts, supply house, invoices, owed, held, paid, materials, payables, float, allocate, make payment
---
**Materials → Job Accounts** lines up every job's money in both directions: what the customer has paid you, and what you've paid (or still owe) your supply houses for that job's materials. Jobs where the customer's money already arrived but a house is still owed sort to the top — that's money you're holding that belongs onward.

## Read the top row of tiles

- {{chip:yellow|Holding for suppliers}} — unpaid supplier balances on jobs the customer has paid, counted only up to what actually came in. This is the number to drive to zero.
- {{chip:blue|Floating out of pocket}} — the reverse: you already paid houses on jobs the customer hasn't paid yet.
- {{chip:green|Settled}} — paid both ways, nothing held.
- {{chip:gray|Unallocated invoices}} — unpaid invoices not tied to any job or bid. They're missing from every job's numbers, so allocate them: each invoice's **Jobs** field lives on the Supply Houses tab.

## Read a job row

Every row has two bars on the same scale:

- **In** — the blue fill is what the customer has paid, against the full bar of what you billed.
- **Out** — gray is what you've already paid houses; the colored part is what's still owed, shaded from green (not due yet) through amber and red (past due), matching the aging table on Supply Houses.

The chip tells you where the job stands: {{chip:yellow|Owe suppliers}}, {{chip:blue|Floating}}, {{chip:gray|Awaiting customer}}, or {{chip:green|Settled}}. Use the filter chips above the list to see one group at a time.

:::example Reading a row
**J804 · Summit GC — Auto Zone** shows In $23,472 / $32,600 and Out $8,921.73 owed — the customer is 72% paid, and $8,921.73 of supplier invoices are waiting. It sorts near the top under {{chip:yellow|Owe suppliers}}.
:::

## Pay a house from here

1. Click a job row to expand its statement — each supply house with its invoice count, oldest due date, and paid vs. owed totals.
2. Click {{button:outline|Open house}} on the house you want to pay. That jumps to the **Supply Houses** tab with the house already open — its invoices and {{button:green|Make Payment}} are right there.
3. **Open job in Jobs** on the expanded row takes you to the job itself if the customer side is the problem.
