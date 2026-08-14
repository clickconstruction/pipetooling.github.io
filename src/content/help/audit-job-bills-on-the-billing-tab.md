---
title: audit job bills on the Billing tab
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: billing, ledger, line items, sub labor audit, needs labor, total bill
order: 63
---
**Jobs → Billing** is the itemized audit ledger: every non-paid job with its line items spelled out, so you can check a bill's contents and catch missing labor costs before money moves. (The billing *workflow* — moving jobs, sending bills, payments — lives on **Pipeline**.)

## Reading a row

Each row shows the job number with its trade pill and a **stage chip** ({{chip:yellow|Working}}, {{chip:blue|Billed}}, …), the line items under **Specific Work**, **Other job charges**, the crew, and **Total Bill** — now with the money state underneath in color: {{chip:green|paid $X}}, {{chip:blue|billed $Y open}}, {{chip:yellow|unbilled $Z}}. One glance tells you whether the total has actually been billed and collected. The thin vertical **EDIT** tab on the row's right edge — the same one Stages wears in edit mode — opens the Edit Job modal.

## Finding a job by what's on the bill

The search matches the **line-item text**, not just numbers and names — type "water heater" and every job that billed one appears, with the count and dollar total in the footer.

## The labor audit

A job whose labor cost was never captured at all wears a red icon next to its number: it means the job has **no Team Job Labor and no Sub Labor book** — nothing recorded on either side. A job with either kind of labor recorded shows no icon. Hover the icon (or tap it on a phone) and it tells you what's missing. The {{button:outline|Needs labor (N)}} chip in the toolbar filters to exactly those jobs — combine it with the **stage** dropdown to work the list down (e.g. Billed jobs with uncaptured labor are costing you accuracy *right now*).

:::example A quick weekly pass
Turn on Needs labor, pick **Billed** — anything listed went out the door without its labor cost recorded. Fix those first, then sweep Working.
:::

The footer always totals the rows you're looking at — jobs, Total Bill, and paid.
