---
title: schedule people onto jobs
category: Jobs & Scheduling
roles: assistant, superintendent, master_technician
keywords: schedule, dispatch, assign, blocks, not coming in, share schedule, phone, board, day strip, copy to techs, desktop view, tech card
order: 10
---
The Schedule page is where the office puts people on jobs. Only devs, leaders, assistants, and superintendents can open it.

Its address is `/schedule-dispatch`. If you can see it, you can edit it.

## The views

On a phone, the page uses a compact header. The three view tabs sit in a segmented switch with **Day** first. A {{button:outline|+ Schedule}} button has a menu that names every scheduling flow. Those are Add one job, Quick Assign, Fill several days at once, and Copy as a linked chain. The last two hop you to the People grid where the cells live. The page also opens on the **Day** view on phones. Desktop keeps the full layout.

At every width, a single **⋯** menu at the top right holds the page's tools. They are **Visible hours**, **Dispatch settings**, and **Share**. **Visible hours** is on the Day view. The item shows the active window, and the ⋯ button glows blue while one is set.

On a phone, the People toolbar adds a green **⚡ Assign work** button. It is the same quick flow described in the Dispatch Mode guide. The flow is job → people with availability ribbons → suggested time → schedule. The hub has three view tabs: **People**, **Jobs**, and **Day**. It also has a {{button:outline|Dispatch Settings}} button for edit roles. The People view is the workhorse. It is a weekly grid with people down the left and days across the top. Today's column is tinted yellow and boxed in orange so it is easy to spot. You use the **Search Person or Job** box to jump around. You hide weekend columns when you do not need them. An **Expected manpower** readout totals who is scheduled.

You open a single job from a job link or the Pipeline board's Week dispatch button. That shows the job's week grid. Below it is a **Work history** section. It lists every past week the job saw approved clock time, newest first, with who worked and their hours. The header totals the whole job: hours, people, and first to last work date. A green **on the job now** chip lists anyone currently clocked in. You click a week row to expand it down to the individual sessions. Each shows clock-in → clock-out, duration, and any session note. Hours only. Wages never appear here.

## The People board on a phone

On a phone the **People** view is a board, not a grid. It shows **one day at a time, full width**. A **day strip** runs across the top, Mon to Fri with each day's block count. Today is ringed. You tap a day to switch. The week arrows still step a week at a time.

Every tech is a **card**. It shows their name. It shows a {{chip:red|Not coming in}} chip when they have said so. You tap the chip to clear the marking. It shows one row per block that day, with a *no note* marker on blocks still waiting for instructions. A full-width **+ Add here** sits at the bottom. You tap a block row for its sheet. The sheet offers **Open the job**, **Add a note**, **Copy to techs**, **Move**, and **Remove from the schedule**. There are no drag handles on the phone. Moving is a button on that sheet.

:::example Adding a job to two techs, one-handed
Tap {{button:outline|Copy to techs}} on Abraham's J927 row. A checklist of people opens with each person's day as a small ribbon and *free 12–4* / *busy 8–5* beside their name; tap a team band to take the whole crew. Keep **Linked crew** on so their blocks move together, then {{button:blue|Add to 2 techs}}.
:::

You may be placing something: adding a job, copying one, or filling several days. Then the **whole card becomes the button** and says what will land: *Tap to add J927 · 12–4 here*. Cards that are busy at that time say so. They still take the tap if overlapping is what you mean. The instruction lives in a dark **bar just above the tab bar**, with **Cancel** beside it.

Want the whole week side by side? You scroll to the **very bottom of the page**, past **Expected manpower**. {{button:outline|▦ Show the desktop view}} brings back the week grid exactly as on a computer. The same spot then offers {{button:outline|📱 Back to the phone view}}. The device remembers whichever you picked last, at any width. A phone turned sideways in a truck mount keeps the board. A tablet or a narrow window can choose it. While you are in the middle of placing something, the switch steps aside. So the Cancel bar has the bottom of the screen to itself.

## Jumping here from the Dashboard

In the Dashboard's **Currently In** clock strip, every clocked-in person has a small calendar icon left of their name. It is {{chip:blue|2}} **blue with a white count** when they have jobs on today's schedule. It is **grey** when they have nothing scheduled. You click the **blue** icon and that person's day opens right there. It shows their scheduled blocks with times and job numbers on the timeline. It has edit and remove, day-to-day arrows, **+ Assign more work** and a link to the full Dispatch board. You click the **grey** icon and the **Assign work** sheet opens with that person already selected. You pick a job and a time without leaving the Dashboard. The icon flips to the blue count as soon as the work is scheduled.

## Assigning someone to a job

You click the add control in a person's cell for the day. The **Add job to schedule** modal opens. You type to filter. You press {{chip:gray|↓}} / {{chip:gray|↑}} to highlight a result and {{chip:gray|Enter}} to pick it. When the search narrows to a single job, {{chip:gray|Enter}} picks it right away.

:::example Add job to schedule
Search: `Search HCP or job name`

**J512** Smith House Repipe — 123 Main St &nbsp;{{chip:blue|Clocked today}}
**J498** Baker Kitchen Remodel — 88 Oak Ave

{{button:outline|Create new job}} &nbsp;·&nbsp; {{button:outline|Not coming in today}}
:::

{{gif:schedule-dispatch.gif|Adding a block from a day cell: the + control, the job picker, then times on the slider}}

The **Day** tab's person-row **+** offers {{button:outline|Create new job}} too. So does the same picker on Quickfill and a Person Desk. New Job opens. When you press Create Job, the new job lands straight in the add-block step for that person and day.

Every result carries its billing state: {{chip:gray|Waiting}} {{chip:yellow|Working}} {{chip:purple|Ready to Bill}} {{chip:blue|Billed}} {{chip:green|Paid}}. Active jobs are listed first. Billed and paid ones are greyed under a **Finished jobs** divider. They are still pickable for warranty callbacks, just never by accident. Active rows also show how many blocks the job already has this week. A search may turn up **two jobs at the same address**, the classic repeat-customer trap. Then a warning banner says so. So you check the status chips before picking.

:::example Two jobs, one address
⚠ 2 jobs at 109 Tuscarora Trail — check the status before picking

**473 · Mike Holub** {{chip:yellow|Working}} ← the live one

**346 · Mike Holub** {{chip:blue|Billed}} — greyed, under Finished jobs
:::

You pick the job and a schedule block appears in the cell. Jobs the person already clocked into today show a {{chip:blue|Clocked today}} badge. Each row leads with its trade pill: {{chip:yellow|PLUM}}, ELEC, HVAC. It shows how long ago the job was added plus its address. The search box matches HCP number, job name, **address, and customer**. The small briefcase button sits at the left of a row. It opens that job's **Job Detail** right on top of the picker. From there **Edit job** swaps to the Edit Job form and back. Closing either one returns you to the picker exactly where you left it.

### Scheduling bid work

**Bids can go on the calendar too.** That covers site walks, estimating visits, and pre-construction work that has no job yet. Below the job rows, the same picker lists open bids, anything not marked lost. Each has a violet {{chip:purple|Bid}} chip. Search matches the bid number, project name, and address. A bid block places, drags, copies, and links exactly like a job block. On this board it is **tinted violet** with a small {{chip:purple|bid}} chip. Everywhere else it reads ***Bid visit · B123 · Project name***, never a bare *— · Job*. Everywhere else means the Day view, and a person's day, week, and month schedule.

:::example Scheduling an estimator's site walk
Type the bid number in the Assign-work search, pick the {{chip:purple|Bid}} row, then click the person-day cell — the visit lands on their schedule as `Bid visit · B412 · Oakmont Clubhouse`, no placeholder job needed.
:::

**Opening a bid block.** You click a job block's time range and you get that job's week grid. A bid has no job to grid. So clicking a bid block, its title or its time range, opens the **bid** instead. That is the Edit Bid window on the Bids page.

**Bid visits in the Jobs tab.** The Jobs tab's job × day matrix lists bid visits under the job rows. They have the same per-day counts and an {{button:purple|Open}} button that goes to the bid. So a week's bid meetings count as commitments too.

:::example The same bid, three places
People grid: a violet card, {{chip:purple|bid}} **Bid visit · B412 · Oakmont Clubhouse**, 9:00–11:00. Day view: the bar reads **Bid visit · B412 · Oakmont Clubhouse** and the Clocked line under it shows what actually happened. Jobs tab: a **Bid visit · B412 · Oakmont Clubhouse** row with a 1 under Tuesday.
:::

Each block can carry **job instructions**. You click the pencil, "Edit job instructions", to open the **Job instructions** modal. You press {{button:blue|Save}}. Instructions are what the tech sees about the assignment. So you use them for gate codes, scope reminders, and arrival details.

### Moving a block — no need to delete and re-add

Every block has a **dotted grip** on its left edge. **Drag the grip** to any other person or day cell and the block moves there. Its times ride along. Linked crew copies move together. You get a warning if the landing spot overlaps something already scheduled. The grip turns red while a special mode is active, like multi-cell add or linked copy. It also turns red when you do not have edit rights. You tap it and it tells you why.

## Move a block from your phone

Dragging needs a mouse-sized grip and a drop target under your finger. So on a phone the board gives you two tap paths instead. Both keep the block's times. Both move linked crew copies together. Both warn about an overlap exactly like a drag.

{{gif:schedule-dispatch-move-by-thumb.gif|Tap the grip, tap Fri — moved. Then press and hold the block, pick Thu, and Move to Thu brings it back}}

- **Tap the grip** {{chip:blue|⠿}} on the block. A blue bar appears with this week's days. You tap {{button:outline|Fri 9/4}} and the block moves there for the same person. Or you tap any person's cell on the grid to move it to that person and day. {{button:outline|Cancel}} keeps it where it is.
- **Press and hold the block** for about half a second, anywhere on the job text. That opens the **Move block** sheet. You pick a day, any date from the picker, and the person. Then you hit {{button:blue|Move to Fri 9/4 · Paige}}. The button names exactly what will change. This works on a computer too.

:::example Moving J1004 from Thursday to Friday
Tap the grip on J1004, then tap **Fri** in the bar. Done — "Moved to Fri 9/4." Need it on Paige's Friday instead? Press and hold J1004, tap **Fri** and **Paige**, then **Move to Fri 9/4 · Paige**.
:::

### Rearranging someone's whole day

Every block also carries a small **clock button** tucked into the top-left corner of the instructions button. The chain link sits top-right, with − and + along the bottom. You tap it to open **that person's entire day** in one place. That shows every block with times, a mini timeline, and who else is linked on each one:

- **One-tap nudges on every block**: {{button:outline|⇤ −30}} / {{button:outline|+30 ⇥}} shift the whole block half an hour. {{button:outline|end −30}} / {{button:outline|end +30}} stretch or trim just the end. That is the "job's running long" tap. On a linked block the nudge moves the **whole crew together**. So linked copies never drift apart.
- **✎ Edit** still handles precise times, a day move, and note changes. On a linked block it asks whether the change is for the whole crew. Or it is for **this person only, which unlinks them** from the crew copy first.
- **‹ ›** flip between days, and changes refresh the grid behind you immediately.

## Grouping people into swim lanes

Swim lanes are named crews everyone in the office shares. They are useful when the same people tend to ride together. The People grid starts out grouped **by swim lanes**. Each lane appears as its own section, in your office's lane order. Anyone unassigned is collected under **Everyone else**. You click the **Person** header cell to cycle to the other groupings: alphabetical → by role → back to lanes. Your pick is remembered on that device.

To manage the lanes, you open {{button:outline|Dispatch Settings}} and find ***Swim lanes (People grid crews)***. Lanes and the office schedule **save as you go**. Each change writes for everyone the moment you make it. The footer's **Cancel** only drops unsaved changes to job instructions. The modal says so once you have edited a lane.

:::example Swim lanes manager
**Underground crew** &nbsp; {{button:outline|↑}} {{button:outline|↓}} {{button:outline|Rename}} {{button:outline|Delete}}
{{chip:blue|Marcus D ×}} {{chip:blue|Ray T ×}} &nbsp; Add person…
:::

- {{button:blue|Add lane}} creates a crew. **↑/↓** set the order lanes appear on the grid.
- A person belongs to **one** lane at a time. Picking someone who is already in another lane moves them. The picker warns *(moves from …)*.
- Changes save **immediately** and everyone sees the same lanes. Deleting a lane just returns its people to **Everyone else**.

Lanes do more than group the grid. Typing a lane's name in the **Search Person or Job** box filters to that crew. The **Expected manpower** readout adds a per-lane line. So you can see each crew's scheduled hours at a glance.

## Copying jobs to a whole crew (linked)

To put the same jobs on several people at once, you use the chains button in the People toolbar. It shows two links of a chain. It sits next to the **×** multiply button, which puts one job across many cells. A bar appears at the top and walks you through two steps:

1. ***1 of 2 — Click the job blocks you want to copy linked.*** Every block gets a dashed outline. Click the ones to copy and they highlight. Then press {{button:blue|Next: pick people}}.
2. ***2 of 2 — Click the people to apply them to.*** Names in the left column become click targets. Each click instantly gives that person a **linked** copy of every selected block. It has the same day, same times, same instructions. It is chained to the original so time and instruction changes stay in sync. The {{chip:blue|linked}} chains marker appears on the cards. If the grid is grouped by swim lanes, the lane headings become targets too. Click ***<lane> — whole crew*** and the blocks apply to every member of that lane in one click. A single toast sums up what copied and what was skipped.

Copies that would overlap something already on that person's day are skipped. So are copies the person already has. The toast tells you how many applied. You click as many people as you need, then press {{chip:gray|Esc}} or **Done**.

## When nobody on a block can run the job

Every helper and sub carries a *needs supervision* switch. See *say who can run a job on their own*. A block, solo or a linked crew, may have people who all still need supervision. It wears an amber {{chip:yellow|unsupervised}} pill on its time line. The Add / Edit block window says so under the person's name while you build it. It is a warning, never a stop. You add a master, or someone who can run a job, as a linked copy. Or you save it anyway if the office knows something the roster does not. A master on the block always covers it.

## The Day view on a phone

On a phone the Day view opens on the **crews**. Those are leaders, then superintendents, subcontractors and helpers, because those are the people you dispatch. Three chips under the date choose who is listed, and each says how many:

{{chip:blue|Crews 9}} {{chip:gray|Office 7}} {{chip:gray|Free 14}}

- **Crews** is everyone on a crew with a block that day.
- **Office** is assistants, controllers, primaries, estimators and devs with a block.
- **Free** is anyone with nothing on the day, whatever their role. You tap a person's **+** to give them a block.
- An amber **no note** count on the right says how many crew blocks carry no note.
- Typing in search looks across all three at once.

**Tap a block** on the hub's Day tab and its sheet comes up from the bottom. It shows the job, the time, the person, and the address, with:

- {{button:outline|Open the job}} opens the job window with this visit's times.
- {{button:outline|Add a note}} holds what the tech needs to know. It reads **Edit the note** once there is one.
- {{button:outline|Move or reassign}} lets you pick the day and the person in one sheet.
- {{button:red|Remove from the schedule}} removes only this block. Crew-mates keep theirs.

A person's clock opens from their **name** and from the teal Clocked rows, not from a block.

The date and the chips stay at the top while you scroll. The **Hide assistants and estimators** toggle is a desktop control. On a phone the Office chip does that job.

## Adjusting times on the Day view

On the **Day** view, every scheduled job bar has an orange dot at its start and end. If you can edit the schedule, you drag a dot left or right to change that time. It snaps to 15-minute steps. It **auto-saves about 2 seconds after your last touch**, updating the People and Jobs views too. A job can never shrink below 30 minutes. Switching tabs before the auto-save fires still saves your change first.

- **Two jobs touching** share one bigger dot connecting them. Dragging it moves the end of the first job and the start of the second together. So they stay touching.
- **Click and hold** that shared dot to separate them: the later job jumps 15 minutes later without extending its end.
- **Drag one dot onto another** and they combine. The jobs are now touching.

:::example split back-to-back jobs
Two jobs meet at 2:30 PM under one dot. Hold the dot — the second job now starts at 2:45 PM, ending at its same time. Drag its start dot back onto 2:30 to rejoin them.
:::

## Reordering a person's day

Need job 3 to happen before job 2? On the **Day** view, you tap the **⇅** button at the right end of a person's row. It appears when they have two or more jobs. Their jobs list in order with {{button:outline|▲}} {{button:outline|▼}} buttons. You move one and the new times preview instantly:

:::example How the times move
Every job **keeps its own duration**, and the gaps between jobs stay where they were. If the day was 807 (8–10), 920 (10:30–12:30), 902 (1–4) and you move 902 up, it becomes 807 (8–10), 902 (10:30–1:30), 902's three hours intact, then 920 (2–4).
:::

Jobs tagged {{chip:gray|linked crew}} move for the whole crew. Everyone's copy of that job shifts by the same amount, so the crew stays together. You hit {{button:blue|Save new order}} and every schedule surface reflects the new order immediately. That is the techs' Job Mode, My Schedule, and emails. They all sort by time.

## Travel-time hints on the Day view

When two of a person's jobs have known locations, the Day view estimates the drive between them. Locations fill in automatically. Opening the Day view maps any scheduled address it does not know yet. A small *📍 Mapping…* note shows while it works. If an address cannot be found, you will see an amber note naming it. You fix the job's address and the hints appear. By default the hint is a straight-line minimum, shown as {{chip:gray|🚗 ≥18m}}. Real traffic can only be worse. With live routing on, it is a real road estimate, shown as {{chip:gray|🚗 ~22m}}. It quietly falls back to the straight-line number whenever routing is unavailable. Devs control all of this under {{button:outline|Dispatch Settings}} → **Travel time hints**. There they turn hints on or off, set the assumed average speed, and enable live routing.

- An open gap between jobs shows a 🚗 chip like {{chip:gray|🚗 ≥18m}}. It is red when the gap is shorter than the drive.
- Back-to-back jobs that are far apart turn their connecting dot **red**. You hover it for the estimate.
- Jobs without a mapped address show nothing. The Map page is where addresses get geocoded, turned into map points.

## Choosing the Day view's visible hours

On the Dispatch **Day** tab, the {{button:outline|Visible hours ⚙}} button sits right of the day controls. It opens a small settings modal. You pick a start and end, within 4 AM to 8 PM and at least an hour apart. The timeline stretches that window across the page. That is handy when your crew works 7-to-5 and the early and late hours just waste space. The choice saves on your device only. **Reset to full day** puts it back. Jobs outside the window pin to its edge.

## When someone isn't coming in

The fastest path: on an empty person-day, you click the small orange **off** button beside the blue **+** bar. It asks first. The cell has nothing scheduled, so the confirm says exactly what it does:

:::example Marking an empty day off
Mark **Paige** as not coming in?
Wednesday, Sep 2 — records unpaid time off for the day. Nothing is scheduled for them that day, so no blocks are removed. Undo any time from the cell's chip.

{{button:outline|Cancel}} &nbsp; {{button:red|Mark not coming in}}
:::

You confirm and the cell shows the time-off chip. You click the chip if you need to undo it.

For a day that already has jobs, you use the **Add job to schedule** modal footer instead. You press {{button:outline|Not coming in today}}. You will get a confirmation. You also get a warning if it will remove existing schedule blocks for that day:

:::example Confirming a day off
Mark **Mike T** as not coming in on **Wed 7/9**?
This will also remove their **2 existing schedule blocks** for the day.

{{button:outline|Cancel}} &nbsp; {{button:red|Confirm not coming in}}
:::

## Who came in late

Someone may clock in more than 15 minutes after their first scheduled block. Then their day cell shows an amber **◔ Late** chip with how late they were, like *◔ Late 2h 15m*. There is nothing to mark and nothing to undo. It is computed from their actual clock-in against the schedule. You hover it for the receipt: scheduled start, actual clock-in, exact minutes. No chip means on time, within the grace window. A person with **no** clock-in at all never shows Late. That is a call-out or no-show question, handled by the red chips above.

## No call, no show

When someone simply did not show and did not call, you use **No call, no show**. It is the quieter red link next to {{button:outline|Not coming in today}} in the same footer. It is for office and payroll-side roles only. This one has teeth. It clears the day's blocks and marks the day off. It also **files an attendance incident**, visible in write-ups and People → Review. It **rejects any clock time** recorded for the day. You can add a line about what happened. It is saved on the incident.

The cell then shows a solid red **NCNS** chip instead of the softer "Not coming in" one. Clicking the chip clears the schedule marking if plans change. But the attendance incident stays on record. Removing an incident is a separate payroll-side action.


Once confirmed, the cell shows a {{chip:red|Not coming in}} chip. You click the chip to undo it. The undo modal is honest about what it can do. It makes the person schedulable again. But **any blocks removed when the day was marked off don't come back**. You add them again from the cell.

## Sharing the day's schedule

You press {{button:blue|Share}} to open the **Schedule share** modal:

- **Send now**: you pick recipients. You choose what to include: ☑ **Current day**, ☐ **Next day**, ☐ **Rest of week**. You check the **What will send** panel, and press {{button:blue|Send now}}.
- **Recurring**: you set up automatic shares. You pick recipients, days of the week, and a Central-time send time. Then you press {{button:blue|Create recurring share}}. Existing shares can be paused with {{button:outline|Pause}} and resumed under "Active & paused shares".

**What will send** lists exactly what the email will contain. That is every block on the days you ticked, grouped by person the way the email is, bid visits included. It has a headline like *12 blocks · 5 people · 2 days*. If nothing is scheduled it says so, and so will the email. It is the board as you can see it right now. Every recipient gets that same email.

:::example What will send · 3 blocks · 2 people
**Marcus D**
7:00 AM–3:30 PM &nbsp; J512 · Smith House Repipe
**Paige**
9:00 AM–11:00 AM &nbsp; B412 · Oakmont Clubhouse
1:00 PM–4:00 PM &nbsp; J498 · Baker Kitchen Remodel
:::

You press {{chip:gray|Esc}} to close the modal. If a recipient dropdown is open, the first Esc closes that. The **Email schedule** modal on the Dashboard clock strip shows the same panel for the day and recipient you picked. It closes on Esc too.

## The standing office schedule

Office people used to get their "Office" block typed in by hand every morning. Now the schedule fills those in itself:

1. Open **Dispatch**, the gear on the schedule, then **Standing office schedule**.
2. Add each person who works office days. Assistants, controllers, and estimators are offered. Adjust their daily window if it is not 8:00 to 4:00.
3. That is it. Weekdays on the visible week get their Office block automatically, ahead of time.

The automation stays polite:

- **Days off win.** Someone marked "not coming in" is never refilled.
- **Field dispatch wins.** If a person already has an overlapping job or bid block that day, no Office block is added.
- **Your deletions stick.** You remove an auto-added block and it stays gone for that day.

:::example It's a normal block
Auto-added blocks are ordinary Office-job blocks — drag them, retime them, or delete them exactly like one you made yourself. Hours clocked against them land in overhead, same as always.
:::

## Daily rhythm

The Quickfill page embeds this schedule twice. **Schedule** asks *"Are there any obvious schedule conflicts?"*. **Tomorrow's Schedule** asks *"Who is on what job tomorrow?"*. So reviewing dispatch is part of the office's daily loop.

## Subs on the board

Subs, the subcontractors, are not on the crew grid. They are people on work orders, not users with blocks. So the People tab shows them in a **Subs** section under the crew. There is one row per sub, one chip per day. It is solid green when they picked those days on their portal. It is striped when a window is set but they have not picked yet. It is dashed while an offer is still out. You tap a chip to open the job. There is nothing to drag. To move a sub, you change the window on **Jobs → Subs → Work** or let them re-pick.

A sub may be definitely on a job. Then everyone assigned to that job sees a small {{chip:green|sub}} badge on those days. You hover for the names. The **Day** tab lists **Subs on site** above the crew. {{button:outline|Add a site visit ›}} arms place-a-job for that job. So you can drop a real block on a superintendent's lane. The Crew Day email ends with the same list.
