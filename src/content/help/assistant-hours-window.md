---
title: set how far back assistants can see hours
category: Office
roles: assistant, dev
keywords: assistant, hours, history, weeks, window, limit, week range, visibility
order: 87
---

Assistants working in **People → Hours** see a rolling window of recent weeks instead of the full hours history. Out of the box that window is **three weeks** — the current week plus the two before it. Devs, controllers, and pay-approved masters are never limited.

## What assistants see

The **Week range** controls stop at the edge of the window:

- The {{button:outline|← last week}} button grays out once the earliest visible week is showing.
- The clock strip's {{button:outline|Previous day}} button stops at the same edge — day-by-day browsing can't go back further than the window either.
- The **Start** and **End** date pickers won't accept dates before the window; typing an earlier date snaps back to the earliest allowed day.
- A note under the controls names the cutoff:

:::example The cutoff note
Hours history before Jul 26, 2026 is not available for your role.
:::

Everything inside the window works exactly as before — the clock strip, sessions, the hours grid, and totals are untouched.

## Changing the window (dev)

Go to **Settings → People & accounts → Assistant hours visibility**. Set **Weeks visible** to any number (the current week counts as one), or check **No limit** to give assistants the full history again. {{button:blue|Save}} applies org-wide the next time each assistant loads the Hours tab.
