---
title: read the cost and value timeline on a job
category: Billing & Money
roles: dev, master_technician, assistant
keywords: job summary, chart, timeline, cost, expense, value created, reports, card charges, supply house, tally, sub labor, payments, net, burn, budget, percent complete, at completion, projected margin, overhead, budget, bid estimate, link this bid, typed budget, assumed, refresh from bid
order: 30
---
Every expanded job on Jobs → Job Summary starts with a timeline chart of its money. It shows cost so far, what the customer has paid back, and the value the crew reports.

## The verdict: four numbers that are always true

The Costs tab opens with what the job is doing, measured against the **price**, never against a guess:

{{chip:green|True margin at completion · $7,782 · 6%}} {{chip:gray|Spent so far · $80,600}}

{{chip:gray|Earned so far · $95,172}} {{chip:gray|Time left · ≈ 22 working days}}

- **True margin at completion**: the price, minus the direct cost at completion, minus the job's overhead share. The direct cost at completion is spent ÷ % done, the cost the job will reach at today's pace. Overhead is the office's running cost. The line under it shows the direct margin alone. Green when positive, red when not. It reads *too early* until the job has three field days and 10 %.
- **Spent so far**: direct cost to date and its share of the price. The team hours and materials behind it are shown too.
- **Earned so far**: % done × the price, and how far ahead or behind the spend that is. This is the honest yardstick. It needs no budget.
- **Time left**: working days at the pace so far, with what a field day costs. The pace is the % of the work done per field day.

The line above the tiles names the report that set the % and how old it is. It says when the job's own % disagrees. A % typed on the job after that report is the newer word. Then the line reads *(set on the job)* instead. The chart's value line steps on the day it was typed, without a report flag.

**Click the margin tile** to see how it builds by section. The sections are labor, materials, subs and other. Subs are the subcontractors. Each shows spent so far, where it lands at completion, and what the bid carried for it. Then overhead, true cost, price and the margin as the sum. When the bid was sent without hours, the bid column says so instead of pretending a budget. It reads *no hours on B66*.

## The baseline strip: collecting instead of guessing

Under the tiles, one strip says where this job stands with the labor book:

- {{chip:yellow|No baseline for this job yet — bid B66 was sent without hours}}: most jobs today. What the job has taken so far is the baseline. For example: **959 h** team, **7.8 h** per $1k of price and **$34.22/h** average wage. Then **13** people and **$46,376** materials, 38 % of price. {{button:gray|Count sheet on B66 →}} opens the bid's Counts tab. {{button:gray|Take its estimate}} appears when the bid has an estimate. A job with no bid at all offers {{button:gray|Link the bid ▾}}. It folds open the bid finder and the typed budget.
- {{chip:green|◆ Baseline from B76 · 36 h predicted}}: the bid carried hours. The strip reads the recorded hours against them for the work done so far. It reads *17 % of the bid's hours at 50 % done · the book was heavy here*. {{button:gray|Refresh from bid ↻}} takes the estimate again. {{button:gray|Clear}} drops it.

**Keeping the baseline.** When a job bills, what it took is kept on its own. That is hours, wages, people, materials and price, as hours per $1k. It is also kept by fixture when the bid had a count sheet. The strip then reads {{chip:green|Baseline kept Sep 12 on billing · per $1k}}. Fold open **By fixture** to see the split. Mid-job, {{button:blue|Keep as baseline}} keeps it now and {{button:gray|Keep again ↻}} refreshes it. Bids → Labor reads every kept baseline as the **Jobs baseline** tile.

## The chart, and the detail behind the toggle

One chart. It draws **cost to date** against **value earned**. Value earned is % done × price, stepping at each report. The price is a faint line. The bid figure is a dashed line, only when one exists. The forecast at today's pace is drawn too. {{button:gray|Show the timeline · daily spend ▾}} reveals the 14-day daily spend and the burn rate and work-left rows. It also opens the full Cost Timeline described below.

## Burn: are we spending faster than we are finishing?

Owners, controllers and master techs see a **Burn** section in the job window's **Costs** tab. It sits at the top, above the chart. Four tiles:

- **Spent to date**: team labor, sub labor and parts. These are the same direct costs the chart draws.
- **Budget**: the bid's estimated cost, once estimates are snapshotted onto jobs. The snapshot must carry both a labor figure and a materials figure. Until then, take 100 minus your Job Summary **Target** margin. The budget is the job's price × that percent. The same rule applies when the bid only carried hours, driving or a takeoff. The header says which rule it used. The Budget card says when the job as a whole is still on the assumption.
- **% of budget vs % done**: the tell. The left number is spend. The right is the latest field report's percent complete. {{chip:red|68% vs 62%}} means the crew has burned more of the budget than they have finished. It turns red past five points.
- **At completion**: spent ÷ percent done, and the margin that leaves against the price. Under it, the job's **overhead share** and the **true margin** after it. The overhead share is Job Summary's day-share so far, plus today's rate × the working days still to come. Overhead never touches the burn signal. It only sharpens the projection.

Below the tiles: **daily spend bars** for the last 14 working days with a 7-day average. Then the **cumulative chart** with the budget as a dashed ceiling. Earned value steps up at each report. A dotted forecast runs to the day the budget runs out at today's burn. Then three plain rows. One is the burn rate per field day. One is when the budget runs out. One is how many working days of work are left at the current pace.

A job under three field days or under 10% reads *too early to call* instead of guessing.

The same verdict shows up in two more places. One is Job Summary's **Burn** and **Proj. margin** columns. The other is the Pipeline's *jobs burning ahead of progress* card under Today's money opportunities.

:::example Reading a hot job
Spent $19,860 of a $29,200 budget (68%) at 62% done. At completion: $32,032, margin $16,668 (34% against a 40% bid). Plus $4,140 overhead → true margin $12,528 (26%). Budget runs out Sep 17 with 38% of the work left. Time to look at why.
:::

## Open it

Go to **Jobs → Job Summary** and click any job row. The row expands with a quick header. It has {{button:outline-blue|Job Detail}} and {{button:outline|Edit Job}} links. It has the same **Assigned / HCP / Last activity** info you see on the Pipeline. The **Cost breakdown** follows, with the chart at the top.

The same chart opens the job window's **Costs** tab, the money-out tab beside Bill. The **Team** and **Sub Labor** lines and the parts accordions sit under it. The Job tab's Costs card names the 👷 total in one number. Owners, controllers and master techs see that card. The marker key sits right under every chart, always visible. A job may have many transaction days. Then the chart widens and **scrolls left to right** instead of crushing the icons together.

## The overhead band: true cost on top of cost

Your role may see overhead on Job Summary. Then the chart stacks the job's overhead on the red line as an **amber band**. The band's top edge is **true cost**. That is charges plus the overhead landed on the job so far. It is labeled at the end beside cost to date. Overhead lands day by day. So between two charges it folds into the next charge's step. Anything landed after the last charge adds one final point on the right. The band keeps growing while the job stays open, exactly as the Job Summary row charges it. The source icons sit on the band's top edge. The green line does not move. It is still cash, not a margin. Under the A / B / C overhead lenses there is no band. In the job window's Costs tab the band covers the whole job. Office cost only exists from Feb 19, 2026. So on an older job the legend adds *since Feb 19, 2026, where office cost begins* and the band starts there.

## The cash position line: money out vs money in

The main line is the job's **cash position: payments received minus what it has cost**. That is money in hand on the job so far, not a margin. Job Summary carries gross and true profit. It steps **down in red** every day money went into the job. It steps **up in green** every day a payment came in. A dashed line marks **$0**. Above it, the job has collected more than it cost. The bold label at the end of the line is the job's current cash position, for example **+$166.21**. If your role can't see wages, the legend reads *cash position before team labor*. The same job reads higher for you than for the owner, because crew wages are not charged on your chart.

Each red step is tagged with an icon for where the cost came from:

:::example Cost sources
👷 **Team labor** — crew hours on the job, from **recorded** clock time: every closed session that wasn't rejected, whether or not it's been approved yet. A salaried day counts as 8 h on the job it was clocked to, from the moment the person clocks in. Approval is the payroll gate, not the costing gate.

🔧 **Sub labor** — sub sheet ledger jobs matched by HCP #

💳 **Card charge** — Mercury card purchases allocated to the job. A refund at the counter (Lowe's, Home Depot, O'Reilly) comes back through the same card and shows as a negative charge marked *refund* — it nets off the job's parts instead of adding to them.

⛽ **Fuel** — the card charges in the fuel tag (an accounting label in Fuel & gas, or, with no label, fuel by the bank's category), on the day each was bought. On a long job this is where you see which days fuel landed on it. The card line and the fuel line together are exactly what the job's parts cost counts: an Internal Transfer is not on either, and a charge that is also on a supply-house invoice is counted once, under the invoice.

🧾 **Supply house invoice** — the job's share of allocated supply invoices

📦 **Tally part** — parts entered on the job tally

🧱 **Other job charge** — manual materials lines from Edit Job
:::

The red falls add up to one number. It matches the row's **Team Cost + Sub Labor + Parts Cost** columns. Items that have no date land in a **No date** bucket at the far left, so the total still matches.

## Green rises: payments received

Every payment recorded on the job lifts the line **up**. You record them at Edit Job → **Payments received**. That rising stretch draws **green** with a 💵 marker. Once the customer has paid back more than the job has cost, the line crosses **above $0**. That's money made.

If charges and a smaller payment land on the same day, the line still nets downward in red. The 💵 marker and the hover detail still show the payment.

## The blue line: value created

Each field report that includes a completion percent steps the blue line to **that percent × the job total**. A 🚩 flag marks every report. A flag without a step is a report that didn't include a completion percent.

If the blue line is missing, the caption under the chart says why. Usually the job total isn't set yet, or no report has a completion percent.

## The % column

The Job Summary table's last column, **%**, shows how complete the job is:

1. **100%** when the **whole contract is billed and paid**. That means every invoice on the job is **paid** and the invoiced total covers the job's **Total Bill**. One paid progress bill on a job still being worked does **not** mark it finished. The column falls through to the next two sources.
2. Otherwise the same completion percent the green line uses. That is the latest field report that included a completion percent.
3. Otherwise the job's **% complete** field from Edit Job. It shows a dash when nothing is set.

In short, a job reads 100% when its work is done or when the whole contract is billed and paid. A job with no Total Bill set but a paid invoice still reads 100%. There is no contract to compare against. The Quickfill **Complete, no Total Bill** section lists those so the office can set the Job Total.

## Hover for detail

Hover any point to see everything that happened that day. That is who charged what, which invoices were allocated, payments received, and who filed a report with their completion percent. It also shows the running **Cost**, **Overhead to date**, **Paid**, **Cash position** and **Value created** totals. Overhead to date is split into *by hours* and *carry*, with true cost.
