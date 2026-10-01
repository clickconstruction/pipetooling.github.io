---
title: see how many jobs ran each day
category: Office
roles: dev, master_technician, assistant, controller
keywords: days view, job summary, jobs per day, simultaneous jobs, concurrency, workdays, crew, field hours, overhead per job-day, charged, carry, smoothing, who received overhead, since a week ago, opened billed paid
order: 37
---

The Days view turns the ledger's clock sessions into one row per calendar day. Each row counts jobs carried, people out, field hours and what a job-day of overhead cost.

It is the fastest way to see whether the crew is spread across two jobs or six. It also shows which days the office cost landed on nobody.

## Where it is

Go to **Jobs → Job Summary** and switch **View** from {{chip:blue|Jobs}} to {{chip:blue|Days}}. The **Worked in** chips still set the window: 90d, This year, 12 mo or All.

## What you see

- **Tiles** show workdays out of calendar days. They show jobs per workday as an average, a max, a median and the total job-days. The median is the middle value. They show overhead per job-day, field hours and people-days. A small histogram, a bar count, shows how many workdays carried 1, 2, 3… jobs.
- **The chart** has one bar per day, stacked by job. Bar height is that day's approved field hours. The colors are the six jobs with the most hours in the window. Everything else is gray. The number under a bar is how many jobs were worked that day. Hover a segment for the job and its hours.
- **The table** is newest first. **Jobs** and **People** are distinct counts with approved time that day. **Pool** is what the office spent that day: office labor, bid labor and office parts. **Charged** is what actually landed on that day's jobs after the smoothing window and carry share the app runs on. See *read true profit on Job Summary*. The carry portion is named beside it. Hover it for the split, including any dollars with nobody to charge. **Per job-day** is pool ÷ jobs, the concurrency unit. Concurrency means how many jobs run at once. A day with office cost but no field work shows {{chip:yellow|unallocated}} there. **Worked** lists the jobs as chips with hours. Each chip shows how many people were on the job and the dollars it received that day. Hover a chip for the names.

:::example Reading a day
Wed Sep 2 · 5 jobs · 7 people · 33.0 h · pool $1,180 · $236 per job-day
J931 25.9h · 2   J878 3.5h · 1   J983 2.3h · 1   …
:::

Tick **Show days with nothing on them** to include the empty days. Those are weekends and other days with no field work and no office cost.

## Since a week ago

Under the tiles a strip counts what changed since a day in the past. It counts jobs **opened**, **billed** and **paid**, and how many open then are **still open** now. It is the same strip the Timeline view shows when you rewind it. Press {{chip:blue|1 wk}}, {{chip:gray|2 wk}}, {{chip:gray|3 wk}} … to pick how far back to count. Only the chips that fit inside the **Worked in** window are offered. It opens on 1 wk.

:::example A week's movement
Since Mon Sep 7: 2 jobs opened · 3 billed · 1 paid · 6 open then and still open
:::

## Open a day's session notes

Click any **day** in the table. **Session notes** opens pinned to that day and grouped by job. Every clock session from that day is one line, with what each person wrote and the Assign / Change controls. A {{chip:blue|Day: Wed Sep 2 ✕}} chip at the top says which day you are on. Clear it to widen back to the last 30 days.

## How it ties to true profit

The Jobs view charges each job its share of the pool by field hours over the app's smoothing window. It adds a small daily carry while the job is open. The **Charged** column and the dollars on each chip are exactly those shares, day by day. So a stretch of five-job days makes every job on them cheaper. A job that had the crew to itself pays for the office that week. The **Charged** column only appears once the app runs a smoothing window or carry share. Under the original one-day method, charged equals pool.

## Watch-outs

- **Recorded** clock sessions count. That means clocked out and not rejected, whether or not they have been approved yet. A rejection in People → Hours removes the session. Time still on the clock does not count until it is clocked out.
- Bid time is part of the pool, not a "job" on the chart. Bids show up as cost, not as a bar.
- Pool and per job-day dollars show for devs, leaders and controllers. Counts and hours show for every office role.
