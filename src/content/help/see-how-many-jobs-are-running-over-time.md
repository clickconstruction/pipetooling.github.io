---
title: see how many jobs are running at once, over time
category: Office
roles: dev, master_technician, assistant, controller
keywords: as of, slider, rewind, replay, timeline, jobs running, concurrent jobs, simultaneous jobs, load, capacity, gantt, job summary, peak, working billed paid
order: 38
---

The Days view counts what the crew touched each day. Timeline answers the other question: how many jobs were open at the same time.

It counts a job whether or not anyone was on it that day. That number is bigger. It is the one that tells you how much you are carrying.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Timeline}}. It uses the same **Worked in** window as the other two views.

## Reading the chart

The chart is the number of jobs running on each day. The axis up the left says so: "jobs running that day", or "jobs touched that week" on the weekly roll-up. The bars are stacked by how the job stands today:

- {{chip:blue|working}} means still open
- {{chip:yellow|billed, awaiting payment}} means finished and billed
- {{chip:green|paid}} means finished and paid

The black line is the 7-day average. The dot marks the **peak**. The red dashed line is today. As you move across the chart a soft band follows the cursor with the day's date and count. So you know what you are pointing at. Hover a moment for the full split. Click to open that day's session notes grouped by job.

The tiles above say it in numbers. They show running today, the average over the window, and the peak and when it hit. They show how many jobs the window holds, finished or still open, and the median run length. The median is the middle value.

Open **The N jobs behind this curve** to see every job as a bar. The bar runs from its first running day to its last. Jobs are sorted by start. An open job's bar reaches today and is marked *open*.

## Daily or weekly

**Daily** is one column per day, the view described above. **Weekly** rolls the same runs into company-calendar weeks, Monday to Sunday. Each bar is the jobs touched that week. It is stacked as {{chip:blue|carried over}}, already running before the week began, under {{chip:blue|new this week}}. The spikes from single-visit days average out. The tiles turn into running this week, average per week and the peak week. The jobs panel below stays day by day. Your pick is remembered on this device.

## Color by

The stack's colors are a choice, and the counts never change:

- **status today** gives every day of a job the color of where the job stands now. It is quick to read. But a job paid last week paints its whole run green.
- **state on the day** colors each day by where the job stood then. It is {{chip:blue|working}} until its bill went out, {{chip:yellow|billed}} until it was paid, and {{chip:green|paid}} after. The bars change color at the same moves. So you can also see how long money sat.
- **run length** colors by how long the job ran. Jobs of 6 or more days sit at the bottom, then 2 to 5 days, then 1-day jobs on top. The long-running carry and the service-call churn read as different colors without leaving the chart.

Your pick is remembered on this device.

## Walk the chart back

Press {{chip:blue|⏮ As of}} at the end of the control row and a slider appears under it. Drag it left, or press the week chips: **1 wk**, **2 wk**, up to **8 wk**. The chart rewinds to that day:

- the window ends on that day, and every job is colored as it stood *then*. A job paid last Friday shows as {{chip:yellow|billed, awaiting payment}} when you are looking at Thursday
- the days after fade to a dashed outline, so you can see what was coming
- the tiles recompute to that day. A strip under the chart counts what changed since: jobs opened, billed and paid. It also counts how many open then are still open now

{{button:outline|▶ Play}} walks forward a day at a time to today. Watch the orange turn green. That is collection speed, without reading a number. Arrow keys step the slider one day. The chip's off state snaps everything back to today.

:::example What the replay can't know
Jobs deleted since then are gone. A status move corrected later shows its corrected date. Hours approved after the fact count as if approved on the day.
:::

## What "running" means

Two definitions, one click apart:

- **first → last work** means a job runs from its first recorded field day to its last. It runs to today while it is still open. The **Gap** setting decides what a pause does. With {{chip:blue|7d}}, a stretch of more than 7 idle days splits the run. So a paused job is not counted while nobody is on it. {{chip:gray|none}} counts only days with recorded hours. {{chip:gray|14d}} bridges longer pauses.
- **Working → Billed** is the default. A job runs from the moment it was moved to Working until it was moved to Billed or Paid. It counts touched or not. This is "open on the board", the way the office counts. It runs higher and longer than the worked span.

:::example One paused job
Mission Hills had hours every week in May, nothing for ten days in June, then hours again. With the gap at 7d it shows as two runs and isn't counted during the pause; with 14d it's one run straight through.
:::

## Watch-outs

- **Recorded** sessions count toward first → last work. That means clocked out and not rejected, approved or not. A rejection in People → Hours shortens a bar. Time still on the clock does not count until it is clocked out.
- A job cannot run before the window starts. A bar that begins on the window's first day probably started earlier. Widen the window to see its real start.
- Bids are not on this chart. It is jobs on the ledger only.
