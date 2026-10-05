---
title: see man hours for the office and the field
category: Office
roles: dev, master_technician
keywords: man hours, hours, office, field, bids, office share, week, month, quarter, year, overhead, labor hours, how many hours, not on a job, waiting, so far, per week, clock, headcount
order: 62
---
The Man hours card shows how many hours the company worked in the office and in the field. You can read it by week, month, quarter or year.

## Where it is

Open **People → Overhead**. The **Man hours** card sits above the day table. You see it if you can open the Overhead tab.

The card shows hours only. It never shows a wage or a dollar.

## Pick the period

The switch is at the top right of the card. It has four choices.

- {{button:outline|Week}} shows the last 13 pay weeks. A pay week runs Sunday to Saturday.
- {{button:outline|Month}} shows the last 12 months.
- {{button:outline|Quarter}} shows the last 8 quarters.
- {{button:outline|Year}} shows every year on record.

## Read a row

Each row is one period. The oldest period is at the top.

- **Field** is time clocked to a job.
- **Office** is time clocked to the Office job.
- **Bids** is time clocked to a bid.
- **Not on a job** is time with no job and no bid on it.
- **Total** adds the four together.
- **Office share** is office plus bids, out of all time on a job or a bid. Time not on a job is left out.
- **Per week** is the total divided by the weeks in the period. It lets you compare a part month with a full one.
- **People** is how many people clocked time in the period.

:::example A month where one hour in four was office time
Field **900** · Office **250** · Bids **50** · Total **1,200** · Office share **25%**
:::

## The chips on a row

A row can wear up to three chips beside its name.

- {{chip:gray|so far}} means the period is not over yet. Its hours will keep growing.
- {{chip:gray|from Mar 12}} means the clock started partway through that period. The row is not a whole period.
- {{chip:yellow|40 h waiting}} means those hours are recorded and not yet approved. They are already counted in the row.

You approve waiting hours in the Hours approvals queue. See [clear the hours approvals backlog](/help/clear-the-hours-approvals-backlog).

## What counts

The card counts recorded hours. That is every closed clock session that was not rejected.

The day table under the card uses the same rule. So a week on the card matches that week in the day table.

You set the Office job with {{button:outline|Overhead office job}} on the same tab. If no Office job is set, no time counts as office.

Hours start on the first day anyone clocked in. Hours typed by hand before that day have no job on them. The card cannot split them, so it leaves them out.

Time in **Not on a job** belongs somewhere. See [put clocked hours on the right job](/help/put-clocked-hours-on-the-right-job).
