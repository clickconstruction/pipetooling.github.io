---
title: see how fast jobs turn into cash
category: Office
roles: dev, master_technician, assistant, controller
keywords: cycle, work to bill, bill to paid, days to pay, slowest payer, stale jobs, idle jobs, open jobs, job summary, cash cycle
order: 40
---

Profit says what a job made. **Cycle** says how long it took to become money, and which jobs are sitting open with nobody on them.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Cycle}}. **Show** and **Worked in** pick the jobs, the same as the Jobs view.

## The two lags

Every billed job has two numbers, read off dates already on it:

- **Work → bill** — from the last approved field day to the day the first bill went out.
- **Bill → paid** — from that bill to the last payment, once the job is paid in full.

The chart draws the **median** of each by the month the bill went out, side by side on one day scale, with a dashed line at 30 days. A bill → paid number past 30 turns red. Hover a month for how many jobs it holds.

The tiles add the **whole cycle** (last day on site to cash) and the **slowest payer** — the GC whose paid jobs take longest, with the fastest underneath. A payer needs two paid jobs to be ranked, so one slow invoice doesn't name a builder.

:::example Reading it
Work → bill at 6 days and bill → paid at 32 days means the office bills fast and the money is slow. The reverse means the crew finished weeks before anyone billed. The whole cycle tile is the one to watch month to month.
:::

## Stale open

The panel on the right lists **every open job** — not billed, not paid — with no field work for {{chip:blue|14 d}}, {{chip:blue|21 d}}, or {{chip:blue|30 d}} or more, longest idle first, with the GC, the lead tech, and the contract. It runs on all jobs whatever **Show** says. This is the list behind the Timeline's "open then and still open" number.

Click a row and the Jobs view opens on that job. Most stale jobs need one of three things: a bill, an inspection, or to be closed.

## Compare to

With **Compare to** on, the three lag tiles show the change in days against the prior period or last year. Fewer days is green.

## Watch-outs

- A job billed before its last field day (a deposit, a progress bill) reads 0 for work → bill.
- Idle days count from the last **approved** field day. Sessions awaiting approval don't move it — approve them on People → Hours and the job drops off the list.
