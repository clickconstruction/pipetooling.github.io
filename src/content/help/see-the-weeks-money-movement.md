---
title: see which jobs made or lost money this week
category: Office
roles: dev, controller
keywords: weekly money movement, money out, money in, job cost this week, value created, earned, cash, lost money, made money
order: 75
---
Money goes out into jobs all week — team labor, sub sheets, materials — and comes in as payments. **Weekly money movement** shows one week of that per job, and whether the spend bought progress.

## Open it

On **Jobs → Pipeline**, open the hamburger menu at the left of the stage strip — the **Pipeline** group holds {{button:outline|Weekly money movement}} (visible to devs and controllers only).

## The two lenses

- **Earned** — did the work performed this week cover its cost? Each job's **Value created** is its % done movement for the week × the job total; the net is value created minus money out.
- **Cash** — what actually moved: money in (payments) minus money out.

:::example A job can look great in Cash and terrible in Earned
Collecting $5,000 on an old invoice while spending $4,900 of labor with no % progress shows +$100 cash — and −$4,900 earned. Both are true; the lenses keep them separate.
:::

## Reading the rows

Jobs are split into **Made money this week** and **Lost money this week** under the active lens. Each row shows the week's % movement (e.g. `42% → 55%`), value created, money out (hover for the labor / subs / materials split), money in, and the net.

Watch for the two amber flags:

- {{chip:yellow|spend, no progress}} — money went out but the % didn't move. Someone should look at the job.
- {{chip:yellow|no job total}} — the job has no total, so earned value can't be computed. Open **Edit Job** and set one.

The **Not on jobs** line at the bottom holds office and bid labor plus office-job charges — real money out that no job absorbs.

## Print it

{{button:outline|🖨 Print}} opens a print-friendly copy of the current week and lens — choose **Save as PDF** to download.
