---
title: find clock sessions booked to the wrong job
category: Office
roles: dev, master_technician, assistant, controller
keywords: session notes, clock sessions, focus, notes, office, mislabeled, wrong job, reassign, crew history, patterns
order: 35
---

When someone clocks in they write a short note — their **focus** — and pick where the time goes: a job, a bid, or the office. Sometimes the pick is wrong and the note gives it away: a session booked to **Office** that says *"helped terry on 961 trim"* belongs on job 961. **Session notes** puts every clock session on one line so you can catch those in a glance, and read a whole job's crew history for patterns.

## Where it is

Go to **Jobs → Pipeline**. Two doors open the same view:

- The blue **clock** icon button on the toolbar, right after {{button:outline|Forecast}} — for searching across everyone. Hover it and it says "Session notes".
- The small **Sessions** link beside **N Reports** on any job row (and in the job activity pop-out) — the view opens with that job already pinned, so you see everyone who clocked time on it.

Everyone in the office can open it. What you see inside follows the same rules as People → Hours: a role without pay access only sees the sessions it could already read there.

## Reading the lines

One row per session, newest first, grouped by day:

- **Time** with a status dot — {{chip:green|approved}}, {{chip:yellow|awaiting approval}}, or a ringed green dot for someone still clocked in (their hours count so far).
- **Hrs** — decimal hours.
- **Person** — click a name to pin that person and see only their sessions. A muted **(s)** means a salary-schedule segment the system created.
- **Booked to** — {{chip:blue|961 · Smith residence}} for a job (click it to pin the job), a purple chip for a bid, **Office**, or a dashed **nothing**.
- **Note** — what they wrote. Search hits are highlighted.

The summary line above the table counts sessions, people, and hours for whatever is showing, and how many notes name a job the session isn't booked to.

:::example Darren's Wednesday
6:58a – 11:40a · 4.7 · **Darren M** · Office · *"helped terry on 961 trim, then shop"* · {{chip:purple|961?}} {{button:blue|Assign}}
:::

## Searching and narrowing

- **Search** matches notes, people, job numbers, and job names at once. Type `terry` to see every session that mentions Terry or is Terry's; type `961` to find every note that names that job, wherever it was booked.
- **Last 7d / 30d / 90d / All** sets the window. It opens on 30 days because misfiles usually surface at approval time, which runs behind.
- **Booked to** narrows to Office, Nothing, A job, or A bid. Office plus a person's name is the fastest way to audit one person's office time.
- **Group** by Day, Person, Job, or None (one flat list).

## Fixing a misfile

When a note names a job number and the session isn't booked to that job, a purple **961?** chip appears with {{button:blue|Assign}}. Tap it and the session moves to that job on the spot. It's the same change the **Assign** / **Change** button on every row makes — approvals, the day audit, People → Hours, and the job's man-hours all see it at once. The chip is a prompt, not a rule: *"961 change order paperwork"* on an office session is real office work, so leave it alone.

Use **Change** when the right job isn't the one in the note, or **Assign** when a session is booked to nothing.

## Reading a job's story

Pin a job (from the row's **Sessions** link, or by clicking its chip) and group by **Day** or **Person**. Notes that read as one-offs on their own — *"leak under sink"*, then *"callback, leak under sink again"* three days later — line up as a pattern when they sit next to each other. **Open on board ›** on any job row closes the view and flashes that job on the Pipeline.

## Limits

- The view shows the newest 1,000 sessions for the window and search. If you hit that cap, narrow the window or add a word to the search.
- Rejected and revoked sessions are left out — they're voided time.
