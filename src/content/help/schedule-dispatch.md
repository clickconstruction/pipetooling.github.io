---
title: schedule people onto jobs
category: Scheduling
roles: assistant, superintendent, master_technician
keywords: schedule, dispatch, assign, blocks, not coming in, share schedule
order: 10
---
The Schedule page (`/schedule-dispatch`) is where the office puts people on jobs. Only devs, masters, assistants, and superintendents can open it — and if you can see it, you can edit it.

## The views

The hub has three view tabs — **People**, **Jobs**, and **Day** — plus a {{button:outline|Dispatch Settings}} button for edit roles. The People view is the workhorse: a weekly grid with people down the left and days across the top. Use the **Search Person or Job** box to jump around, and hide weekend columns when you don't need them. An **Expected manpower** readout totals who's scheduled.

Opening a single job (from a job link or the Stages board's Week dispatch button) shows that job's week grid — and below it, a **Work history** section: every past week the job saw approved clock time, newest first, with who worked and their hours. The header totals the whole job (hours · people · first–last work date), and a green **on the job now** chip lists anyone currently clocked in. Click a week row to expand it down to the individual sessions — clock-in → clock-out, duration, and any session note. Hours only; wages never appear here.

## Jumping here from the Dashboard

In the Dashboard's **Currently In** clock strip, every clocked-in person has a small calendar icon left of their name: {{chip:blue|2}} **blue with a white count** when they have jobs on today's schedule, **grey** when they have nothing scheduled. Click it and you land on this page with that person's row highlighted and scrolled into view — ready to add jobs for them.

## Assigning someone to a job

Click the add control in a person's cell for the day. The **Add job to schedule** modal opens. Type to filter, then press {{chip:gray|↓}} / {{chip:gray|↑}} to highlight a result and {{chip:gray|Enter}} to pick it — or when the search narrows to a single job, {{chip:gray|Enter}} picks it right away.

:::example Add job to schedule
Search: `Search HCP or job name`

**J512** Smith House Repipe — 123 Main St &nbsp;{{chip:blue|Clocked today}}
**J498** Baker Kitchen Remodel — 88 Oak Ave

{{button:outline|Create new job}} &nbsp;·&nbsp; {{button:outline|Not coming in today}}
:::

Pick the job — a schedule block appears in the cell. Jobs the person already clocked into today show a {{chip:blue|Clocked today}} badge.

Each block can carry a note: click the pencil ("Edit block note") to open the **Schedule block note** modal and {{button:blue|Save}}. Notes are what the tech sees about the assignment, so use them for gate codes, scope reminders, and arrival instructions.

## Adjusting times on the Day view

On the **Day** view, every scheduled job bar has an orange dot at its start and end. If you can edit the schedule, drag a dot left or right to change that time — it snaps to 15-minute steps and **auto-saves about 2 seconds after your last touch**, updating the People and Jobs views too. A job can never shrink below 30 minutes. (Switching tabs before the auto-save fires still saves your change first.)

- **Two jobs touching** share one bigger dot connecting them. Dragging it moves the end of the first job and the start of the second together, so they stay touching.
- **Click and hold** that shared dot to separate them: the later job jumps 15 minutes later without extending its end.
- **Drag one dot onto another** and they combine — the jobs are now touching.

:::example split back-to-back jobs
Two jobs meet at 2:30 PM under one dot. Hold the dot — the second job now starts at 2:45 PM, ending at its same time. Drag its start dot back onto 2:30 to rejoin them.
:::

## Travel-time hints on the Day view

When two of a person's jobs have known locations, the Day view estimates the minimum drive between them (straight-line distance with a road factor — real traffic can only be worse):

- An open gap between jobs shows a 🚗 chip like {{chip:gray|🚗 ≥18m}} — red when the gap is shorter than the drive.
- Back-to-back jobs that are far apart turn their connecting dot **red**; hover it for the estimate.
- Jobs without a mapped address show nothing (the Map page is where addresses get geocoded).

## Choosing the Day view's visible hours

On the Dispatch **Day** tab, the {{button:secondary|Visible hours ⚙}} button (right of the day controls) opens a small settings modal. Pick a start and end (within 4 AM–8 PM, at least an hour apart) and the timeline stretches that window across the page — handy when your crew works 7-to-5 and the early/late hours just waste space. The choice saves on your device only; **Reset to full day** puts it back. Jobs outside the window pin to its edge.

## When someone isn't coming in

In the **Add job to schedule** modal footer, press {{button:outline|Not coming in today}}. You'll get a confirmation — and a warning if it will remove existing schedule blocks for that day:

:::example Confirming a day off
Mark **Mike T** as not coming in on **Wed 7/9**?
This will also remove their **2 existing schedule blocks** for the day.

{{button:outline|Cancel}} &nbsp; {{button:red|Confirm not coming in}}
:::

Once confirmed, the cell shows a {{chip:red|Not coming in}} chip. Click the chip to undo it.

## Sharing the day's schedule

Press {{button:blue|Share}} to open the **Schedule share** modal:

- **Send now** — pick recipients, choose what to include (☑ **Current day** · ☐ **Next day** · ☐ **Rest of week**), and press {{button:blue|Send now}}.
- **Recurring** — set up automatic shares: recipients, days of the week, and a Central-time send time, then {{button:blue|Create recurring share}}. Existing shares can be paused with {{button:outline|Pause}} and resumed under "Active & paused shares".

## Daily rhythm

The Quickfill page embeds this schedule twice — **Schedule** ("Are there any obvious schedule conflicts?") and **Tomorrow's Schedule** ("Who is on what job tomorrow?") — so reviewing dispatch is part of the office's daily loop.
