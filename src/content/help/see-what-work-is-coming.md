---
title: see what work is coming
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: ahead, backlog, booked, won bids, not started, remaining, schedule ahead, forecast, pipeline, job summary
order: 43
---

Every other view on Job Summary looks back. **Ahead** looks forward, from three things already in the app: open jobs, won bids, and the schedule.

## Where it is

You go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Ahead}}. **Worked in** sets the pace it measures backlog against. Backlog is the work we have booked but not done yet.

## The tiles

- **Remaining on open jobs** is the contract minus what's been earned so far, over every open job. It uses the same earned-revenue rule the Jobs view uses.
- **Won, not marked started** counts bids whose outcome is still *won*. It says how many have no start date, and how many are past the one they had. You set a bid's outcome to *started or complete* when its job begins. Then it leaves this tile.
- **Booked backlog** is the two together. It says how many weeks that covers at this window's revenue per week.
- **Expected true profit** is the backlog at this window's true margin. It also shows the backlog at your **Target**, if one is set.
- **Field days booked** is the person-days on the schedule for the next four weeks. It shows them as a share of the crew's days. Under 60% reads amber.

## The chart

The chart covers eight weeks, starting with this one. Each bar is the field days already on the schedule that week. A person on a job for a day is one field day. The dashed line is what the crew could supply. A {{chip:blue|◆}} marks a won bid's estimated start. You hover over a week to see the jobs and the bids behind it.

:::example Reading it with Capacity
Capacity says the last three weeks ran under 60%. Ahead says the next four are booked at 45% and the backlog covers two weeks. That's a sales problem, in numbers, before it's a payroll problem.
:::

## The list

The list shows won bids with no job, soonest start first. {{chip:yellow|no date}} means the bid has no estimated start. So it can't be placed on the chart. You set the date on the bid, and it lands in its week. A red date is a start that has passed.

## Watch-outs

- The office marks the hand-off by setting the bid's outcome to *started or complete*. Jobs don't carry a link back to their bid today. So that outcome is the signal this view reads.
- Capacity is the field roster × 5 days. The Capacity view explains who counts.
