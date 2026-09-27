---
title: work the hours grid on a phone
category: Office
roles: dev, master_technician, assistant, controller
keywords: hours grid, mobile, phone, day sheet, pending sessions, my time, tap, odometer
---

On a phone, **People → Hours** opens on three views, behind one switch that stays at the top:

- **Who's in** — everyone clocked in right now: when they came in, the job in words (or {{chip:yellow|no job}}), and the session so far. Under them, who worked today and has left.
- **Approvals** — everyone with hours waiting, the longest-waiting first: the days, the sessions and the hours.
- **Week & sessions** — the clock strip, the grid and the sessions, described below.

Tap a person in either list and their own screen opens: what they are on now, the week so far, what is waiting, and **Approve**.

## The grid

Under **Week & sessions**, the grid trades its tiny desktop targets for one simple rule: **tap the day, act in the sheet**. Every cell is one big button — no fiddly badge or corner icon to hit.

## Reading the grid

Each cell shows the day's hours with its status as a small word underneath:

- {{chip:yellow|2 pending}} — sessions on that day are awaiting approval
- {{chip:red|no job}} — the day is marked Correct but has hours with no job assignment
- A small teal dot means the day has clock detail to open in My Time

## The day sheet

Tap any cell and a sheet slides up from the bottom for that person and day:

:::example Bryan · Wed Aug 12
**1:25:01** {{button:blue|Save}}

{{chip:yellow|3 pending sessions · +1.42 h}} — Review and approve ›

{{chip:green|Open My Time}} — Sessions, jobs, and the day editor ›
:::

- **The hours box** is where you type the day's hours — press {{button:blue|Save}} or Enter. It follows the same rules as the desktop cells, including the offer to record a matching manual session.
- **Review and approve** opens the same pending-sessions list the desktop's amber badge shows, with per-session approve.
- **Open My Time** jumps to the person's day detail — sessions, jobs, and the day editor.
- On days marked **Correct**, the hours box locks and a **view audit** row appears instead.

On desktop nothing changes — the inline hours boxes, the amber pending badge, and the teal corner all work as before.
