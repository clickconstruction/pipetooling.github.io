---
title: read the cost and value timeline on a job
category: Billing & Money
roles: dev, master_technician, assistant
keywords: job summary, chart, timeline, cost, expense, value created, reports, card charges, supply house, tally, sub labor, payments, net
order: 30
---
Every expanded job on **Jobs → Job Summary** starts with a timeline chart of the money on that job: what it has cost you so far, what the customer has paid back, and how much value the crew reports having created.

## Open it

Go to **Jobs → Job Summary** and click any job row. The row expands to the **Cost breakdown**, with the chart at the top.

## The red line — net cost to date

The main line is the job's **net position: charges minus payments received**. It steps up in **red** every day money went into the job, and steps **down in green** every day a payment came in. Its height at any point answers *"how much of this job's cost is still unrecovered?"*

Each red step is tagged with an icon for where the cost came from:

:::example Cost sources
👷 **Team labor** — crew hours on the job (from approved clock time)

🔧 **Sub labor** — sub sheet ledger jobs matched by HCP #

💳 **Card charge** — Mercury card purchases allocated to the job

🧾 **Supply house invoice** — the job's share of allocated supply invoices

📦 **Tally part** — parts entered on the job tally

🧱 **Other job charge** — manual materials lines from Edit Job
:::

The red rises add up to the same number as the row's **Team Labor + Sub Labor + Parts Cost** columns. Items that have no date land in a **No date** bucket at the far left so the total still matches.

## Green drops — payments received

Every payment recorded on the job (Edit Job → **Payments received**) pulls the line **down**, and that falling stretch draws **green** with a 💵 marker. If the customer has paid back more than the job has cost, the line dips **below $0** — that's money ahead.

If charges and a smaller payment land on the same day, the line still nets upward (red), but the 💵 marker and the hover detail show the payment.

## The blue line — value created

Each field report that includes a completion percent steps the blue line to **that percent × the job total**. A 🚩 flag marks every report; a flag without a step is a report that didn't include a completion percent.

If the blue line is missing, the caption under the chart says why — usually the job total isn't set yet, or no report has a completion percent.

## The % column

The Job Summary table's last column, **%**, shows how complete the job is:

1. **100%** when every invoice on the job is **paid** and the invoiced total is more than zero — a fully collected job is done, whatever the last report said.
2. Otherwise the same completion percent the green line uses: the latest field report that included a completion percent.
3. Otherwise the job's **% complete** field from Edit Job, and **—** when nothing is set.

## Hover for detail

Hover any point to see everything that happened that day: who charged what, which invoices were allocated, payments received, who filed a report and their completion percent, plus the running **Expense**, **Payments**, **Net**, and **Value created** totals.
