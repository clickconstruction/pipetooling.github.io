---
title: audit job bills on the Billing tab
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: billing, ledger, line items, sub labor audit, needs labor, total bill
order: 63
---
Jobs → Billing is the itemized audit ledger. It lists every non-paid job with its line items, so you can catch missing labor costs before money moves.

The billing workflow lives on **Pipeline**. That is moving jobs, sending bills, and payments.

## Reading a row

Each row shows the job number with its trade pill and a **stage chip**, like {{chip:yellow|Working}} or {{chip:blue|Billed}}. It shows the line items under **Specific Work**. It shows **Other job charges**, the crew, and **Total Bill**. The money state sits underneath in color: {{chip:green|paid $X}}, {{chip:blue|billed $Y open}}, {{chip:yellow|unbilled $Z}}. One glance tells you whether the total has actually been billed and collected. The thin vertical **EDIT** tab on the row's right edge opens the Edit Job modal. It is the same one Stages wears in edit mode.

## Finding a job by what's on the bill

The search matches the **line-item text**, not just numbers and names. Type "water heater" and every job that billed one appears. The count and dollar total show in the footer.

## The labor audit

A job whose labor cost was never captured at all wears a red icon next to its number. It means the job has **no Team hours and no Sub Labor book**. Nothing is recorded on either side. A job with either kind of labor recorded shows no icon. Hover the icon, or tap it on a phone, and it tells you what's missing. The {{button:outline|Needs labor (N)}} chip in the toolbar filters to exactly those jobs. Combine it with the **stage** dropdown to work the list down. Billed jobs with uncaptured labor are costing you accuracy right now.

:::example A quick weekly pass
Turn on Needs labor, pick **Billed** — anything listed went out the door without its labor cost recorded. Fix those first, then sweep Working.
:::

The footer always totals the rows you're looking at: jobs, Total Bill, and paid.
