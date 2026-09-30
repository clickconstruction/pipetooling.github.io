---
title: set how far back assistants can see and add hours
category: Office
roles: assistant, dev
keywords: assistant, hours, history, weeks, window, limit, week range, visibility, add clock session, earliest day, calendar, lookback
order: 87
---

Assistants working in People → Hours see a rolling window of recent weeks instead of the full hours history. The same window is how far back an assistant can add or change a clock session. A dev sets how wide that window is.

Out of the box that window is **three weeks**. That is the current week plus the two before it. Devs, controllers, and pay-approved leaders are never limited.

## What assistants see

The **Week range** controls stop at the edge of the window:

- The {{button:outline|← last week}} button grays out once the earliest visible week is showing.
- The clock strip's {{button:outline|Previous day}} button stops at the same edge. Day-by-day browsing can't go back further than the window either.
- The **Start** and **End** date pickers won't accept dates before the window. Typing an earlier date snaps back to the earliest allowed day.
- A note under the controls names the cutoff:

:::example The cutoff note
Hours history before Jul 26, 2026 is not available for your role.
:::

Everything inside the window works exactly as before. The clock strip, sessions, the hours grid, and totals are untouched.

## What assistants can add

You add a session for someone from the clock strip. Press {{button:outline|+ Add session}}, pick the person, then pick the **Day**. The calendar greys out every day before your window and every day after today. A line under the day names the earliest day you can use.

:::example The line under the day
Sun, Sep 13 through today. Ask the owner for earlier days.
:::

Then type the **Clocked in** and **Clocked out** times and say what the work was. {{button:blue|Save}} puts the session on that day. Someone else approves it.

A day audit and the Team board add a session onto one day. There the day is in the title and there is no day to pick.

The database holds the same rule. A session typed onto an earlier day is refused with the earliest day named, whatever screen it came from.

## Changing the window (dev)

Go to **Settings → People & teams → Assistant hours visibility**. Set **Weeks visible** to any number. The current week counts as one. Or check **No limit** to give assistants the full history and any day. {{button:blue|Save}} applies org-wide the next time each assistant loads the Hours tab.
