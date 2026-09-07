---
title: put a person's clocked hours on the right job
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller
keywords: crew jobs, crew bids, team labor, assignments, link session, split day, clock session, no clock session, quickfill
order: 36
---

The **Crew Jobs / Bids** table (Jobs → **Team Labor**, and the same block on Quickfill) shows, for one day, each person's hours and which job or bid carries them. That split is not typed in — it comes from the person's **approved clock sessions**. The {{button:outline|+}} on a row puts a job on the sessions, and the split follows.

## Read the row

- **Hours** — the person's payroll hours for the day (salaried people show their flat day).
- **Assignments** — one of three states:
  - {{button:outline|Link 1 session (0.72 h)}} — the person has approved time with no job or bid on it yet. Press it, pick a job or bid, and every unlinked session that day is linked to it. The split recomputes from the clock and the row locks.
  - {{chip:blue|⏱ from clock}} with the split — every session is linked. The percentages are the sessions' share of the day; there is nothing to type.
  - **No clock session** — nobody approved time for this person that day, so there is no split to make. Approve their session first (People → Hours, or the clock strip), then come back.

:::example Linking yesterday's floating hours
Isiah · 0.72 · {{button:outline|Link 1 session (0.72 h)}} → search **Mission Hills** → pick it. Toast: *Linked 1 session (0.72 h) to J523 · Mission Hills — split recomputed from the clock*. The row now reads {{chip:blue|⏱ from clock}} **J523 · Mission Hills 100 %**, and Team Job Labor's Man Hours for Mission Hills went up by 0.72.
:::

## Two jobs on one day

A person who worked two jobs needs two sessions. Press {{button:outline|Split day…}} on the row: the day editor opens with that person's sessions, where you split one at the time they moved and give each piece its own job. Save, and the split here shows both jobs at their real share of the day.

## Why you can't type a percentage

A hand-typed split has no clock session behind it, so it cannot be checked, and the next approval or time adjustment would overwrite it anyway. If you see a row tagged {{chip:gray|manual · no clock}}, it is an old hand-entered split: {{button:outline|Clear}} removes it, and the hours stay unassigned until a session is approved and linked.

## The same rule on People → Hours

Two more places used to let you type a split by hand. Both now put the job on the clock sessions instead:

- **Assign … to jobs or bids** (the unassigned pill on a person's row): **Common Jobs**, **Recent jobs & bids** and {{button:outline|+ Search jobs & bids}} each link the selected day's sessions in one tap — no {{button:blue|Accept}} needed. Days with hours but no clock session are listed as *Skipped — no clock session* instead of being offered.
- **The day audit** (tap a day cell): {{button:blue|Edit}} shows {{button:outline|+ Link 1 session (0.72 h)}} when a session has no job yet, beside the per-session {{button:blue|Assign}} control and {{button:outline|↺ Re-sync from clock}}. A session that is still pending carries the link into approval — the toast says *the split updates on approval*.

## If nothing changes when you link

The link edits the person's clock session, which needs pay access on the session — a dev, a controller, or a pay-approved master. If the toast says no sessions were updated, your account can see the table but not edit that person's clock; ask a pay-approved master to link it.
