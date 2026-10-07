---
title: read what bidding costs
category: Office
roles: dev, master_technician, controller, assistant, estimator
keywords: bid costs, pursuit, cost to bid, estimating time, clocked against a bid, hours bidding, spent bidding, hit rate, won of decided, spent on lost, card charges, robot bids, estimator rail, per bid, window, cost to win, by estimator, by GC, per $1k won, which GCs award, bid vs actual, predicted hours, recorded hours, over the book, not costed, cost it, check the count sheet, linked jobs, history, forecast, win rate by month, expected wins, odds by size, time to decision, still deciding, stale bids, click a bar
order: 73
---
Bids → Bid Costs is the pursuit ledger. It shows what it costs us to bid.

Every bid someone clocked time against shows its time. You clock time against a bid with Clock In → pick the bid. The office roles see that time priced at recorded wages. They also see any card charges or materials moved onto the bid from a job. See [move a job's costs onto a bid](/help/move-a-jobs-costs-onto-a-bid).

Dev, master and controller read dollars. Assistants and estimators read the same ledger in hours. The columns that would show a wage are simply not there.

## The four tiles

{{chip:gray|$11,487 spent bidding · 543 h}} {{chip:gray|$132 · 6.2 h per bid}}

{{chip:gray|$1.71M won of $17.2M decided}} {{chip:gray|$3,771 spent on bids we lost}}

- **Spent bidding**: everything clocked or moved onto bids in the window, and how many bids carry time.
- **Per bid with time**: spend ÷ those bids. A quick what-does-a-bid-cost-us number.
- **Won of decided**: won value over won + lost value, by dollars, not by count. The line under it is what is still open.
- **Spent on bids we lost**: the pursuit money that bought nothing, and its share of all spend.

The tiles read the whole window, not just the rows you have filtered to.

## Narrow the list

{{chip:blue|90 d}} {{chip:blue|Year}} {{chip:blue|All}} set the window. The window goes by the bid's sent date. A bid never sent goes by the day it was created. It picks which bids count, not which days of clocked time.

{{chip:yellow|Open · 48}} {{chip:green|Won · 7}} {{chip:red|Lost · 30}} {{chip:gray|Unsent · 2}} are the outcomes. You tap an outcome to hide or show it. **Won** includes bids marked Started or Complete.

Two boxes stay off unless you want them. **bids with no time** shows the dashes, which is most bids. **robot bids** shows the estimator twins' ZZ Twin / ZZ Shadow work.

You type in **Search bids…** to match a bid number, project, GC or estimator. GC means the general contractor.

## The table

There is one row per bid. It shows the bid and its GC, the estimator, and clocked time. When the time was not the estimator's, it shows who clocked it. It shows cost to bid, card charges when any bid has them, and bid value. Last is **$ per $1k bid**, the pursuit dollars for every thousand dollars of bid value. So a $500 bid on a $500k job reads 1.00. A $100 bid on a $20k job reads 5.00. The two compare honestly. The last row totals what you are looking at.

You click a row to select that bid across the workflow tabs, the same as before.

:::example Card charges count as cost
A card charge moved onto a bid arrives with the bank's sign (a debit is negative). The ledger reads it as spend, so a $37.99 charge adds $37.99 — it no longer subtracts from the clocked labor.
:::

## Cost to win

{{chip:blue|Pursuit}} {{chip:blue|Cost to win}} sit at the top of the tab. The second lens turns the same window into economics, one row per person or per GC.

{{chip:blue|By estimator}} {{chip:gray|By GC}}

Each row shows **Bids**, every bid in the window, clocked or not. Then **With time**, **Hours**, **Spent bidding**, and **Won / Lost / Open** counts. Then **Won value** and **Hit rate**, won ÷ won + lost, by value. Last is **$ per $1k won**. That is the pursuit dollars behind every thousand dollars of work that person or GC brought in. The **Everyone** row at the bottom is the whole window.

**By GC** is the one to read when you are deciding who to keep bidding for. A GC with twenty bids, no wins and a 0% hit rate is costing estimating hours. Another GC's plans would repay those hours.

You click a row to drop into the Pursuit ledger filtered to that person or GC. A {{chip:blue|Knight Contracting ×}} chip marks the filter. You tap it to clear.

:::example Counts read every bid; spend reads the clocked ones
A bid nobody clocked against still won or lost, so it counts toward the hit rate. It just adds nothing to hours or spend. That keeps the rate honest while the bid clock is young.
:::

## Bid vs actual

{{chip:gray|Pursuit}} {{chip:gray|Cost to win}} {{chip:blue|Bid vs actual}} is the third lens. It is for the jobs that are **linked to their bid**. You link them with [link bids to jobs](/help/read-the-bid-board) from a won bid's row. Or you link in bulk in Settings → Data → Link jobs to their bids. There is one row per linked job:

- **Cost to bid**, or time to bid: the pursuit spend from the ledger.
- **Bid value**: the job's price.
- **Predicted h** and **Recorded h**: the field hours the bid's count sheet predicted, and the hours actually recorded. The recorded hours are what the crew has put on the job.
- **Predicted direct $**: what the bid's snapshot said the job would cost us directly. Dollar roles only. *materials only* means a takeoff was priced but no count sheet was filled. A takeoff is the parts list counted from the plans.
- **Done**: the job's % complete. Billed and paid jobs read 100%.
- **Read**: the row's verdict.

{{chip:green|95% of hours}} means on the book. {{chip:red|138% of hours}} means over. {{chip:blue|36% of hours}} means under. {{chip:yellow|hours missing}} and {{chip:gray|not costed}} {{button:outline-blue|Cost it →}} are the other two reads.

The read uses the job's % complete when it is known. Then it compares recorded hours to what the work done so far should have used. When it is not known, it compares to the whole prediction. **Over** means more than 110% of that. A bid that was never costed says **not costed** and offers {{button:outline-blue|Cost it →}}. That selects the bid and opens its Labor tab.

:::example "check the count sheet"
A count sheet that predicts more than 15 field hours for every $1,000 of price cannot be right — that is more labor than the whole job pays. The row says so in red instead of pretending a comparison, and the fix is on the bid's Labor tab.
:::

You click a job to open its window. The first tile links to Settings → Data when more jobs need linking.

## History & forecast

{{chip:gray|Pursuit}} {{chip:gray|Cost to win}} {{chip:gray|Bid vs actual}} {{chip:blue|History & forecast}} is the fourth lens. It answers three questions from the sent bids. You pick {{chip:blue|Everyone}} or one estimator at the top. {{chip:gray|No estimator · 64}} is the bids nobody is assigned to.

**Sent by month, and how each month turned out.** There is one bar per month. It shows {{chip:green|Won}}, {{chip:red|Lost}}, {{chip:yellow|Still open}}, and a paler slice for bids still open after 120 days. The solid line is the win rate by count of the bids that have been decided. The dashed line is by value. The shaded months are inside the last 120 days. Most of their bids have not decided yet, so you read their rate lightly. You switch {{chip:blue|By count}} / {{chip:gray|By value}} to size the bars by dollars.

**You click any bar slice** and a window opens with the bids in it. Each shows bid and GC, estimator, sent date, value, outcome, and decided date, largest first. Across the top sit the month's chips. They read {{chip:green|Won · 2 · $146k}} {{chip:red|Lost · 24 · $1.60M}} {{chip:yellow|Still open · 0}}. You tap one to switch slices in place. {{button:outline|‹ month}} {{button:outline|month ›}}, or the ← → keys, step to the neighbouring month keeping the same slice. The small bar under them shows the whole month with your slice outlined. A ***By estimator · By GC*** row says who the slice is made of. You tap a name to narrow the list. You click a bid to open it on top. You close it and you are back on the list. {{button:outline-blue|Copy list}} puts the bids on the clipboard as text. Esc closes.

Every other number on the lens opens the same window. That includes the odds cards, the age buckets, the forecast tiles, and a person's row.

**How long a decision takes.** This is the days from sent to the day someone marked the bid won or lost. Bids only started recording that day on 2026-09-11. So this panel says *not enough yet* until five decisions carry a date. Then it shows the median, the fastest and slowest tenth, and a figure per month. Under it sit the open bids by how long they have waited. The two amber buckets are past 120 days.

**The odds we use.** This is the win rate by count on bids sent 120+ days ago, split by size. The sizes are under $50k, $50k–$500k, and over $500k. Small bids win far more often than big ones. That is why the forecast does not use one blended rate. You click a card to see the bids behind it. A person with ten or more decided bids uses their own odds per size. Fewer uses everyone's, and the heading says so.

**What's open, and what to expect from it.** These are the open bids sent in the last 120 days, each counted at the odds of its size. It shows how many wins to expect, how much value, and a likely range. It names the one bid that is the biggest share of it. That bid is counted at its own odds. If bids that size have never won, it counts for nothing until one does. The table breaks it down by estimator. You click a row to list that person's fresh open bids.

:::example Why 120 days?
Bids open past 120 days are more often forgotten than pending — of the ones open today, most are past 90 days and a handful past half a year. Counting them would inflate the forecast, so the lens sets them aside and names them; Followup → Waiting to hear is where to chase or mark them.
:::

## The rail

**By estimator** lists who is spending the bidding time in this window, largest first. You click a name to see only their bids. You click again to clear. **By outcome** sums the same window by Open / Won / Lost / Unsent.

:::example The clock is young
Clocking time against a bid started on 2026-03-20. Won work from before then carries no pursuit time, so the Won tile and rail look thin next to Open and Lost for a while yet.
:::
