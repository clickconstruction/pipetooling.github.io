---
title: schedule people onto jobs
category: Scheduling
roles: assistant, superintendent, master_technician
keywords: schedule, dispatch, assign, blocks, not coming in, share schedule
order: 10
---
The Schedule page (`/schedule-dispatch`) is where the office puts people on jobs. Only devs, masters, assistants, and superintendents can open it — and if you can see it, you can edit it.

## The views

On a phone, the page uses a compact header: the three view tabs as a segmented switch with **Day** first, and a {{button:outline|+ Schedule}} button whose menu names every scheduling flow (Add one job, Quick Assign, Fill several days at once, Copy as a linked chain — the last two hop you to the People grid where the cells live). The page also opens on the **Day** view on phones; desktop keeps the full layout.

At every width, a single **⋯** menu at the top right holds the page's tools: **Visible hours** (on the Day view — the item shows the active window, and the ⋯ button glows blue while one is set), **Dispatch settings**, and **Share**.

On a phone, the People toolbar adds a green **⚡ Assign work** button — the same quick flow described in the Dispatch Mode guide (job → people with availability ribbons → suggested time → schedule). The hub has three view tabs — **People**, **Jobs**, and **Day** — plus a {{button:outline|Dispatch Settings}} button for edit roles. The People view is the workhorse: a weekly grid with people down the left and days across the top — today's column is tinted yellow and boxed in orange so it's easy to spot. Use the **Search Person or Job** box to jump around, and hide weekend columns when you don't need them. An **Expected manpower** readout totals who's scheduled.

Opening a single job (from a job link or the Pipeline board's Week dispatch button) shows that job's week grid — and below it, a **Work history** section: every past week the job saw approved clock time, newest first, with who worked and their hours. The header totals the whole job (hours · people · first–last work date), and a green **on the job now** chip lists anyone currently clocked in. Click a week row to expand it down to the individual sessions — clock-in → clock-out, duration, and any session note. Hours only; wages never appear here.

## Jumping here from the Dashboard

In the Dashboard's **Currently In** clock strip, every clocked-in person has a small calendar icon left of their name: {{chip:blue|2}} **blue with a white count** when they have jobs on today's schedule, **grey** when they have nothing scheduled. Clicking the **blue** icon opens that person's day right there — their scheduled blocks with times and job numbers on the timeline, edit and remove, day-to-day arrows, plus **+ Assign more work** and a link to the full Dispatch board. Clicking the **grey** icon opens the **Assign work** sheet with that person already selected — pick a job and a time without leaving the Dashboard, and the icon flips to the blue count as soon as the work is scheduled.

## Assigning someone to a job

Click the add control in a person's cell for the day. The **Add job to schedule** modal opens. Type to filter, then press {{chip:gray|↓}} / {{chip:gray|↑}} to highlight a result and {{chip:gray|Enter}} to pick it — or when the search narrows to a single job, {{chip:gray|Enter}} picks it right away.

:::example Add job to schedule
Search: `Search HCP or job name`

**J512** Smith House Repipe — 123 Main St &nbsp;{{chip:blue|Clocked today}}
**J498** Baker Kitchen Remodel — 88 Oak Ave

{{button:outline|Create new job}} &nbsp;·&nbsp; {{button:outline|Not coming in today}}
:::

{{gif:schedule-dispatch.gif|Adding a block from a day cell: the + control, the job picker, then times on the slider}}

Every result carries its billing state — {{chip:gray|Waiting}} {{chip:yellow|Working}} {{chip:purple|Ready to Bill}} {{chip:blue|Billed}} {{chip:green|Paid}} — with active jobs listed first and billed/paid ones greyed under a **Finished jobs** divider (still pickable for warranty callbacks, just never by accident). Active rows also show how many blocks the job already has this week. And when a search turns up **two jobs at the same address** — the classic repeat-customer trap — a warning banner says so, so you check the status chips before picking.

:::example Two jobs, one address
⚠ 2 jobs at 109 Tuscarora Trail — check the status before picking

**473 · Mike Holub** {{chip:yellow|Working}} ← the live one

**346 · Mike Holub** {{chip:blue|Billed}} — greyed, under Finished jobs
:::

Pick the job — a schedule block appears in the cell. Jobs the person already clocked into today show a {{chip:blue|Clocked today}} badge. Each row leads with its trade pill ({{chip:yellow|PLUM}}, ELEC, HVAC) and shows how long ago the job was added plus its address; the search box matches HCP number, job name, **address, and customer**. The small briefcase button at the left of a row opens that job's **Job Detail** right on top of the picker — from there **Edit job** swaps to the Edit Job form and back, and closing either one returns you to the picker exactly where you left it.

### Scheduling bid work

**Bids can go on the calendar too** — site walks, estimating visits, pre-construction work that has no job yet. Below the job rows, the same picker lists open bids (anything not marked lost) with a violet {{chip:purple|Bid}} chip; search matches the bid number, project name, and address. A bid block places, drags, copies, and links exactly like a job block, and everyone sees it as **B123 · Project name** — on this board, on their Dashboard **My Schedule**, and in the day reviews.

:::example Scheduling an estimator's site walk
Type the bid number in the Assign-work search, pick the {{chip:purple|Bid}} row, then click the person-day cell — the visit lands on their schedule as `B412 · Oakmont Clubhouse`, no placeholder job needed.
:::

**Opening a bid block.** Click a job block's time range and you get that job's week grid. A bid has no job to grid, so clicking a bid block's time range opens the **bid** instead — the Edit Bid window on the Bids page. (The title line on a bid block does nothing; Job Detail is for jobs.)

Each block can carry **job instructions**: click the pencil ("Edit job instructions") to open the **Job instructions** modal and {{button:blue|Save}}. Instructions are what the tech sees about the assignment, so use them for gate codes, scope reminders, and arrival details.

### Moving a block — no need to delete and re-add

Every block has a **dotted grip** on its left edge. **Drag the grip** to any other person or day cell and the block moves there — its times ride along, linked crew copies move together, and you get a warning if the landing spot overlaps something already scheduled. The grip turns red while a special mode (multi-cell add, linked copy) is active or when you don't have edit rights — tap it and it tells you why.

## Move a block from your phone

Dragging needs a mouse-sized grip and a drop target under your finger, so on a phone the board gives you two tap paths instead. Both keep the block's times, move linked crew copies together, and warn about an overlap exactly like a drag.

{{gif:schedule-dispatch-move-by-thumb.gif|Tap the grip, tap Fri — moved. Then press and hold the block, pick Thu, and Move to Thu brings it back}}

- **Tap the grip** {{chip:blue|⠿}} on the block. A blue bar appears with this week's days — tap {{button:outline|Fri 9/4}} and the block moves there for the same person, or tap any person's cell on the grid to move it to that person and day. {{button:outline|Cancel}} keeps it where it is.
- **Press and hold the block** (about half a second, anywhere on the job text) to open the **Move block** sheet: pick a day, any date from the picker, and the person, then hit {{button:blue|Move to Fri 9/4 · Paige}} — the button names exactly what will change. This works on a computer too.

:::example Moving J1004 from Thursday to Friday
Tap the grip on J1004, then tap **Fri** in the bar. Done — "Moved to Fri 9/4." Need it on Paige's Friday instead? Press and hold J1004, tap **Fri** and **Paige**, then **Move to Fri 9/4 · Paige**.
:::

### Rearranging someone's whole day

Every block also carries a small **clock button** tucked into the top-left corner of the instructions button (the chain link sits top-right, − and + along the bottom). Tap it to open **that person's entire day** in one place — every block with times, a mini timeline, and who else is linked on each one:

- **One-tap nudges on every block**: {{button:outline|⇤ −30}} / {{button:outline|+30 ⇥}} shift the whole block half an hour; {{button:outline|end −30}} / {{button:outline|end +30}} stretch or trim just the end (the "job's running long" tap). On a linked block the nudge moves the **whole crew together**, so linked copies never drift apart.
- **✎ Edit** still handles precise times, a day move, and note changes — and on a linked block it asks whether the change is for the whole crew or **this person only, which unlinks them** from the crew copy first.
- **‹ ›** flip between days, and changes refresh the grid behind you immediately.

## Grouping people into swim lanes

Swim lanes are named crews everyone in the office shares — useful when the same people tend to ride together. The People grid starts out grouped **by swim lanes**: each lane appears as its own section (in your office's lane order), with anyone unassigned collected under **Everyone else**. Click the **Person** header cell to cycle to the other groupings — alphabetical → by role → back to lanes; your pick is remembered on that device.

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

To put the same jobs on several people at once, use the chains button (two links of a chain) next to the **×** (multiply — one job across many cells) in the People toolbar. A bar appears at the top and walks you through two steps:

1. **1 of 2 — Click the job blocks you want to copy linked.** Every block gets a dashed outline; click the ones to copy (they highlight), then press {{button:blue|Next: pick people}}.
2. **2 of 2 — Click the people to apply them to.** Names in the left column become click targets. Each click instantly gives that person a **linked** copy of every selected block — same day, same times, same instructions, chained to the original so time and instruction changes stay in sync (the {{chip:blue|linked}} chains marker appears on the cards). If the grid is grouped by swim lanes, the lane headings become targets too — clicking "**<lane> — whole crew**" applies the blocks to every member of that lane in one click, with a single toast summing up what copied and what was skipped.

Copies that would overlap something already on that person's day — or that the person already has — are skipped, and the toast tells you how many applied. Click as many people as you need, then press {{chip:gray|Esc}} or **Done**.

## Adjusting times on the Day view

On the **Day** view, every scheduled job bar has an orange dot at its start and end. If you can edit the schedule, drag a dot left or right to change that time — it snaps to 15-minute steps and **auto-saves about 2 seconds after your last touch**, updating the People and Jobs views too. A job can never shrink below 30 minutes. (Switching tabs before the auto-save fires still saves your change first.)

- **Two jobs touching** share one bigger dot connecting them. Dragging it moves the end of the first job and the start of the second together, so they stay touching.
- **Click and hold** that shared dot to separate them: the later job jumps 15 minutes later without extending its end.
- **Drag one dot onto another** and they combine — the jobs are now touching.

:::example split back-to-back jobs
Two jobs meet at 2:30 PM under one dot. Hold the dot — the second job now starts at 2:45 PM, ending at its same time. Drag its start dot back onto 2:30 to rejoin them.
:::

## Reordering a person's day

Need job 3 to happen before job 2? On the **Day** view, tap the **⇅** button at the right end of a person's row (it appears when they have two or more jobs). Their jobs list in order with {{button:outline|▲}} {{button:outline|▼}} buttons — move one and the new times preview instantly:

:::example How the times move
Every job **keeps its own duration**, and the gaps between jobs stay where they were. If the day was 807 (8–10), 920 (10:30–12:30), 902 (1–4) and you move 902 up, it becomes 807 (8–10), 902 (10:30–1:30), 902's three hours intact, then 920 (2–4).
:::

Jobs tagged {{chip:gray|linked crew}} move for the whole crew — everyone's copy of that job shifts by the same amount, so the crew stays together. Hit {{button:blue|Save new order}} and every schedule surface (techs' Job Mode, My Schedule, emails) reflects the new order immediately, since they all sort by time.

## Travel-time hints on the Day view

When two of a person's jobs have known locations, the Day view estimates the drive between them. Locations fill in automatically: opening the Day view maps any scheduled address it doesn't know yet (a small "📍 Mapping…" note shows while it works), and if an address can't be found you'll see an amber note naming it — fix the job's address and the hints appear. By default that's a straight-line minimum (real traffic can only be worse, shown as {{chip:gray|🚗 ≥18m}}); with live routing on, it's a real road estimate (shown as {{chip:gray|🚗 ~22m}}) that quietly falls back to the straight-line number whenever routing is unavailable. Devs control all of this under {{button:outline|Dispatch Settings}} → **Travel time hints**: turn hints on/off, set the assumed average speed, and enable live routing.

- An open gap between jobs shows a 🚗 chip like {{chip:gray|🚗 ≥18m}} — red when the gap is shorter than the drive.
- Back-to-back jobs that are far apart turn their connecting dot **red**; hover it for the estimate.
- Jobs without a mapped address show nothing (the Map page is where addresses get geocoded).

## Choosing the Day view's visible hours

On the Dispatch **Day** tab, the {{button:outline|Visible hours ⚙}} button (right of the day controls) opens a small settings modal. Pick a start and end (within 4 AM–8 PM, at least an hour apart) and the timeline stretches that window across the page — handy when your crew works 7-to-5 and the early/late hours just waste space. The choice saves on your device only; **Reset to full day** puts it back. Jobs outside the window pin to its edge.

## When someone isn't coming in

Fastest path: on an empty person-day, click the small orange **off** button beside the blue **+** bar — it immediately marks that person as not coming in for that day (the cell shows the time-off chip; click the chip if you need to undo it).

For a day that already has jobs, use the **Add job to schedule** modal footer instead: press {{button:outline|Not coming in today}}. You'll get a confirmation — and a warning if it will remove existing schedule blocks for that day:

:::example Confirming a day off
Mark **Mike T** as not coming in on **Wed 7/9**?
This will also remove their **2 existing schedule blocks** for the day.

{{button:outline|Cancel}} &nbsp; {{button:red|Confirm not coming in}}
:::

## Who came in late

If someone clocks in more than 15 minutes after their first scheduled block, their day cell shows an amber **◔ Late** chip with how late they were (e.g. *◔ Late 2h 15m*). Nothing to mark and nothing to undo — it's computed from their actual clock-in against the schedule. Hover it for the receipt: scheduled start, actual clock-in, exact minutes. No chip means on time (within the grace window), and a person with **no** clock-in at all never shows Late — that's a call-out or no-show question, handled by the red chips above.

## No call, no show

When someone simply didn't show and didn't call, use **No call, no show** — the quieter red link next to {{button:outline|Not coming in today}} in the same footer (office and payroll-side roles only). This one has teeth: besides clearing the day's blocks and marking the day off, it **files an attendance incident** (visible in write-ups and People → Review) and **rejects any clock time** recorded for the day. You can add a line about what happened — it's saved on the incident.

The cell then shows a solid red **NCNS** chip instead of the softer "Not coming in" one. Clicking the chip clears the schedule marking if plans change — but the attendance incident stays on record; removing an incident is a separate payroll-side action.


Once confirmed, the cell shows a {{chip:red|Not coming in}} chip. Click the chip to undo it.

## Sharing the day's schedule

Press {{button:blue|Share}} to open the **Schedule share** modal:

- **Send now** — pick recipients, choose what to include (☑ **Current day** · ☐ **Next day** · ☐ **Rest of week**), and press {{button:blue|Send now}}.
- **Recurring** — set up automatic shares: recipients, days of the week, and a Central-time send time, then {{button:blue|Create recurring share}}. Existing shares can be paused with {{button:outline|Pause}} and resumed under "Active & paused shares".

## The standing office schedule

Office people used to get their "Office" block typed in by hand every morning. Now the schedule fills those in itself:

1. Open **Dispatch** (the gear on the schedule) → **Standing office schedule**.
2. Add each person who works office days — assistants, controllers, and estimators are offered — and adjust their daily window if it isn't 8:00–4:00.
3. That's it. Weekdays on the visible week get their Office block automatically, ahead of time.

The automation stays polite:

- **Days off win** — someone marked "not coming in" is never refilled.
- **Field dispatch wins** — if a person already has an overlapping job or bid block that day, no Office block is added.
- **Your deletions stick** — remove an auto-added block and it stays gone for that day.

:::example It's a normal block
Auto-added blocks are ordinary Office-job blocks — drag them, retime them, or delete them exactly like one you made yourself. Hours clocked against them land in overhead, same as always.
:::

## Daily rhythm

The Quickfill page embeds this schedule twice — **Schedule** ("Are there any obvious schedule conflicts?") and **Tomorrow's Schedule** ("Who is on what job tomorrow?") — so reviewing dispatch is part of the office's daily loop.
