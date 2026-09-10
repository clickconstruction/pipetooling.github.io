---
title: match clock sessions to jobs and bids
category: Office
roles: assistant
keywords: match sessions, unassigned, clock sessions, no job, assign job, hours, dispatch, reject session, test punch
order: 34
---

When someone clocks time without picking a job, that session floats — payroll knows the hours, but no job carries the labor. The **Match sessions** button rounds up every floating session from the last 7 days and suggests where each one belongs, so you can clear the whole list in a few taps.

Whatever surface you use, the job always goes on the session itself — the day's split is computed from the clock and never typed by hand (see [put a person's clocked hours on the right job](?g=put-clocked-hours-on-the-right-job)).

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

Use **Search jobs & bids…** on the session — it opens the same search box you know from assigning sessions elsewhere, with the person's Dispatch schedule quick-picks on top.

## When it was never a job

A test punch, a personal errand, a clock-in that should not have happened — those don't belong on any job, so don't match them: tap {{button:red|Reject}} on the card. It asks once — *"Reject Bryan · Sat 9/5 · 9h 30m? Rejected time never reaches payroll."* — and then the session is rejected the same way it would be from the approvals queue: the card drops out, the hours never reach payroll, and the session leaves the match list for good (not just this visit). Sessions still clocked in have no Reject — wait for the clock-out. Rejected by mistake? People → Hours → **Rejected sessions** has Restore.

:::example Bryan's test punch
Sat 9/5 · 2:30 PM – 11:59 PM · 9h 30m · *"Test"*
{{button:outline|Search jobs & bids…}} {{button:red|Reject}}
:::

## The bulk shortcut

When some sessions have **exactly one** Dispatch match — one scheduled job that day, nothing ambiguous — the footer offers to apply them all in one tap. Sessions with two or more scheduled jobs are never bulk-matched; those you decide one at a time.

## What doesn't show up

Salaried office schedules (the automatic salary sessions) are left out on purpose — they legitimately carry no job. Rejected and revoked sessions are out too.
