---
title: refresh a takeoff's prices to today's book
category: Bids & Estimating
roles: dev, master_technician, assistant, estimator
keywords: refresh prices, today's book, takeoff prices, stale prices, price book, material prices, gap, revise, sent bid, materials at today's book
order: 84
---
A takeoff keeps the price each part had when you picked it. The book keeps changing. Takeoffs tells you when the two drift apart, and lets you catch the takeoff up.

## The blue line on Takeoffs

- When book prices on a takeoff moved since you picked them, a blue line shows above the rows.
- It says how many prices moved. It also says what the materials would cost at today's book, as dollars and a share.
- Open *See the lines* to read each part, its house, the price you picked and today's price.

## Refresh prices

- Press {{button:blue|Refresh prices}} on the blue line. A window asks you to confirm.
- Each line priced from the book takes today's price from the same supply house.
- Prices you typed yourself stay as they are.

## A sent bid

- A sent bid keeps the prices it was sent with. The blue line still shows the gap, but it has no button.
- To refresh a sent bid, press {{button:outline|Revise…}} on the Pricing header first. Then come back to Takeoffs.

## On Pricing

- Pricing shows the same gap in one line under the sent date.
- Press *See Takeoffs* on that line to go to the takeoff.

## A price that looks wrong

- A book price that jumped to one and a half times or more is left out. So is one that fell to half or less, and a $999,999 stand-in.
- An amber note names it, with what it was on this takeoff.
- Press *Fix it in Materials* to fix the book price on the Parts Book.

:::example BP343 on Oct 2, 2026
2 prices on this takeoff moved in the book. At today's book these materials cost $495 less. Both were the 2005_02 floor drain at Reece, down from $151.44 to $101.92.
:::
