---
title: see how many jobs are running at once, over time
category: Office
roles: dev, master_technician, assistant, controller
keywords: timeline, jobs running, concurrent jobs, simultaneous jobs, load, capacity, gantt, job summary, peak, working billed paid
order: 38
---

The **Days** view counts what the crew touched each day. **Timeline** answers the other question: how many jobs were *open* at the same time, whether or not anyone was on them that day. That number is bigger, and it's the one that tells you how much you're carrying.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Timeline}}. It uses the same **Worked in** window as the other two views.

## Reading the chart

The chart is the number of jobs running on each day, stacked by how the job stands today:

- {{chip:blue|working}} — still open
- {{chip:yellow|billed, awaiting payment}} — finished and billed
- {{chip:green|paid}} — finished and paid

The black line is the 7-day average, the dot marks the **peak**, and the red dashed line is today. Hover any day for its split; click it to open that day's session notes grouped by job.

The tiles above say it in numbers: running today, the average over the window, the peak and when it hit, how many jobs the window holds (finished vs. still open), and the median run length.

Open **The N jobs behind this curve** to see every job as a bar from its first running day to its last, sorted by start. An open job's bar reaches today and is marked *open*.

## What "running" means

Two definitions, one click apart:

- **first → last work** (default) — a job runs from its first approved field day to its last, and to today while it's still open. The **Gap** setting decides what a pause does: with {{chip:blue|7d}}, a stretch of more than 7 idle days splits the run, so a paused job isn't counted while nobody is on it. {{chip:gray|none}} counts only days with approved hours; {{chip:gray|14d}} bridges longer pauses.
- **Working → Billed** — a job runs from the moment it was moved to Working until it was moved to Billed (or Paid), touched or not. This is "open on the board" and runs higher and longer.

:::example One paused job
Mission Hills had hours every week in May, nothing for ten days in June, then hours again. With the gap at 7d it shows as two runs and isn't counted during the pause; with 14d it's one run straight through.
:::

## Watch-outs

- Only **approved, closed** sessions count toward first → last work. Approve hours in People → Hours and the bars grow.
- A job can't run before the window starts; a bar that begins on the window's first day probably started earlier. Widen the window to see its real start.
- Bids aren't on this chart — it's jobs on the ledger only.
