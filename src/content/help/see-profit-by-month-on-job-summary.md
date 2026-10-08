---
title: see profit by month on Job Summary
category: Office
roles: dev, master_technician, controller
keywords: months, monthly P&L, profit by month, revenue by month, overhead by month, work month, bill month, job summary, true profit, target margin
order: 39
---

The Months view on Job Summary is the monthly profit and loss. One bar per month shows what each month earned and what it cost.

**Job Summary → Months** is the monthly P&L, the profit and loss. It reads the tab's same jobs and its day ledger, the daily record of field hours and office costs. One bar per month shows revenue split into what it cost and what was left.

## Where it is

You go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Months}}. **Show** and **Worked in** work as they do on the Jobs view. So the months add up to the same jobs the table shows.

## Reading a bar

Each bar is a month's revenue, stacked from the bottom:

- {{chip:blue|labor}} is team labor on the jobs
- {{chip:yellow|subs}} is sub labor sheets
- {{chip:blue|parts}} is tally, supply invoices, billed materials, card charges
- {{chip:purple|overhead}} is the month's **whole** overhead pool: office labor, bid labor, office parts
- {{chip:green|true profit}} is what is left, with the true margin, its share of revenue, written above the bar

A month that lost money stacks its loss in red above the revenue line. You hover a month for the full split and the field hours.

:::example Why overhead here matches the Overhead tab
The Jobs view shares each day's overhead across the jobs worked that day. Months doesn't need to: a month's overhead is simply that month's pool, unallocated days included. The Overhead tile shows how much fell on days with no field work.
:::

## Work month or bill month

**Book by** decides which month a job belongs to.

- {{chip:blue|work month}} spreads each job's revenue and costs over the months it was worked. The share follows its approved field hours. A two-week job across a month end lands in both months. A job with no approved hours in the window cannot be placed. The footnote counts those jobs.
- {{chip:blue|bill month}} books each job whole to the month its last bill went out. Unbilled jobs sit out. The footnote counts them.

Work month is the honest picture of what the crew earned each month. Bill month matches the invoices.

## Target and Compare to

You turn **Target** on. Then a dashed tick on every bar shows where profit would start at the target margin. Months under it get a red ▾. A tile counts them. You turn **Compare to** on. Then the True profit, Revenue, and Overhead tiles show the change against the prior period or last year.

## Watch-outs

- In-progress jobs contribute earned revenue. Each field hour earns its share of the contract. That is the same rule as the Jobs view. You switch **Show** to Finished for billed money only.
- The window's first and last months are partial. A half month reads low next to its neighbours. That is the calendar, not the crew.
