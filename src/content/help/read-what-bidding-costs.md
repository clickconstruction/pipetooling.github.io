---
title: read what bidding costs
category: Office
roles: dev, master_technician, controller, assistant, estimator
keywords: bid costs, pursuit, cost to bid, estimating time, clocked against a bid, hours bidding, spent bidding, hit rate, won of decided, spent on lost, card charges, robot bids, estimator rail, per bid, window, cost to win, by estimator, by GC, per $1k won, which GCs award, bid vs actual, predicted hours, recorded hours, over the book, not costed, cost it, check the count sheet, linked jobs, history, forecast, win rate by month, expected wins, odds by size, time to decision, still deciding, stale bids, click a bar
order: 73
---
**Bids → Bid Costs** is the pursuit ledger: what it costs us to bid. Every bid someone clocked time against (Clock In → pick the bid) shows its time, and the office roles see that time priced at recorded wages, plus any card charges or materials moved onto the bid from a job ([move a job's costs onto a bid](move-a-jobs-costs-onto-a-bid)).

Dev, master and controller read dollars. Assistants and estimators read the same ledger in hours — the columns that would show a wage are simply not there.

## The four tiles

{{chip:gray|$11,487 spent bidding · 543 h}} {{chip:gray|$132 · 6.2 h per bid}} {{chip:gray|$1.71M won of $17.2M decided}} {{chip:gray|$3,771 spent on bids we lost}}

- **Spent bidding** — everything clocked or moved onto bids in the window, and how many bids carry time.
- **Per bid with time** — spend ÷ those bids. A quick "what does a bid cost us" number.
- **Won of decided** — won value over won + lost value, by dollars, not by count. The line under it is what's still open.
- **Spent on bids we lost** — the pursuit money that bought nothing, and its share of all spend.

The tiles read the whole window, not just the rows you have filtered to.

## Narrow the list

{{chip:blue|90 d}} {{chip:blue|Year}} {{chip:blue|All}} — the window goes by the bid's sent date (or the day it was created if it was never sent). It picks which bids count, not which days of clocked time.

{{chip:yellow|Open · 48}} {{chip:green|Won · 7}} {{chip:red|Lost · 30}} {{chip:gray|Unsent · 2}} — tap an outcome to hide or show it. **Won** includes bids marked Started or Complete.

Two boxes stay off unless you want them: **bids with no time** (the dashes — most bids) and **robot bids** (the estimator twins' ZZ Twin / ZZ Shadow work).

Type in **Search bids…** to match a bid number, project, GC or estimator.

## The table

One row per bid: the bid and its GC, the estimator, clocked time (with who clocked it when it wasn't the estimator), cost to bid, card charges when any bid has them, bid value, and **$ per $1k bid** — pursuit dollars for every thousand dollars of bid value, so a $500 bid on a $500k job (1.00) and a $100 bid on a $20k job (5.00) compare honestly. The last row totals what you're looking at.

Click a row to select that bid across the workflow tabs, the same as before.

:::example Card charges count as cost
A card charge moved onto a bid arrives with the bank's sign (a debit is negative). The ledger reads it as spend, so a $37.99 charge adds $37.99 — it no longer subtracts from the clocked labor.
:::

## Cost to win

{{chip:blue|Pursuit}} {{chip:blue|Cost to win}} — the second lens at the top of the tab turns the same window into economics, one row per person or per GC.

{{chip:blue|By estimator}} {{chip:gray|By GC}}

Each row: **Bids** (every bid in the window, clocked or not), **With time**, **Hours**, **Spent bidding**, **Won / Lost / Open** counts, **Won value**, **Hit rate** (won ÷ won + lost, by value), and **$ per $1k won** — the pursuit dollars behind every thousand dollars of work that person or GC brought in. The **Everyone** row at the bottom is the whole window.

**By GC** is the one to read when you're deciding who to keep bidding for: a GC with twenty bids, no wins and a 0% hit rate is costing estimating hours that another GC's plans would repay.

Click a row to drop into the Pursuit ledger filtered to that person or GC — a {{chip:blue|Knight Contracting ×}} chip marks the filter; tap it to clear.

:::example Counts read every bid; spend reads the clocked ones
A bid nobody clocked against still won or lost, so it counts toward the hit rate. It just adds nothing to hours or spend. That keeps the rate honest while the bid clock is young.
:::

## Bid vs actual

{{chip:gray|Pursuit}} {{chip:gray|Cost to win}} {{chip:blue|Bid vs actual}} — the third lens is for the jobs that are **linked to their bid** ([link bids to jobs](read-the-bid-board) from a won bid's row, or in bulk in Settings → Data → Link jobs to their bids). One row per linked job:

- **Cost to bid** (or time to bid) — the pursuit spend from the ledger.
- **Bid value** — the job's price.
- **Predicted h** and **Recorded h** — the field hours the bid's count sheet predicted, and the hours the crew has actually recorded on the job.
- **Predicted direct $** — what the bid's snapshot said the job would cost us directly (dollar roles only). *materials only* means a takeoff was priced but no count sheet was filled.
- **Done** — the job's % complete (billed and paid jobs read 100%).
- **Read** — the row's verdict.

{{chip:green|95% of hours}} on the book · {{chip:red|138% of hours}} over · {{chip:blue|36% of hours}} under · {{chip:yellow|hours missing}} · {{chip:gray|not costed}} {{button:outline-blue|Cost it →}}

The read compares recorded hours to the hours the work *done so far* should have used when the job's % complete is known, and to the whole prediction when it is not. **Over** means more than 110% of that. A bid that was never costed says **not costed** and offers {{button:outline-blue|Cost it →}}, which selects the bid and opens its Labor tab.

:::example "check the count sheet"
A count sheet that predicts more than 15 field hours for every $1,000 of price cannot be right — that is more labor than the whole job pays. The row says so in red instead of pretending a comparison, and the fix is on the bid's Labor tab.
:::

Click a job to open its window. The first tile links to Settings → Data when more jobs need linking.

## History & forecast

{{chip:gray|Pursuit}} {{chip:gray|Cost to win}} {{chip:gray|Bid vs actual}} {{chip:blue|History & forecast}} — the fourth lens answers three questions from the sent bids. Pick {{chip:blue|Everyone}} or one estimator at the top; {{chip:gray|No estimator · 64}} is the bids nobody is assigned to.

**Sent by month, and how each month turned out.** One bar per month: {{chip:green|Won}}, {{chip:red|Lost}}, {{chip:yellow|Still open}}, and a paler slice for bids still open after 120 days. The solid line is the win rate by count of the bids that have been decided; the dashed line is by value. The shaded months are inside the last 120 days — most of their bids haven't decided yet, so read their rate lightly. Switch {{chip:blue|By count}} / {{chip:gray|By value}} to size the bars by dollars.

**Click any bar slice** and a window opens with the bids in it — bid and GC, estimator, sent date, value, outcome, decided date, largest first. Across the top, the month's {{chip:green|Won · 2 · $146k}} {{chip:red|Lost · 24 · $1.60M}} {{chip:yellow|Still open · 0}} chips switch slices in place, and {{button:outline|‹ month}} {{button:outline|month ›}} (or ← →) step to the neighbouring month keeping the same slice; the small bar under them shows the whole month with your slice outlined. A **By estimator · By GC** row says who the slice is made of; tap a name to narrow the list. Click a bid to open it on top — close it and you're back on the list. {{button:outline-blue|Copy list}} puts the bids on the clipboard as text. Esc closes.

Every other number on the lens — the odds cards, the age buckets, the forecast tiles, a person's row — opens the same window.

**How long a decision takes.** Days from sent to the day someone marked the bid won or lost. Bids only started recording that day on 2026-09-11, so this panel says *not enough yet* until five decisions carry a date, then shows the median, the fastest and slowest tenth, and a figure per month. Under it, the open bids by how long they've waited; the two amber buckets are past 120 days.

**The odds we use.** The win rate by count on bids sent 120+ days ago, split by size: under $50k, $50k–$500k, over $500k. Small bids win far more often than big ones, which is why the forecast doesn't use one blended rate. Click a card to see the bids behind it. A person with ten or more decided bids uses their own odds per size; fewer uses everyone's, and the heading says so.

**What's open, and what to expect from it.** The open bids sent in the last 120 days, each counted at the odds of its size: how many wins to expect, how much value, a likely range, and the one bid that is the biggest share of it (counted at its own odds — if bids that size have never won, it counts for nothing until one does). The table breaks it down by estimator; click a row to list that person's fresh open bids.

:::example Why 120 days?
Bids open past 120 days are more often forgotten than pending — of the ones open today, most are past 90 days and a handful past half a year. Counting them would inflate the forecast, so the lens sets them aside and names them; Followup → Waiting to hear is where to chase or mark them.
:::

## The rail

**By estimator** lists who is spending the bidding time in this window, largest first. Click a name to see only their bids; click again to clear. **By outcome** sums the same window by Open / Won / Lost / Unsent.

:::example The clock is young
Clocking time against a bid started on 2026-03-20. Won work from before then carries no pursuit time, so the Won tile and rail look thin next to Open and Lost for a while yet.
:::
