---
title: see profit by month on Job Summary
category: Office
roles: dev, master_technician, controller
keywords: months, monthly P&L, profit by month, revenue by month, overhead by month, work month, bill month, job summary, true profit, target margin
order: 39
---

**Job Summary → Months** is the monthly P&L, read off the same jobs and the same day ledger as the rest of the tab. One bar per month: revenue split into what it cost and what was left.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Months}}. **Show** and **Worked in** work as they do on the Jobs view, so the months add up to the same jobs the table shows.

## Reading a bar

Each bar is a month's revenue, stacked from the bottom:

- {{chip:blue|labor}} — team labor on the jobs
- {{chip:yellow|subs}} — sub labor sheets
- {{chip:blue|parts}} — tally, supply invoices, billed materials, card charges
- {{chip:purple|overhead}} — the month's **whole** overhead pool: office labor, bid labor, office parts
- {{chip:green|true profit}} — what's left, with the true margin written above the bar

A month that lost money stacks its loss in red above the revenue line. Hover a month for the full split and the field hours.

:::example Why overhead here matches the Overhead tab
The Jobs view shares each day's overhead across the jobs worked that day. Months doesn't need to: a month's overhead is simply that month's pool, unallocated days included. The Overhead tile shows how much fell on days with no field work.
:::

## Work month or bill month

**Book by** decides which month a job belongs to.

- {{chip:blue|work month}} spreads each job's revenue and costs over the months it was worked, in proportion to its approved field hours. A two-week job across a month end lands in both months. Jobs with no approved hours in the window can't be placed and are counted in the footnote.
- {{chip:blue|bill month}} books each job whole to the month its last bill went out. Unbilled jobs sit out, counted in the footnote.

Work month is the honest picture of what the crew earned each month. Bill month matches the invoices.

## Target and Compare to

With **Target** on, a dashed tick on every bar shows where profit would start at the target margin, months under it get a red ▾, and a tile counts them. With **Compare to** on, the True profit, Revenue, and Overhead tiles show the change against the prior period or last year.

## Watch-outs

- In-progress jobs contribute earned revenue (contract × % complete), the same rule as the Jobs view. Switch **Show** to Finished for billed money only.
- The window's first and last months are partial. A half month reads low next to its neighbours; that's the calendar, not the crew.
