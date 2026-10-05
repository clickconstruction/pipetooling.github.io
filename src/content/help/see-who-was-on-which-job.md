---
title: see who worked with whom, and who was on which job at any moment
category: Office
roles: dev, master_technician, assistant, controller
keywords: who's where, crews, crew lead, week, timeline, floating heads, clock sessions, schedule blocks, listed, clocked in, day, scrubber, islands, org chart, people, team leads
order: 88
---
**People → People → Who's where** shows the crews as they actually were. It shows who worked together, and who was on which job at any moment.

It opens on the **week**. Heads are grouped by who worked together, with the crew's lead read off the schedule. You tap a day and it becomes the **day**. Then there is one island per job, with a head for every person there at the moment you choose.

Nothing on the page is typed by anyone, and nothing is written. It is read from two things the app already records. One is clock sessions: who clocked in where, and when. The other is the schedule: who Dispatch listed on which job.

## The week: crews, not jobs

- Each card is a **crew**: the people who were on a job together this week. The number under a head is how many days they clocked with that crew. The line under the card is the jobs the crew touched, like *J258 · Oak St ×3 · J291 · Elm Ct ×2*.
- A small {{chip:green|SUP}} on a head means that person **can run a job**. That is a master, or a helper or sub the office has marked as not needing supervision. It is read off the switch on their account, never set here. A crew with nobody like that reads ***unsupervised — nobody on this block can run it***. The week strip counts unsupervised job-days. That is the cue for Dispatch to put a master or a qualified person on the block.
- A **hollow** head with *listed 5* under it was on the schedule every day and never clocked. Masters read this way, since they do not clock. That is normal.
- An **amber** line under a head is where Dispatch's plan and the clock disagreed. *listed 3 · clocked 1* means three schedule blocks and one day clocked. *1 day on another job* means they clocked somewhere other than where they were listed.
- The box at the side holds three things. **Office** is people whose week was the office job. **Alone this week** is people on a job with nobody else. Then there is a count of people **not in** at all.
- **◀ ▶** step a week at a time. {{button:outline|This week}} brings you back. The day strip shows each day's head count. You tap one to open it.

:::example A crew card
**Mike's crew** 5 days
**MR** 👑 *listed 5* &nbsp; **BO** 4 days &nbsp; **SR** 3 days &nbsp; **DP** *listed 3 · clocked 1*
J258 · Oak St ×3 · J291 · Elm Ct ×2
:::

## The day: pick a moment

- The **◀ ▶** arrows step a day at a time. {{button:outline|Today}} brings you back. {{button:outline|⇱ Week}} returns to the crews. The day opens on *now* while someone is on a job. Otherwise it opens on the busiest minute.
- The **slider** is the time of day. You drag it and the islands repaint for that minute. The big clock on the right says where you are.
- You press {{button:blue|▶}} to walk the day on its own, five minutes a step. You press it again to pause, or grab the slider.

## Reading the heads

- A **solid** head is clocked in at that minute. The small time under it is when they clocked in.
- A **hollow** head is listed on the schedule for that job and time, but not clocked in anywhere. Masters usually appear this way, since they do not clock. That is normal. An island with nobody who can run the job wears an **unsupervised** mark.
- The **ring** says the role. Blue is a master and purple is a subcontractor. Green is a helper and teal is the office.
- A head marked *listed elsewhere* clocked in on this job but was scheduled on another. You hover over any head for the full story. It gives the name, role, in and out times, and where they were listed.

:::example An island at 10:40 am
**J258 · Oak St** &nbsp;Ramirez · 1408 Oak St
**MR** *listed 7a* &nbsp; **BO** in 7:02a &nbsp; **SR** in 7:15a &nbsp; **DP** *listed 7a*
:::

The dashed box to the side holds anyone **clocked in with no job** on their session. It also holds a count of people **not in that day** at all. You open it to see the names.

## The lanes underneath

Below the islands, the same day shows as lanes. There is one row per job, with time running across. Each person is a bar from clock-in to clock-out. A dashed bar is a schedule block nobody clocked. It says *never clocked*, or *clocked at* the job they actually went to. A solid bar says *listed at* another job when the plan and the clock disagree. The blue line is the moment under the slider. You click anywhere on the time axis to jump there.

## Who can see it

Every office role can see it: dev, masters, assistants and the controller. Assistants see the same rolling window of days the Hours tab gives them. The page never shows wages, and it never writes anything.

## Why there is no button

The week *is* the org chart for hourly, per-job work. It shows who supervises whom. The supervisor is whoever was on the job and could run it. That is read off the schedule, the clock, and the one switch on each helper's and sub's account. See *say who can run a job on their own*. Nothing here writes anything, and nothing has to be maintained. You put a master or a qualified person on the crew's schedule block, and the marks follow.
