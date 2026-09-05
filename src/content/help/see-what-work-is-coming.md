---
title: see what work is coming
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: ahead, backlog, booked, won bids, not started, remaining, schedule ahead, forecast, pipeline, job summary
order: 43
---

Every other view on Job Summary looks back. **Ahead** looks forward, from three things already in the app: open jobs, won bids, and the schedule.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Ahead}}. **Worked in** sets the pace it measures backlog against.

## The tiles

- **Remaining on open jobs** — contract minus what's been earned so far, over every open job, the same earned-revenue rule the Jobs view uses.
- **Won, not started** — bids marked won that have no job yet, with how many have no start date and how many are past the one they had.
- **Booked backlog** — the two together, and how many weeks that covers at this window's revenue per week.
- **Expected true profit** — the backlog at this window's true margin, and at your **Target** if one is set.
- **Field days booked** — person-days on the schedule for the next four weeks, as a share of the crew's days. Under 60% reads amber.

## The chart

Eight weeks from this one. Each bar is the field days already on the schedule that week (a person on a job for a day is one); the dashed line is what the crew could supply; a {{chip:blue|◆}} marks a won bid's estimated start. Hover a week for the jobs and the bids behind it.

:::example Reading it with Capacity
Capacity says the last three weeks ran under 60%. Ahead says the next four are booked at 45% and the backlog covers two weeks. That's a sales problem, in numbers, before it's a payroll problem.
:::

## The list

Won bids with no job, soonest start first. {{chip:yellow|no date}} means the bid has no estimated start, so it can't be placed on the chart — set the date on the bid and it lands in its week. A red date is a start that has passed.

## Watch-outs

- A won bid becomes a job when it's linked (Jobs → New job from bid, or the estimate flow). Until then it counts here, not on the Jobs view.
- Capacity is the field roster × 5 days; the Capacity view explains who counts.
