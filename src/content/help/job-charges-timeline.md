---
title: read the cost and value timeline on a job
category: Billing & Money
roles: dev, master_technician, assistant
keywords: job summary, chart, timeline, cost, expense, value created, reports, card charges, supply house, tally, sub labor, payments, net, burn, budget, percent complete, at completion, projected margin, overhead, budget, bid estimate, link this bid, typed budget, assumed, refresh from bid
order: 30
---
Every expanded job on **Jobs → Job Summary** starts with a timeline chart of the money on that job: what it has cost you so far, what the customer has paid back, and how much value the crew reports having created.

## The verdict — four numbers that are always true

The Costs tab opens with what the job is doing, measured against the **price**, never against a guess:

{{chip:green|True margin at completion · $7,782 · 6%}} {{chip:gray|Spent so far · $80,600}} {{chip:gray|Earned so far · $95,172}} {{chip:gray|Time left · ≈ 22 working days}}

- **True margin at completion** — the price, minus the direct cost the job will reach at today's pace (spent ÷ % done), minus the job's overhead share. The line under it shows the direct margin alone. Green when positive, red when not; *too early* until the job has three field days and 10 %.
- **Spent so far** — direct cost to date and its share of the price, with the team hours and materials behind it.
- **Earned so far** — % done × the price, and how far ahead or behind the spend that is. This is the honest yardstick: it needs no budget.
- **Time left** — working days at the pace so far (the % of the work done per field day), with what a field day costs.

The line above the tiles names the report that set the % and how old it is, and says when the job's own % disagrees.

**Click the margin tile** to see how it builds by section: labor, materials, subs and other, each with spent so far, where it lands at completion, and what the bid carried for it — then overhead, true cost, price and the margin as the sum. When the bid was sent without hours, the bid column says so (*no hours on B66*) instead of pretending a budget.

## The baseline strip — collecting instead of guessing

Under the tiles, one strip says where this job stands with the labor book:

- {{chip:yellow|No baseline for this job yet — bid B66 was sent without hours}} — most jobs today. What the job has taken so far *is* the baseline: **959 h** team · **7.8 h** per $1k of price · **$34.22/h** average wage · **13** people · **$46,376** materials (38 % of price). {{button:gray|Count sheet on B66 →}} opens the bid's Counts tab; {{button:gray|Take its estimate}} appears when the bid has an estimate. A job with no bid at all offers {{button:gray|Link the bid ▾}}, which folds open the bid finder and the typed budget.
- {{chip:green|◆ Baseline from B76 · 36 h predicted}} — the bid carried hours: the strip reads the recorded hours against them for the work done so far ("17 % of the bid's hours at 50 % done · the book was heavy here"). {{button:gray|Refresh from bid ↻}} takes the estimate again; {{button:gray|Clear}} drops it.

## The chart, and the detail behind the toggle

One chart: **cost to date** against **value earned** (% done × price, stepping at each report), the price as a faint line, the bid figure as a dashed line only when one exists, and the forecast at today's pace. {{button:gray|Show the timeline · daily spend ▾}} reveals the 14-day daily spend, the burn rate and work-left rows, and the full Cost Timeline described below.
## Burn — are we spending faster than we are finishing?

Owners, controllers and master techs see a **Burn** section at the top of the job window's **Costs** tab, above the chart. Four tiles:

- **Spent to date** — team labor, sub labor and parts, the same direct costs the chart draws.
- **Budget** — the bid's estimated cost once estimates are snapshotted onto jobs; until then, the job's price × (100 − your Job Summary **Target** margin). The header says which rule it used.
- **% of budget vs % done** — the tell. The left number is spend, the right is the latest field report's percent complete. {{chip:red|68% vs 62%}} means the crew has burned more of the budget than they have finished; it turns red past five points.
- **At completion** — spent ÷ percent done, and the margin that leaves against the price. Under it, the job's **overhead share** (Job Summary's day-share so far, plus today's rate × the working days still to come) and the **true margin** after it. Overhead never touches the burn signal; it only sharpens the projection.

Below the tiles: **daily spend bars** for the last 14 working days with a 7-day average, the **cumulative chart** with the budget as a dashed ceiling, earned value stepping up at each report, and a dotted forecast to the day the budget runs out at today's burn; then three plain rows — burn rate per field day, when the budget runs out, and how many working days of work are left at the current pace.

A job under three field days or under 10% reads *too early to call* instead of guessing.

The same verdict shows up in two more places: Job Summary's **Burn** and **Proj. margin** columns, and the Pipeline's *jobs burning ahead of progress* card under Today's money opportunities.

:::example Reading a hot job
Spent $19,860 of a $29,200 budget (68%) at 62% done. At completion: $32,032, margin $16,668 (34% against a 40% bid). Plus $4,140 overhead → true margin $12,528 (26%). Budget runs out Sep 17 with 38% of the work left. Time to look at why.
:::

## Open it

Go to **Jobs → Job Summary** and click any job row. The row expands with a quick header — {{button:outline-blue|Job Detail}} and {{button:outline|Edit Job}} links plus the same **Assigned / HCP / Last activity** info you see on the Pipeline — followed by the **Cost breakdown** with the chart at the top.

The same chart opens the job window's **Costs** tab — the money-out tab beside Bill — with the **Team** and **Sub Labor** lines and the parts accordions under it; the Job tab's Costs card names the 👷 total in one number (owners, controllers and master techs). The marker key sits right under every chart, always visible. When a job has many transaction days, the chart widens and **scrolls left–right** instead of crushing the icons together.

## The overhead band — true cost on top of cost

If your role sees overhead on Job Summary, the chart stacks the job's overhead on the red line as an **amber band**. The band's top edge is **true cost** (charges plus the overhead landed on the job so far) and it is labeled at the end beside cost to date. Overhead lands day by day, so between two charges it folds into the next charge's step, and anything landed after the last charge adds one final point on the right — the band keeps growing while the job stays open, exactly as the Job Summary row charges it. The source icons sit on the band's top edge. The green line does not move: it is still cash, not a margin. Under the A / B / C overhead lenses there is no band. In the job window's Costs tab the band covers the whole job; office cost only exists from Feb 19, 2026, so on an older job the legend adds *since Feb 19, 2026, where office cost begins* and the band starts there.

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

Hover any point to see everything that happened that day: who charged what, which invoices were allocated, payments received, who filed a report and their completion percent, plus the running **Cost**, **Overhead to date** (split into *by hours* and *carry*, with true cost), **Paid**, **Cash position**, and **Value created** totals.
