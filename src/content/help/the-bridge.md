---
title: read the Bridge
category: Money
roles: dev
keywords: bridge, net position, cash forecast, cash on hand, cash floor, bills due, receipts expected, profit rate, overhead, earned revenue
order: 62
---
**The Bridge** (devs only for now — the compass icon in the header, or **Bridge** in the ☰ menu; `/bridge`) answers three questions on one page: where we stand, where cash is going, and what would change it. One clock — days.

## First, type cash on hand

The app doesn't sync a bank balance, so the cash line starts from a number you type. Under the cash chart, enter today's bank balance in **Cash on hand today** and {{button:outline|Set}}. It's remembered with the date; on later days the page rolls it forward through the bank transactions since, and the Data Gaps strip says which day you typed it. Retype it whenever you look at the bank.

Set the **Floor** the same way — the cash level you never want to go under (it starts at $5,000).

## The three numbers on top

- **Daily profit rate** — earned per day minus costs per day, over the last 14 days. Costs are job costs (field labor, purchases and supply invoices on jobs, sub sheets) plus overhead at the 90-day rate from People → Overhead.
- **Money owed** — owed to you (collections excluded), owed by you, finished work not yet billed, and the collections balance written off for planning.
- **Crew hours** — approved field time in the last 7 days, office and bid time, and how much still awaits approval.

## Net position — last 8 weeks

The solid line is **cash + owed to you − owed by you**, today's real number, with the last 8 weeks rebuilt from dated flows: bank transactions, invoices sent, payments received, supply invoices dated and paid. The readout says where it is today and how much it moved since the start of the window. Hover any day for the split.

## Cash — next 8 weeks

The dashed line starts at cash today. It **drops on the day each bill is due** — supply invoices by due date, sub labor by its payable-after date, payroll every Friday at the 8-week average — and **rises on the day each receipt is expected**: a promised pay date if the customer named one, otherwise that customer's usual pay speed, otherwise the company's, otherwise 45 days. Collections never count. Office parts drain a little every day at the 90-day rate.

The readout is a date and a number: **the lowest cash point in the window and whether it clears your floor.** The dot on the line marks it.

:::example What the lists under the chart are
**Bills coming due** and **Receipts expected** are the same events the chart uses, day by day, with the reason for each receipt date. **What would change it** sizes the levers — billing finished work, approving pending hours, trimming overhead, an extra field day, a bid due soon.
:::

## Data gaps

When the amber strip shows, the numbers read low or thin: unapproved hours, unsorted bank transfers or card purchases, open jobs with no % complete (assumed half done), worked jobs with no contract price, or a typed cash figure that's a few days old. Insurance, rent, and card bills aren't scheduled as bills yet — they arrive as bank transfers and only show once sorted.
