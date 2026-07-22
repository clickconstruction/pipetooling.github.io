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

## Grouping people into swim lanes

Swim lanes are named crews everyone in the office shares — useful when the same people tend to ride together. Click the **Person** header cell to cycle how the left column is grouped: alphabetical → by role → **by swim lanes**. In lanes mode each lane appears as its own section (in your office's lane order), with anyone unassigned collected under **Everyone else**.

To manage the lanes, open {{button:outline|Dispatch Settings}} and find **Swim lanes (People grid crews)**:

:::example Swim lanes manager
**Underground crew** &nbsp; {{button:outline|↑}} {{button:outline|↓}} {{button:outline|Rename}} {{button:outline|Delete}}
{{chip:blue|Marcus D ×}} {{chip:blue|Ray T ×}} &nbsp; Add person…
:::

- {{button:blue|Add lane}} creates a crew; **↑/↓** set the order lanes appear on the grid.
- A person belongs to **one** lane at a time — picking someone who's already in another lane moves them (the picker warns "(moves from …)").
- Changes save **immediately** and everyone sees the same lanes; deleting a lane just returns its people to **Everyone else**.

Lanes do more than group the grid: typing a lane's name in the **Search Person or Job** box filters to that crew, and the **Expected manpower** readout adds a per-lane line so you can see each crew's scheduled hours at a glance.

## Copying jobs to a whole crew (linked)

To put the same jobs on several people at once, use the chains button (two links of a chain) next to the **++** in the People toolbar. A bar appears at the top and walks you through two steps:

1. **1 of 2 — Click the job blocks you want to copy linked.** Every block gets a dashed outline; click the ones to copy (they highlight), then press {{button:blue|Next: pick people}}.
2. **2 of 2 — Click the people to apply them to.** Names in the left column become click targets. Each click instantly gives that person a **linked** copy of every selected block — same day, same times, same note, chained to the original so time and note changes stay in sync (the {{chip:blue|linked}} chains marker appears on the cards). If the grid is grouped by swim lanes, the lane headings become targets too — clicking "**<lane> — whole crew**" applies the blocks to every member of that lane in one click, with a single toast summing up what copied and what was skipped.

Copies that would overlap something already on that person's day — or that the person already has — are skipped, and the toast tells you how many applied. Click as many people as you need, then press {{chip:gray|Esc}} or **Done**.

## Adjusting times on the Day view

On the **Day** view, every scheduled job bar has an orange dot at its start and end. If you can edit the schedule, drag a dot left or right to change that time — it snaps to 15-minute steps and **auto-saves about 2 seconds after your last touch**, updating the People and Jobs views too. A job can never shrink below 30 minutes. (Switching tabs before the auto-save fires still saves your change first.)

- **Two jobs touching** share one bigger dot connecting them. Dragging it moves the end of the first job and the start of the second together, so they stay touching.
- **Click and hold** that shared dot to separate them: the later job jumps 15 minutes later without extending its end.
- **Drag one dot onto another** and they combine — the jobs are now touching.

:::example split back-to-back jobs
Two jobs meet at 2:30 PM under one dot. Hold the dot — the second job now starts at 2:45 PM, ending at its same time. Drag its start dot back onto 2:30 to rejoin them.
:::

## Travel-time hints on the Day view

When two of a person's jobs have known locations, the Day view estimates the drive between them. By default that's a straight-line minimum (real traffic can only be worse, shown as {{chip:gray|🚗 ≥18m}}); with live routing on, it's a real road estimate (shown as {{chip:gray|🚗 ~22m}}) that quietly falls back to the straight-line number whenever routing is unavailable. Devs control all of this under {{button:secondary|Dispatch Settings}} → **Travel time hints**: turn hints on/off, set the assumed average speed, and enable live routing.

- An open gap between jobs shows a 🚗 chip like {{chip:gray|🚗 ≥18m}} — red when the gap is shorter than the drive.
- Back-to-back jobs that are far apart turn their connecting dot **red**; hover it for the estimate.
- Jobs without a mapped address show nothing (the Map page is where addresses get geocoded).

## Choosing the Day view's visible hours

On the Dispatch **Day** tab, the {{button:secondary|Visible hours ⚙}} button (right of the day controls) opens a small settings modal. Pick a start and end (within 4 AM–8 PM, at least an hour apart) and the timeline stretches that window across the page — handy when your crew works 7-to-5 and the early/late hours just waste space. The choice saves on your device only; **Reset to full day** puts it back. Jobs outside the window pin to its edge.

## When someone isn't coming in

Fastest path: on an empty person-day, click the small orange **off** button beside the blue **+** bar — it immediately marks that person as not coming in for that day (the cell shows the time-off chip; click the chip if you need to undo it).

For a day that already has jobs, use the **Add job to schedule** modal footer instead: press {{button:outline|Not coming in today}}. You'll get a confirmation — and a warning if it will remove existing schedule blocks for that day:

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
