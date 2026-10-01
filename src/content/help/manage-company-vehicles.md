---
title: manage company vehicles and track their odometers
category: Office
roles: dev, master_technician, assistant, controller
keywords: vehicles, fleet, odometer, hand off, possession, assign truck, mileage, replacement value, VIN, insurance, insurance plan, policy, coverage, motor pool, parked, active, inactive, maintenance, tasks, battery, repair checklist, check-in, check-ins, dash lights, questions, cadence
---

People → Vehicles is the fleet board, one card per vehicle. Each card shows who holds it, its latest odometer reading and its insurance plan.

The odometer is the mileage counter on the dash. The card also says whether that reading is getting old. The board groups into **Active** and **Inactive**. Active means someone is using the vehicle. Inactive means it is parked in the motor pool, or waiting for a holder. Above the board, one quiet line states the facts. It counts the vehicles and the ones parked in the motor pool. It also gives the weekly insurance + registration cost. **Insurance plans ›** sits right beside it. Under it, a **Needs attention** card lists what is asking for work. Each row is a count and a plain label. The labels are need a reading, not on insurance, unassigned, oil due soon or overdue, open problems, and maintenance tasks. Red rows come before amber. The card disappears when the fleet is caught up.

Two of those rows open a list. They carry a › chevron. Tap **8 need a reading** for the **odometer catch-up**. It lists every affected vehicle with its VIN tail and holder. The VIN is the vehicle's serial number. Each row has a miles box. Enter saves with today's date and jumps to the next box. Rows turn green as you sweep the list. Tap **1 maintenance task** for the **open-task list**. Each row shows the vehicle, task, assignee, and {{button:green|✓ Done}} right on the row. An Assign button shows instead when nobody owns it yet.

## Seeing a vehicle's miles over time

Tap the reading line on any card to open **Odometer history**. The line reads like ***229,950 mi · 9d ago***. The tiles at the top give the pace. **Per month** and **per year** are averaged over the whole history, first reading to last. The **last 90 days** tile gives that pace with a faster or slower hint. The last tile is the total **since the first reading**. Below sits every reading, newest first. Each shows what it added since the one before, like "+1,230 mi in 12 days", and who logged it. A reading that went backwards is flagged amber so it can be fixed. With a single reading the tiles say "need one more reading". Add the next one right there with the **Add reading** box. It is dated today, and Enter saves. You can also add it from the card's **Current odometer** box or the catch-up list. Then the averages appear.

## Handing a vehicle to someone

Every card has a {{button:outline|Hand off}} button. It reads {{button:outline|Assign}} when nobody holds it. One dialog does the whole move:

:::example Hand off vehicle
2019 Ford F250 · currently Abraham

New holder: **Roxi** · Hand-off date: **today** · Odometer at hand-off: **84,300**

{{button:blue|Hand off}}
:::

Confirming ends the current holder's possession on that date. It starts the new one and saves the odometer reading. There are no separate steps. The vehicle can never end up with two holders.

## Parking a vehicle in the motor pool

When a vehicle is not being driven, hand it to the **Motor pool**. That is the first option in the same New holder dropdown. The card flips to a calm gray **Motor pool** state with the date it was parked. The vehicle moves to the **Inactive** group. This is different from {{chip:yellow|Unassigned}}. Amber means "nobody has told the system who has this". Motor pool means "we parked it on purpose".

Taking it back out is just another hand-off. Open {{button:outline|Hand off}} on the parked card and pick the person. The ledger, the vehicle's history list, records every move. It reads like "Trace → Motor pool" or "Motor pool → Abraham". So you can always see when a truck sat idle and who took it out.

:::example Spotting money parked in the lot
A parked vehicle that's still on an insurance plan shows **still insured while parked** on its card — if it's going to sit for the season, consider taking it off the plan (see *Insurance plans* below) and adding it back when it returns to work.
:::

## The vehicle ledger

Click any card to open the vehicle. The **Current odometer** box sits right on top. The miles field is already focused, so recording a reading is type-and-Enter. Below it, the **Ledger** lists everything that ever happened to the vehicle, newest first. It holds odometer readings, with who entered them. It holds hand-offs, where {{chip:blue|Hand-off}} rows read "Malachi → Tristen". It holds replacement-value updates. The pills filter to one kind when the history gets long.

:::example A quick weekly pass
Open each card wearing a {{chip:yellow|needs a reading}} chip, ask the holder for their dash number, type it, Enter — the chip clears and the fleet stays current.
:::

You often will not need to ask. Everyone holding a vehicle has a **My Vehicle** card on their own Dashboard. There they send readings and report problems themselves. See the guide *report a problem with my truck or send an odometer reading*.

The office side of this is the **Vehicle check-ins** station on Quickfill. Assigned trucks come due for a reading weekly and motor-pool trucks monthly. Your check-in questions, like "Any lights on the dash?", are asked at every capture. A dev sets the cadence, how often they come due, and the questions. That happens from the **⚙ Check-ins ›** link beside **Insurance plans ›** above the board. Each saved check-in, flagged or all clear, shows on the vehicle's ledger under the **Check-ins** filter. Every checked box files a Monitor problem report automatically. See the *use Quickfill* guide.

## Oil changes and services

{{button:outline|Log service}} on an open vehicle records a shop visit. That is an oil change, tires, repair, inspection, or registration. It records the date, the odometer at the visit, what it cost, and a note about where. A service logged with miles **also saves an odometer reading**. So the mileage history stays current for free.

Oil changes drive the oil chips you see on every card:

- {{chip:green|Oil OK · next 120,000}} means more than 1,000 miles of runway left
- {{chip:yellow|Oil due in 800 mi}} means inside the last 1,000 miles
- {{chip:red|Oil overdue 1,480 mi}} means past due, get it in

The math is simple. Take the last oil change's odometer plus the vehicle's interval. The interval is 5,000 miles unless you change it in {{button:outline|Edit}}. Compare that against the latest reading. No chip shows until the vehicle has both an oil change with miles and a reading. So log the current state once and it tracks from there. The chips above the board count how many vehicles are due soon or overdue across the whole fleet.

## Maintenance tasks

Every open vehicle has a **Maintenance** list. Those are the to-dos that keep it on the road. Think change a battery, fix a door handle, wiper blades before winter. Type into **Add a task** and press Enter. Each open task shows who added it. It wears either an assignee chip or {{chip:yellow|Unassigned}}.

{{button:outline|Edit}} on a task changes its title or adds a note. The note shows under the task here and on the assignee's 🚗 vehicle card. A retitle updates their checklist copy too. Tap an **assigned** task's title to expand the same activity thread the checklist screens have. That is the full history, a note composer, and {{button:green|✓ Complete}}.

{{button:outline|Assign}} picks the person and a due date. This is where it connects to the rest of the app. Assigning creates a **one-time checklist task on their list**, like *2019 Ford F250 — Change battery*. It shows on their Dashboard My Inbox and Checklist → Today. It **stays until completed**. Check "Notify me when it's done" to get pinged on completion.

On their side, the task wears a {{chip:blue|🚗 vehicle}} chip. Tapping it opens the vehicle's vitals right there. That is who holds it, latest odometer, oil status, insurance, open problem reports, and recent service. It works for whoever is assigned, even field crew who cannot open the Vehicles page.

Completion syncs both ways. When they check it off their checklist, the vehicle's task marks done by itself. When you check it off here, it clears from their list too. Then a prefilled **Log service** form opens. So the work can land in the service log with cost and odometer. Press {{button:outline|Cancel}} to skip. Not every task needs a service entry. Done tasks live in the ledger as {{chip:green|Task}} rows.

:::example From problem to fixed
A driver reports "battery struggling on cold mornings" → the office taps {{button:outline|Create task}} on the problem → {{button:outline|Assign}} to Abraham, due Friday → Abraham sees it in his My Inbox, swaps the battery, checks it off → the office gets notified, logs it as a service, and resolves the problem report.
:::

## Reported problems

{{button:outline|Report problem}} records something wrong with the vehicle. You give a description and a severity:

- {{chip:gray|Monitor}} means keeping an eye on it
- {{chip:yellow|Needs service}} means book a shop visit
- {{chip:red|Urgent}} means deal with it now

Open problems show as a red chip on the vehicle's card. They also show in an **Open problems** list on the vehicle itself. Each has a {{button:outline|Resolve}} button. Add a note about how it was fixed. Both the report and the resolution stay in the ledger. The chips above the board total the open problems across the fleet. So nothing reported gets forgotten.

## Insurance plans

### The Insurance card on a vehicle

Open a vehicle and the **Insurance** card sits right under the odometer card. It has the same shape. The status is on the left and the number on the right.

:::example What a covered truck shows
**Insurance** — {{chip:green|Abraham Insurance · since Aug 1}} Change plan · Take off
$59.35/wk · ≈ $257/mo · $3,086/yr
[ New amount ] [ / mo ▾ ] {{button:blue|Save cost}}
:::

- Type the cost the way the carrier, the insurance company, quotes it. Pick **/ wk**, **/ mo**, or **/ yr** next to the box. The app stores it weekly. That is what pay stubs and the fleet total read. It shows all three so nobody does the math. While you type you will see "saved as $59.31 / wk".
- **Change plan**, **Take off** and **Add to plan** sit right beside the status they act on. The old "Insurance" button in the action row is gone.
- A vehicle that is **not on a plan** reads {{chip:yellow|Not on insurance}}. Its number line reads ***$0.00/wk while off a plan · last cost $60.42/wk***. The number is kept, so putting it back on a plan does not lose it. The fleet total above the board counts insurance only for vehicles currently on a plan.


The company may carry several insurance policies. Vehicles come on and off them as they are driven or parked. {{button:outline|Insurance plans}} above the board manages the plans themselves. That is the name, carrier, policy number, and renewal date. It shows each plan's vehicles with the date they came on. Each vehicle row also shows its weekly cost, or an amber **no cost set**. A **Plan total** line sums the priced vehicles per week, month and year. Hold it up against what the carrier actually bills. Click a vehicle in the list to jump to its page and set the cost.

Each vehicle sits on **at most one plan at a time**. The bottom line of its card shows the plan name with the on date. Or it shows an amber **Not on insurance** with the date it came off. From there:

- {{button:outline|Add to plan}} is where you pick the plan and the start date the coverage begins.
- {{button:outline|Change}} moves to a different plan. The old coverage ends on the new start date, and nothing overlaps.
- **Take off** works from the plans manager or the change dialog. Set the end date and the vehicle goes off coverage.

:::example Parking a truck for the winter
The F650 isn't being driven, so open {{button:outline|Change}} → **Take off insurance…**, set the end date, and the card flips to {{chip:yellow|Not on insurance}}. When it goes back to work in spring, {{button:outline|Add to plan}} starts a fresh coverage period — the ledger keeps both.
:::

Every on and off lands in the vehicle's ledger as an {{chip:gray|Insurance}} row. It reads like "Added to Progressive Commercial" or "Taken off …". So you can always answer "was this truck covered in March?"

## Vehicle details

{{button:outline|Edit}} on an open vehicle changes year, make, model, trim, VIN, and the weekly registration cost. The registration cost prints on pay stubs and feeds the fleet total. The **insurance** cost lives on the vehicle's **Insurance** card instead. See below. {{button:outline|Update value}} records what replacing the vehicle would cost today. The history stays in the ledger. Deleting a vehicle removes its whole history with it. So park old vehicles as **Unassigned** instead unless you really mean delete.
