---
title: manage company vehicles and track their odometers
category: Office
roles: dev, master_technician, assistant, controller
keywords: vehicles, fleet, odometer, hand off, possession, assign truck, mileage, replacement value, VIN, insurance, insurance plan, policy, coverage, motor pool, parked, active, inactive, maintenance, tasks, battery, repair checklist
---

**People → Vehicles** is the fleet board: one card per vehicle showing who holds it, its latest odometer reading, whether that reading is getting old, and which insurance plan covers it. The board groups into **Active** (someone is using the vehicle) and **Inactive** (parked in the motor pool, or waiting for a holder). Above the board, one quiet line states the facts — how many vehicles, how many are parked in the motor pool, and the weekly insurance + registration cost, with **Insurance plans ›** right beside it. Under it, a **Needs attention** card lists what's asking for work: each row is a count and a plain label (need a reading, not on insurance, unassigned, oil due soon / overdue, open problems, maintenance tasks), red before amber, and the card disappears when the fleet is caught up.

Two of those rows open a list (they carry a › chevron). Tap **8 need a reading** for the **odometer catch-up**: every affected vehicle with its VIN tail and holder, a miles box on each row — Enter saves with today's date and jumps to the next box, and rows turn green as you sweep the list. Tap **1 maintenance task** for the **open-task list**: vehicle, task, assignee, and {{button:green|✓ Done}} (or an Assign button when nobody owns it yet) right on the row.

## Handing a vehicle to someone

Every card has a {{button:outline|Hand off}} button (or {{button:outline|Assign}} when nobody holds it). One dialog does the whole move:

:::example Hand off vehicle
2019 Ford F250 · currently Abraham

New holder: **Roxi** · Hand-off date: **today** · Odometer at hand-off: **84,300**

{{button:blue|Hand off}}
:::

Confirming ends the current holder's possession on that date, starts the new one, and saves the odometer reading — no separate steps, and the vehicle can never end up with two holders.

## Parking a vehicle in the motor pool

When a vehicle isn't being driven, hand it to the **Motor pool** — the first option in the same New holder dropdown. The card flips to a calm gray **Motor pool** state with the date it was parked, and the vehicle moves to the **Inactive** group. This is different from {{chip:yellow|Unassigned}}: amber means "nobody has told the system who has this"; Motor pool means "we parked it on purpose."

Taking it back out is just another hand-off — open {{button:outline|Hand off}} on the parked card and pick the person. The ledger records every move ("Trace → Motor pool", "Motor pool → Abraham"), so you can always see when a truck sat idle and who took it out.

:::example Spotting money parked in the lot
A parked vehicle that's still on an insurance plan shows **still insured while parked** on its card — if it's going to sit for the season, consider taking it off the plan (see *Insurance plans* below) and adding it back when it returns to work.
:::

## The vehicle ledger

Click any card to open the vehicle. The **Current odometer** box sits right on top — the miles field is already focused, so recording a reading is type-and-Enter. Below it, the **Ledger** lists everything that ever happened to the vehicle, newest first: odometer readings (with who entered them), hand-offs ({{chip:blue|Hand-off}} rows read "Malachi → Tristen"), and replacement-value updates. The pills filter to one kind when the history gets long.

:::example A quick weekly pass
Open each card wearing a {{chip:yellow|needs a reading}} chip, ask the holder for their dash number, type it, Enter — the chip clears and the fleet stays current.
:::

You often won't need to ask: everyone holding a vehicle has a **My Vehicle** card on their own Dashboard where they send readings and report problems themselves — see the guide *report a problem with my truck or send an odometer reading*.

## Oil changes and services

{{button:outline|Log service}} on an open vehicle records a shop visit — oil change, tires, repair, inspection, or registration — with the date, the odometer at the visit, what it cost, and a note about where. A service logged with miles **also saves an odometer reading**, so the mileage history stays current for free.

Oil changes drive the oil chips you see on every card:

- {{chip:green|Oil OK · next 120,000}} — more than 1,000 miles of runway left
- {{chip:yellow|Oil due in 800 mi}} — inside the last 1,000 miles
- {{chip:red|Oil overdue 1,480 mi}} — past due, get it in

The math is simple: last oil change's odometer plus the vehicle's interval (5,000 miles unless you change it in {{button:outline|Edit}}), compared against the latest reading. No chip shows until the vehicle has both an oil change with miles and a reading — so log the current state once and it tracks from there. The chips above the board count how many vehicles are due soon or overdue across the whole fleet.

## Maintenance tasks

Every open vehicle has a **Maintenance** list — the to-dos that keep it on the road: change a battery, fix a door handle, wiper blades before winter. Type into **Add a task** and press Enter; each open task shows who added it and wears either an assignee chip or {{chip:yellow|Unassigned}}.

{{button:outline|Edit}} on a task changes its title or adds a note — the note shows under the task here and on the assignee's 🚗 vehicle card, and a retitle updates their checklist copy too. Tap an **assigned** task's title to expand the same activity thread the checklist screens have: full history, a note composer, and {{button:green|✓ Complete}}.

{{button:outline|Assign}} picks the person and a due date — and this is where it connects to the rest of the app: assigning creates a **one-time checklist task on their list** ("2019 Ford F250 — Change battery") that shows on their Dashboard My Inbox and Checklist → Today and **stays until completed**. Check "Notify me when it's done" to get pinged on completion.

On their side, the task wears a {{chip:blue|🚗 vehicle}} chip — tapping it opens the vehicle's vitals right there: who holds it, latest odometer, oil status, insurance, open problem reports, and recent service. It works for whoever's assigned, even field crew who can't open the Vehicles page.

Completion syncs both ways: when they check it off their checklist, the vehicle's task marks done by itself; when you check it off here, it clears from their list too — and a prefilled **Log service** form opens so the work can land in the service log with cost and odometer ({{button:outline|Cancel}} to skip; not every task needs a service entry). Done tasks live in the ledger as {{chip:green|Task}} rows.

:::example From problem to fixed
A driver reports "battery struggling on cold mornings" → the office taps {{button:outline|Create task}} on the problem → {{button:outline|Assign}} to Abraham, due Friday → Abraham sees it in his My Inbox, swaps the battery, checks it off → the office gets notified, logs it as a service, and resolves the problem report.
:::

## Reported problems

{{button:outline|Report problem}} records something wrong with the vehicle — a description and a severity:

- {{chip:gray|Monitor}} — keeping an eye on it
- {{chip:yellow|Needs service}} — book a shop visit
- {{chip:red|Urgent}} — deal with it now

Open problems show as a red chip on the vehicle's card and in an **Open problems** list on the vehicle itself, each with a {{button:outline|Resolve}} button — add a note about how it was fixed and both the report and the resolution stay in the ledger. The chips above the board total the open problems across the fleet, so nothing reported gets forgotten.

## Insurance plans

The company may carry several insurance policies, and vehicles come on and off them as they're driven or parked. {{button:outline|Insurance plans}} above the board manages the plans themselves — name, carrier, policy number, and renewal date — and shows each plan's vehicles with the date they came on.

Each vehicle sits on **at most one plan at a time**, shown on the bottom line of its card: the plan name with the on date, or an amber **Not on insurance** with the date it came off. From there:

- {{button:outline|Add to plan}} — pick the plan and the start date the coverage begins.
- {{button:outline|Change}} — move to a different plan; the old coverage ends on the new start date, nothing overlaps.
- **Take off** — from the plans manager or the change dialog; set the end date and the vehicle goes off coverage.

:::example Parking a truck for the winter
The F650 isn't being driven, so open {{button:outline|Change}} → **Take off insurance…**, set the end date, and the card flips to {{chip:yellow|Not on insurance}}. When it goes back to work in spring, {{button:outline|Add to plan}} starts a fresh coverage period — the ledger keeps both.
:::

Every on/off lands in the vehicle's ledger as an {{chip:gray|Insurance}} row ("Added to Progressive Commercial", "Taken off …"), so you can always answer "was this truck covered in March?"

## Vehicle details

{{button:outline|Edit}} on an open vehicle changes year, make, model, trim, VIN, and the weekly insurance and registration costs (those print on pay stubs and feed the fleet total). {{button:outline|Update value}} records what replacing the vehicle would cost today — the history stays in the ledger. Deleting a vehicle removes its whole history with it, so park old vehicles as **Unassigned** instead unless you really mean delete.
