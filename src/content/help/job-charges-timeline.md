---
title: read the cost and value timeline on a job
category: Billing & Money
roles: dev, master_technician, assistant
keywords: job summary, chart, timeline, cost, expense, value created, reports, card charges, supply house, tally, sub labor, payments, net, burn, budget, percent complete, at completion, projected margin, overhead
order: 30
---
Every expanded job on **Jobs → Job Summary** starts with a timeline chart of the money on that job: what it has cost you so far, what the customer has paid back, and how much value the crew reports having created.

## Burn — are we spending faster than we are finishing?

Owners, controllers and master techs see a **Burn** section at the top of the job window's **Costs** tab, above the chart. Four tiles:

- **Spent to date** — team labor, sub labor and parts, the same direct costs the chart draws.
- **Budget** — the bid's estimated cost once estimates are snapshotted onto jobs; until then, the job's price × (100 − your Job Summary **Target** margin). The header says which rule it used.
- **% of budget vs % done** — the tell. The left number is spend, the right is the latest field report's percent complete. {{chip:red|68% vs 62%}} means the crew has burned more of the budget than they have finished; it turns red past five points.
- **At completion** — spent ÷ percent done, and the margin that leaves against the price. Under it, the job's **overhead share** (Job Summary's day-share so far, plus today's rate × the working days still to come) and the **true margin** after it. Overhead never touches the burn signal; it only sharpens the projection.

Below the tiles: **daily spend bars** for the last 14 working days with a 7-day average, the **cumulative chart** with the budget as a dashed ceiling, earned value stepping up at each report, and a dotted forecast to the day the budget runs out at today's burn; then three plain rows — burn rate per field day, when the budget runs out, and how many working days of work are left at the current pace.

A job under three field days or under 10% reads *too early to call* instead of guessing.

:::example Reading a hot job
Spent $19,860 of a $29,200 budget (68%) at 62% done. At completion: $32,032, margin $16,668 (34% against a 40% bid). Plus $4,140 overhead → true margin $12,528 (26%). Budget runs out Sep 17 with 38% of the work left. Time to look at why.
:::

## Open it

Go to **Jobs → Job Summary** and click any job row. The row expands with a quick header — {{button:outline-blue|Job Detail}} and {{button:outline|Edit Job}} links plus the same **Assigned / HCP / Last activity** info you see on the Pipeline — followed by the **Cost breakdown** with the chart at the top.

The same chart opens the job window's **Costs** tab — the money-out tab beside Bill — with the **Team** and **Sub Labor** lines and the parts accordions under it; the Job tab's Costs card names the 👷 total in one number (owners, controllers and master techs). The marker key sits right under every chart, always visible. When a job has many transaction days, the chart widens and **scrolls left–right** instead of crushing the icons together.

## The cash position line — money out vs money in

The main line is the job's **cash position: payments received minus what it has cost** — money in hand on the job so far, not a margin (Job Summary carries gross and true profit). It steps **down in red** every day money went into the job, and **up in green** every day a payment came in. A dashed line marks **$0** — above it, the job has collected more than it cost; the bold label at the end of the line is the job's current cash position (for example **+$166.21**). If your role can't see wages, the legend reads *cash position before team labor* — the same job reads higher for you than for the owner because crew wages are not charged on your chart.

Each red step is tagged with an icon for where the cost came from:

:::example Cost sources
👷 **Team labor** — crew hours on the job, from **recorded** clock time: every closed session that wasn't rejected, whether or not it's been approved yet. A salaried day counts as 8 h on the job it was clocked to, from the moment the person clocks in. Approval is the payroll gate, not the costing gate.

🔧 **Sub labor** — sub sheet ledger jobs matched by HCP #

💳 **Card charge** — Mercury card purchases allocated to the job

🧾 **Supply house invoice** — the job's share of allocated supply invoices

📦 **Tally part** — parts entered on the job tally

🧱 **Other job charge** — manual materials lines from Edit Job
:::

The red falls add up to the same number as the row's **Team Cost + Sub Labor + Parts Cost** columns. Items that have no date land in a **No date** bucket at the far left so the total still matches.

## Green rises — payments received

Every payment recorded on the job (Edit Job → **Payments received**) lifts the line **up**, and that rising stretch draws **green** with a 💵 marker. Once the customer has paid back more than the job has cost, the line crosses **above $0** — that's money made.

If charges and a smaller payment land on the same day, the line still nets downward (red), but the 💵 marker and the hover detail show the payment.

## The blue line — value created

Each field report that includes a completion percent steps the blue line to **that percent × the job total**. A 🚩 flag marks every report; a flag without a step is a report that didn't include a completion percent.

If the blue line is missing, the caption under the chart says why — usually the job total isn't set yet, or no report has a completion percent.

## The % column

The Job Summary table's last column, **%**, shows how complete the job is:

1. **100%** when the **whole contract is billed and paid** — every invoice on the job is **paid** and the invoiced total covers the job's **Total Bill**. One paid progress bill on a job still being worked does **not** mark it finished; the column falls through to the next two sources.
2. Otherwise the same completion percent the green line uses: the latest field report that included a completion percent.
3. Otherwise the job's **% complete** field from Edit Job, and **—** when nothing is set.

In short: a job reads 100% when its work is done or when the whole contract is billed and paid. A job with no Total Bill set but a paid invoice still reads 100% (there is no contract to compare against) — the Quickfill **Complete, no Total Bill** section lists those so the office can set the Job Total.

## Hover for detail

Hover any point to see everything that happened that day: who charged what, which invoices were allocated, payments received, who filed a report and their completion percent, plus the running **Cost**, **Paid**, **Cash position**, and **Value created** totals.
