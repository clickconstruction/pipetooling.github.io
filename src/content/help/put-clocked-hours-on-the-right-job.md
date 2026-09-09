---
title: put a person's clocked hours on the right job
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller
keywords: assignments, link session, split day, clock session, no clock session, team board, people hours, day audit, crew split
order: 36
---

Which job carries a person's hours is never typed in. It comes from their **clock sessions**: put the job on the session and the day's split follows — as soon as the session exists, not only after it's approved. There are three places to do it, and they all write the same thing. (Approval still decides what payroll pays; it no longer decides which job carries the cost.)

## Where

- **Jobs → Team** — the week board. A person with hours and no job sits in the top row with the dispatch block for that day beside them: {{button:blue|Link to J650}} puts it on the sessions in one tap, {{button:outline|Pick job…}} searches instead. See [read the Team board](?g=read-the-team-board).
- **People → Hours → the unassigned pill** — the *Assign … to jobs or bids* window: **Common Jobs**, **Recent jobs & bids** and {{button:outline|+ Search jobs & bids}} each link the selected day's sessions in one tap. Days with hours but no clock session are listed as *Skipped — no clock session* instead of being offered.
- **The day audit** (a day cell on People → Hours): {{button:blue|Edit}} shows {{button:outline|+ Link 1 session (0.72 h)}} when a session has no job yet, beside the per-session {{button:blue|Assign}} control and {{button:outline|↺ Re-sync from clock}}. A session that is still pending carries the link into approval — the toast says *the split updates on approval*.

:::example Linking yesterday's floating hours
Isiah · 0.72 h with no job → {{button:blue|Link to J523}} (dispatch had him at Mission Hills). Toast: *Linked 1 session (0.72 h) to J523 · Mission Hills — split recomputed from the clock*. On the Team board the chip moves onto the Mission Hills row in green; on Pipeline, Mission Hills' man hours go up by 0.72.
:::

## Two jobs on one day

A person who worked two jobs needs two sessions. {{button:outline|Split day…}} (on the Team board or in the assign window) opens the day editor with that person's sessions: split one at the time they moved and give each piece its own job. Save, and the split shows both jobs at their real share of the day.

## Why you can't type a percentage

A hand-typed split has no clock session behind it, so it cannot be checked, and the next approval or time adjustment would overwrite it anyway. The old Crew Jobs / Bids table that allowed it is gone. If the day audit shows a row tagged {{chip:gray|manual · no clock}}, it is an old hand-entered split: {{button:outline|Clear}} removes it, and the hours stay unassigned until a session is approved and linked.

## No clock session

A day with pay but no punch has nothing to put a job on. The Team board shows the dispatch block as **planned, no clock** with {{button:outline|Add session}} and {{button:outline|Not coming in}}; the assign window skips the day; the day audit says *No clock session*. Approve or add the session first, then link it.

## If nothing changes when you link

The link edits the person's clock session, which needs pay access on the session — a dev, a controller, or a pay-approved leader. If the toast says no sessions were updated, your account can see the board but not edit that person's clock; ask a pay-approved leader to link it.
