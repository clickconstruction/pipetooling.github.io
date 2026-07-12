---
title: read the cost and value timeline on a job
category: Billing & Money
roles: dev, master_technician, assistant
keywords: job summary, chart, timeline, cost, expense, value created, reports, card charges, supply house, tally, sub labor
order: 30
---
Every expanded job on **Jobs → Job Summary** starts with a timeline chart of the money on that job: what it has cost you so far, and how much value the crew reports having created.

## Open it

Go to **Jobs → Job Summary** and click any job row. The row expands to the **Cost breakdown**, with the chart at the top.

## The red line — cost to date

The red line steps up every day money went into the job. Each step is tagged with an icon for where the cost came from:

:::example Cost sources
👷 **Team labor** — crew hours on the job (from approved clock time)

🔧 **Sub labor** — sub sheet ledger jobs matched by HCP #

💳 **Card charge** — Mercury card purchases allocated to the job

🧾 **Supply house invoice** — the job's share of allocated supply invoices

📦 **Tally part** — parts entered on the job tally

🧱 **Other job charge** — manual materials lines from Edit Job
:::

The line ends at the same number as the row's **Team Labor + Sub Labor + Parts Cost** columns. Items that have no date land in a **No date** bucket at the far left so the total still matches.

## The green line — value created

Each field report that includes a completion percent steps the green line to **that percent × the job total**. A 🚩 flag marks every report; a flag without a step is a report that didn't include a completion percent.

If the green line is missing, the caption under the chart says why — usually the job total isn't set yet, or no report has a completion percent.

## The % column

The Job Summary table's last column, **%**, shows the same completion percent the green line uses: the latest field report that included a completion percent. When no report carries a percent, it falls back to the job's **% complete** field from Edit Job, and shows **—** when neither is set.

## Hover for detail

Hover any point to see everything that happened that day: who charged what, which invoices were allocated, who filed a report and their completion percent, plus the running **Expense to date** and **Value created** totals.
