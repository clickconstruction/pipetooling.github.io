---
title: match clock sessions to jobs and bids
category: Office
roles: assistant
keywords: match sessions, unassigned, clock sessions, no job, assign job, hours, dispatch
order: 34
---

When someone clocks time without picking a job, that session floats — payroll knows the hours, but no job carries the labor. The **Match sessions** button rounds up every floating session from the last 7 days and suggests where each one belongs, so you can clear the whole list in a few taps.

## Where it is

Go to **People → Hours**. On the **Currently clocked in** section header, the {{button:outline|Match sessions}} button wears an amber count when sessions need sorting — that count is every session in the last 7 days with no job or bid (whether or not the person is still clocked in). At zero it goes quiet.

## Reading the list

Sessions are grouped by person. Each one shows the day, the time span (with a green "still clocked in" marker for open sessions), and the person's clock note. Under that, up to three **suggestions**, strongest first:

- **Dispatch** (green) — the person had a Dispatch schedule block for that job that day. This is the strongest signal.
- **Crew that day** (blue) — another of that person's sessions the same day already carries a job or bid.
- **From note** (purple) — a job number typed into the clock note, like "961 trim set".

:::example Darren's Friday
Fri 8/7 · 6:32 AM – 4:15 PM · 9.7h · *"961 trim set with paige"*
{{chip:green|Dispatch}} 878 · Lyndsey Lane- Remodel · scheduled 8 AM–12 PM — {{button:blue|Assign}}
:::

Tap {{button:blue|Assign}} on the right suggestion and the session is matched immediately — the row turns into a green "Matched" line with **Undo**. It's the same assignment the per-session Assign button makes, so approvals, the day audit, and Quickfill's unassigned list all see it at once.

## When there's no suggestion

Use **Search jobs & bids…** on the session — it opens the same search box you know from assigning sessions elsewhere, with the person's Dispatch schedule quick-picks on top. **Skip** hides a session for this visit only (nothing is written) — right for personal-errand sessions the office will reject instead.

## The bulk shortcut

When some sessions have **exactly one** Dispatch match — one scheduled job that day, nothing ambiguous — the footer offers to apply them all in one tap. Sessions with two or more scheduled jobs are never bulk-matched; those you decide one at a time.

## What doesn't show up

Salaried office schedules (the automatic salary sessions) are left out on purpose — they legitimately carry no job. Rejected and revoked sessions are out too.
