---
title: see how many jobs ran each day
category: Office
roles: dev, master_technician, assistant, controller
keywords: days view, job summary, jobs per day, simultaneous jobs, concurrency, workdays, crew, field hours, overhead per job-day
order: 37
---

The **Days** view on Job Summary turns the same clock sessions the ledger uses into one row per calendar day: how many jobs the crew carried, how many people were out, the field hours, and what a job-day of overhead cost. It's the fastest way to see whether the crew is spread across two jobs or six, and which days the office cost landed on nobody.

## Where it is

Go to **Jobs → Job Summary** and switch **View** from {{chip:blue|Jobs}} to {{chip:blue|Days}}. The **Worked in** chips still set the window (90d, This year, 12 mo, All).

## What you see

- **Tiles**: workdays out of calendar days; jobs per workday (average, max, median, and the total job-days); overhead per job-day; field hours and people-days; and a small histogram of how many workdays carried 1, 2, 3… jobs.
- **The chart**: one bar per day, stacked by job. Bar height is that day's approved field hours; the colors are the six jobs with the most hours in the window, everything else in gray. The number under a bar is how many jobs were worked that day. Hover a segment for the job and its hours.
- **The table**: newest first. **Jobs** and **People** are distinct counts with approved time that day. **Pool** is the day's overhead (office labor, bid labor, office parts). **Per job-day** is pool ÷ jobs; a day with office cost but no field work shows {{chip:yellow|unallocated}} instead, because nobody is charged for it. **Worked** lists the jobs as chips with hours and how many people were on each; hover a chip for the names.

:::example Reading a day
Wed Sep 2 · 5 jobs · 7 people · 33.0 h · pool $1,180 · $236 per job-day
J931 25.9h · 2   J878 3.5h · 1   J983 2.3h · 1   …
:::

Tick **Show days with nothing on them** to include weekends and other days with no field work and no office cost.

## How it ties to true profit

The Jobs view charges each job its share of every day it was worked, by hours. The per job-day figure here is the same pool over the same days, so a stretch of five-job days makes every job on them cheaper, and a week where one job had the crew to itself makes that job carry the whole week's office.

## Watch-outs

- Only **approved, closed** clock sessions count. A day with time still awaiting approval reads lighter than it was.
- Bid time is part of the pool, not a "job" on the chart — bids show up as cost, not as a bar.
- Pool and per job-day dollars show for devs, masters, and controllers; counts and hours show for every office role.
