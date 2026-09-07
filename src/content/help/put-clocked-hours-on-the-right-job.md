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

## If nothing changes when you link

The link edits the person's clock session, which needs pay access on the session — a dev, a pay-approved master, or an assistant adopted under one. If the toast says no sessions were updated, your account can see the table but not edit that person's clock; ask a pay-approved master to link it.
