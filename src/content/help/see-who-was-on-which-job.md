---
title: see who was on which job at any moment
category: Office
roles: dev, master_technician, assistant, controller
keywords: who's where, crews, timeline, floating heads, clock sessions, schedule blocks, listed, clocked in, day, scrubber, islands, org chart, people
order: 88
---
**People → People → Who's where** shows the day as it actually happened: one island per job, and on each island a head for every person who was there at the moment you choose. Nothing on the page is typed by anyone. It is read from two things the app already records — clock sessions (who clocked in where, and when) and the schedule (who Dispatch listed on which job).

## Pick a day and a moment

- The **◀ ▶** arrows step a day at a time; the strip beside them shows the week with each day's head count, and tapping a day opens it. {{button:outline|Today}} brings you back.
- The **slider** is the time of day. Drag it and the islands repaint for that minute; the big clock on the right says where you are.
- Press {{button:blue|▶}} to walk the day on its own, five minutes a step. Press again to pause, or grab the slider.

## Reading the heads

- A **solid** head is clocked in at that minute. The small time under it is when they clocked in.
- A **hollow** head is listed on the schedule for that job and time but not clocked in anywhere. Masters usually appear this way, since they do not clock — that is normal.
- The **ring** says the role: blue for a master, purple for a subcontractor, green for a helper, teal for the office.
- A head marked *listed elsewhere* clocked in on this job but was scheduled on another. Hover any head for the full story: name, role, in and out times, and where they were listed.

:::example An island at 10:40 am
**J258 · Oak St** &nbsp;Ramirez · 1408 Oak St
**MR** *listed 7a* &nbsp; **BO** in 7:02a &nbsp; **SR** in 7:15a &nbsp; **DP** *listed 7a*
:::

The dashed box to the side holds anyone **clocked in with no job** on their session, and a count of people **not in that day** at all — open it to see the names.

## The lanes underneath

Below the islands, the same day as lanes: one row per job, time across, each person a bar from clock-in to clock-out. A dashed bar is a schedule block nobody clocked; it says *never clocked* or *clocked at* the job they actually went to. A solid bar says *listed at* another job when the plan and the clock disagree. The blue line is the moment under the slider — click anywhere on the time axis to jump there.

## Who can see it

Every office role — dev, masters, assistants and the controller. Assistants see the same rolling window of days the Hours tab gives them. The page never shows wages, and it never writes anything.

## Coming next

A week view that groups the same heads by **who worked together**, with the crew's lead read off the schedule — the org chart for hourly, per-job work.
