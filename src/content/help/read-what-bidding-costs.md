---
title: read what bidding costs
category: Office
roles: dev, master_technician, controller, assistant, estimator
keywords: bid costs, pursuit, cost to bid, estimating time, clocked against a bid, hours bidding, spent bidding, hit rate, won of decided, spent on lost, card charges, robot bids, estimator rail, per bid, window
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

## The rail

**By estimator** lists who is spending the bidding time in this window, largest first. Click a name to see only their bids; click again to clear. **By outcome** sums the same window by Open / Won / Lost / Unsent.

:::example The clock is young
Clocking time against a bid started on 2026-03-20. Won work from before then carries no pursuit time, so the Won tile and rail look thin next to Open and Lost for a while yet.
:::
