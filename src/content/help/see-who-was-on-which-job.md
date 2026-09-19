---
title: see who worked with whom, and who was on which job at any moment
category: Office
roles: dev, master_technician, assistant, controller
keywords: who's where, crews, crew lead, week, timeline, floating heads, clock sessions, schedule blocks, listed, clocked in, day, scrubber, islands, org chart, people, team leads
order: 88
---
**People → People → Who's where** shows the crews as they actually were. It opens on the **week**: heads grouped by who worked together, with the crew's lead read off the schedule. Tap a day and it becomes the **day**: one island per job, a head for every person there at the moment you choose. Nothing on the page is typed by anyone and nothing is written. It is read from two things the app already records — clock sessions (who clocked in where, and when) and the schedule (who Dispatch listed on which job).

## The week: crews, not jobs

- Each card is a **crew**: the people who were on a job together this week. The number under a head is how many days they clocked with that crew; the line under the card is the jobs the crew touched (*J258 · Oak St ×3 · J291 · Elm Ct ×2*).
- A small {{chip:green|SUP}} on a head means that person **can run a job** — a master, or a helper or sub the office has marked as not needing supervision. It is read off the switch on their account, never set here. A crew with nobody like that reads **unsupervised — nobody on this block can run it**, and the week strip counts unsupervised job-days; that is the cue for Dispatch to put a master or a qualified person on the block.
- A **hollow** head with *listed 5* under it was on the schedule every day and never clocked — masters read this way, since they do not clock. That is normal.
- An **amber** line under a head is where Dispatch's plan and the clock disagreed: *listed 3 · clocked 1* means three schedule blocks, one day clocked; *1 day on another job* means they clocked somewhere else than they were listed.
- The box at the side holds **Office** (people whose week was the office job), **Alone this week** (on a job with nobody else), and a count of people **not in** at all.
- **◀ ▶** step a week at a time; {{button:outline|This week}} brings you back. The day strip shows each day's head count — tap one to open it.

:::example A crew card
**Mike's crew** 5 days
**MR** 👑 *listed 5* &nbsp; **BO** 4 days &nbsp; **SR** 3 days &nbsp; **DP** *listed 3 · clocked 1*
J258 · Oak St ×3 · J291 · Elm Ct ×2
:::

## The day: pick a moment

- The **◀ ▶** arrows step a day at a time; {{button:outline|Today}} brings you back and {{button:outline|⇱ Week}} returns to the crews. The day opens on *now* while someone is on a job, otherwise on the busiest minute.
- The **slider** is the time of day. Drag it and the islands repaint for that minute; the big clock on the right says where you are.
- Press {{button:blue|▶}} to walk the day on its own, five minutes a step. Press again to pause, or grab the slider.

## Reading the heads

- A **solid** head is clocked in at that minute. The small time under it is when they clocked in.
- A **hollow** head is listed on the schedule for that job and time but not clocked in anywhere. Masters usually appear this way, since they do not clock — that is normal. An island with nobody who can run the job wears an **unsupervised** mark.
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

## Why there is no button

The week *is* the org chart for hourly, per-job work: who supervises whom is whoever was on the job and could run it, read off the schedule, the clock, and the one switch on each helper's and sub's account (*say who can run a job on their own*). Nothing here writes anything and nothing has to be maintained — put a master or a qualified person on the crew's schedule block and the marks follow.
