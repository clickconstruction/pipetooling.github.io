---
title: read the cost and value timeline on a job
category: Billing & Money
roles: dev, master_technician, assistant
keywords: job summary, chart, timeline, cost, expense, value created, reports, card charges, supply house, tally, sub labor, payments, net
order: 30
---
Every expanded job on **Jobs → Job Summary** starts with a timeline chart of the money on that job: what it has cost you so far, what the customer has paid back, and how much value the crew reports having created.

## Open it

Go to **Jobs → Job Summary** and click any job row. The row expands with a quick header — {{button:outline-blue|Job Detail}} and {{button:outline|Edit Job}} links plus the same **Assigned / HCP / Last activity** info you see on Stages — followed by the **Cost breakdown** with the chart at the top.

The same chart also lives at the bottom of the **Parts cost** section in the **Job Detail** and **Edit Job** modals. When a job has many transaction days, the chart widens and **scrolls left–right** instead of crushing the icons together.

## The profit line — money out vs money in

The main line is the job's **profit: payments received minus what it has cost**. It steps **down in red** every day money went into the job, and **up in green** every day a payment came in. A dashed line marks **$0** — above it, the job has collected more than it cost; the bold label at the end of the line is the job's current profit (for example **+$166.21**).

Each red step is tagged with an icon for where the cost came from:

:::example Cost sources
👷 **Team labor** — crew hours on the job (from approved clock time)

🔧 **Sub labor** — sub sheet ledger jobs matched by HCP #

💳 **Card charge** — Mercury card purchases allocated to the job

🧾 **Supply house invoice** — the job's share of allocated supply invoices

📦 **Tally part** — parts entered on the job tally

🧱 **Other job charge** — manual materials lines from Edit Job
:::

The red falls add up to the same number as the row's **Team Labor + Sub Labor + Parts Cost** columns. Items that have no date land in a **No date** bucket at the far left so the total still matches.

## Green rises — payments received

Every payment recorded on the job (Edit Job → **Payments received**) lifts the line **up**, and that rising stretch draws **green** with a 💵 marker. Once the customer has paid back more than the job has cost, the line crosses **above $0** — that's money made.

If charges and a smaller payment land on the same day, the line still nets downward (red), but the 💵 marker and the hover detail show the payment.

## The blue line — value created

Each field report that includes a completion percent steps the blue line to **that percent × the job total**. A 🚩 flag marks every report; a flag without a step is a report that didn't include a completion percent.

If the blue line is missing, the caption under the chart says why — usually the job total isn't set yet, or no report has a completion percent.

## The % column

The Job Summary table's last column, **%**, shows how complete the job is:

1. **100%** when every invoice on the job is **paid** and the invoiced total is more than zero — a fully collected job is done, whatever the last report said.
2. Otherwise the same completion percent the green line uses: the latest field report that included a completion percent.
3. Otherwise the job's **% complete** field from Edit Job, and **—** when nothing is set.

## Hover for detail

Hover any point to see everything that happened that day: who charged what, which invoices were allocated, payments received, who filed a report and their completion percent, plus the running **Cost**, **Paid**, **Profit**, and **Value created** totals.
