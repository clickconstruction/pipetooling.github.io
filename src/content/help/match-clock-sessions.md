---
title: match clock sessions to jobs and bids
category: Office
roles: assistant
keywords: match sessions, unassigned, clock sessions, no job, assign job, hours, dispatch, reject session, test punch
order: 34
---

Someone clocks time without picking a job, and that session floats. Match sessions rounds up every floating session from the last 7 days and suggests where each one belongs.

Payroll knows the hours, but no job carries the labor. The **Match sessions** button suggests a home for each floating session. You can clear the whole list in a few taps.

Whatever surface you use, the job always goes on the session itself. The day's split is computed from the clock and never typed by hand. See [put a person's clocked hours on the right job](?g=put-clocked-hours-on-the-right-job).

## Where it is

Go to **People → Hours**. Find the **Currently clocked in** section header. The {{button:outline|Match sessions}} button there wears an amber count when sessions need sorting. That count is every session in the last 7 days with no job or bid. It counts them whether or not the person is still clocked in. At zero it goes quiet.

## Reading the list

Sessions are grouped by person. Each one shows the day, the time span, and the person's clock note. An open session carries a green "still clocked in" marker on the time span. Under that sit up to three **suggestions**, strongest first:

- **Dispatch**, in green, means the person had a Dispatch schedule block for that job that day. This is the strongest signal.
- **Crew that day**, in blue, means another of that person's sessions the same day already carries a job or bid.
- **From note**, in purple, means a job number was typed into the clock note, like "961 trim set".

:::example Darren's Friday
Fri 8/7 · 6:32 AM – 4:15 PM · 9.7h · *"961 trim set with paige"*
{{chip:green|Dispatch}} 878 · Lyndsey Lane- Remodel · scheduled 8 AM–12 PM — {{button:blue|Assign}}
:::

Tap {{button:blue|Assign}} on the right suggestion. The session is matched immediately. The row turns into a green "Matched" line with **Undo**. It is the same assignment the per-session Assign button makes. So approvals, the day audit, and Quickfill's unassigned list all see it at once.

## When there's no suggestion

Use **Search jobs & bids…** on the session. It opens the same search box you know from assigning sessions elsewhere. The person's Dispatch schedule quick-picks sit on top.

## When it was never a job

A test punch, a personal errand, or a clock-in that should not have happened belongs on no job. Do not match those. Tap {{button:red|Reject}} on the card instead. It asks once: *"Reject Bryan · Sat 9/5 · 9h 30m? Rejected time never reaches payroll."* Then the session is rejected, just as from the approvals queue. The card drops out. The hours never reach payroll. The session leaves the match list for good, not just this visit. Sessions still clocked in have no Reject. Wait for the clock-out. Rejected by mistake? People → Hours → **Rejected sessions** has Restore.

:::example Bryan's test punch
Sat 9/5 · 2:30 PM – 11:59 PM · 9h 30m · *"Test"*
{{button:outline|Search jobs & bids…}} {{button:red|Reject}}
:::

## The bulk shortcut

Some sessions have **exactly one** Dispatch match. That is one scheduled job that day, nothing ambiguous. The footer offers to apply them all in one tap. Sessions with two or more scheduled jobs are never bulk-matched. Those you decide one at a time.

## What doesn't show up

Salaried office schedules, the automatic salary sessions, are left out on purpose. They legitimately carry no job. Rejected and revoked sessions are out too.
