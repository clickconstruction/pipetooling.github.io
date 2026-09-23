---
title: see what days a job is on people's calendars
category: Office
roles: all
keywords: job calendar, schedule, appointments, dispatch, field date, who is scheduled, month view, worked days, two-week strip, not scheduled, when is the job scheduled, ends, this week, later, next first, sort by next visit
order: 64
---
Every job on **Jobs → Pipeline** carries a **two-week strip** in the Crew & Dates column: ten small cells, this week and next, Monday first. A blue cell is a day someone is booked on the job; the outlined cell is today. Under it the row says it in words:

- {{chip:green|NEXT}} **Wed Sep 23 · 8–10 AM** and {{chip:blue|ENDS}} **Fri Sep 25 · 3 visits** — the first appointment and the last day on the calendar. One visit reads *same day · 1 visit*.
- {{chip:yellow|NOT SCHEDULED}} with **Last Thu Sep 17 · worked** — nothing booked from today on. On a Working job the flag is amber; on a Waiting job it is grey, because nothing booked is what Waiting means. Planners get an **Assign work…** link right under it.
- **Done** with the last visit — nothing booked and the job is at 100 %, or already past Working.

:::example A scheduled row and an unscheduled one
▢ ▣ ▣ ▣ ▢ · ▢ ▢ ▢ ▢ ▢ &nbsp; NEXT Wed Sep 23 · 8–10 AM &nbsp; ENDS Fri Sep 25 · 3 visits

▢ ▢ ▢ ▢ ▢ · ▢ ▢ ▢ ▢ ▢ &nbsp; NOT SCHEDULED &nbsp; Last Thu Sep 17 · worked &nbsp; Assign work…
:::

A Saturday block shows as a sixth cell on its week; days booked beyond next week are counted in the strip's hover text. The strip draws booked days only — it does not yet tick the days someone actually worked (the calendar below does). On the phone cards the same strip sits in the chip row, with **→ Fri Sep 25** when the plan runs past the next visit and the **not scheduled** chip when nothing is booked.

## Find the ones with no date

The **Working** header carries four pills — {{chip:gray|All 40}} {{chip:yellow|Not scheduled 14}} {{chip:gray|This week 19}} {{chip:gray|Later 7}} — counted from the same strip. Pick one and the Working rows narrow to it. *Not scheduled* means nothing booked from today on and the job under 100 %; finished jobs with nothing booked are not gaps, and a line under the list says how many were left out. Beside the pills, {{button:outline|⇅ Next first}} reorders every section by the next booked visit: today's at the top, unbooked rows oldest-last-worked first, finished rows last. Press it again for the usual job-number order; the ⋯ menu's Sort group offers the same pick.

Clicking the strip or any of the lines opens the **Job Calendar**: a month view of which days the job sits on whose calendar, with every appointment listed below.

## Open it

1. On **Jobs → Pipeline**, find the job's two-week strip in the Crew & Dates column (or the **NEXT** / **ENDS** / **Last** line under it).
2. Click it. The Job Calendar opens with the job's number, service type, name, and address at the top.

The same green **NEXT** summary is pinned at the top of the **Job activity / notes** panel when you expand a job — every job with an upcoming appointment shows the date, time window, crew, and dispatch note there; click it for the whole plan. (On the mobile cards view, the green **Next** chip on a card opens it too.)

It also opens from two other places:

- **A job's Detail window** — the calendar icon at the top right of the header.
- **Job Mode** — the small **Job calendar** link under the job header shows the plan for the job you're on (view only).

## Read the calendar

- The summary line tells you the shape of the schedule at a glance: *3 scheduled days · 2 people · Fri, Jul 31 – Tue, Aug 4*, plus the **next** upcoming appointment.
- The month grid shows a **colored dot for each person** scheduled that day — the legend beside the month name maps colors to people. Use {{button:outline|‹}} {{button:outline|›}} to move between months.
- Today has a blue outline. A small green **✓** under a day means someone actually worked it (an approved clock session).
- **Click any day to highlight it** (click again to un-highlight). Days with appointments also jump the list below to themselves. Days with nothing scheduled or worked show in grey.

## The appointment list

Below the grid, every appointment is listed — **Upcoming** first (soonest at the top), then **Past** (dimmed, most recent first). Each row shows the date, the time window, everyone on the appointment, and its note.

:::example An appointment row
**Fri, Jul 31** &nbsp; 9:30 AM–11:00 AM &nbsp; Abraham

clean out to the right of the front door next to the sidewalk
:::

## Act on it

- {{button:outline-blue|Open week dispatch}} jumps to the full dispatch grid focused on this job — **on the week of the highlighted day**, if one is highlighted.
- {{button:green|Schedule…}} (planner roles) opens the same scheduling window as the activity panel, right on top of the calendar — **pre-set to the highlighted day** (the button even says so, e.g. *Schedule Tue, Jul 14…*). Add the block, and the calendar reflects it when reopened.
