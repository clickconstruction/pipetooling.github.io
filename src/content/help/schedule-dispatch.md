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

## Assigning someone to a job

Click the add control in a person's cell for the day. The **Add job to schedule** modal opens:

:::example Add job to schedule
Search: `Search HCP or job name`

**J512** Smith House Repipe — 123 Main St &nbsp;{{chip:blue|Clocked today}}
**J498** Baker Kitchen Remodel — 88 Oak Ave

{{button:outline|Create new job}} &nbsp;·&nbsp; {{button:outline|Not coming in today}}
:::

Pick the job — a schedule block appears in the cell. Jobs the person already clocked into today show a {{chip:blue|Clocked today}} badge.

Each block can carry a note: click the pencil ("Edit block note") to open the **Schedule block note** modal and {{button:blue|Save}}. Notes are what the tech sees about the assignment, so use them for gate codes, scope reminders, and arrival instructions.

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
