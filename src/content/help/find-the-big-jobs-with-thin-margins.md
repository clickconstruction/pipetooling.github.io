---
title: find the big jobs with thin margins
category: Office
roles: dev, master_technician, controller
keywords: scatter, bubble chart, big and thin, margin by size, true margin, job summary, quadrants, median
order: 41
---

Sorted by profit dollars, a big job with a thin margin looks fine — it still made money. **Scatter** puts every job where its size and its margin say it belongs, so those jobs stand out.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Scatter}}. **Show** and **Worked in** pick the jobs.

## Reading the plot

Each bubble is one job:

- **across** — revenue, on a square-root scale so the many small jobs don't pile into the left edge
- **up** — true margin (after its overhead share)
- **bubble size** — field hours, or days, or none
- **color** — service type, GC, or lead tech; the six biggest get a color, the rest read as {{chip:gray|Other}}

Two dashed lines mark the **median size** and the **median margin**, cutting the plot into four. The corner to watch is bottom-right: **big and thin**. Hover a bubble for the job, its numbers, and its hours; click it to open the job on the Jobs view.

## The list

The panel beside the plot counts the big-and-thin jobs and lists them worst first. **Short** is the dollars the job would have kept at the median margin — the size of the miss, not just the percent. Hover a row to find its bubble; click the job number to open it.

:::example Two jobs, same profit
Job A: $2,000 at 50%, keeps $1,000. Job B: $20,000 at 5%, keeps $1,000. The table ranks them together. The scatter puts B alone in the bottom-right corner, $9,000 short of the median margin.
:::

## Target

With **Target** on, a solid dashed line marks the target margin and counts the jobs under it.

## Watch-outs

- Jobs with no revenue, or no overhead share yet (day ledger still loading), are left off and counted in the control row.
- In-progress jobs use earned revenue, so a job that is 30% done plots at 30% of its contract.
