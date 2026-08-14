---
title: manage company vehicles and track their odometers
category: Office
roles: dev, master_technician, assistant, controller
keywords: vehicles, fleet, odometer, hand off, possession, assign truck, mileage, replacement value, VIN
---

**People → Vehicles** is the fleet board: one card per vehicle showing who holds it, its latest odometer reading, and whether that reading is getting old. The chips above the board total it up — how many vehicles, how many are {{chip:yellow|unassigned}}, how many {{chip:yellow|need a reading}}, and the fleet's weekly insurance + registration cost.

## Handing a vehicle to someone

Every card has a {{button:outline|Hand off}} button (or {{button:outline|Assign}} when nobody holds it). One dialog does the whole move:

:::example Hand off vehicle
2019 Ford F250 · currently Abraham

New holder: **Roxi** · Hand-off date: **today** · Odometer at hand-off: **84,300**

{{button:blue|Hand off}}
:::

Confirming ends the current holder's possession on that date, starts the new one, and saves the odometer reading — no separate steps, and the vehicle can never end up with two holders.

## The vehicle ledger

Click any card to open the vehicle. The **Current odometer** box sits right on top — the miles field is already focused, so recording a reading is type-and-Enter. Below it, the **Ledger** lists everything that ever happened to the vehicle, newest first: odometer readings (with who entered them), hand-offs ({{chip:blue|Hand-off}} rows read "Malachi → Tristen"), and replacement-value updates. The pills filter to one kind when the history gets long.

:::example A quick weekly pass
Open each card wearing a {{chip:yellow|needs a reading}} chip, ask the holder for their dash number, type it, Enter — the chip clears and the fleet stays current.
:::

## Oil changes and services

{{button:outline|Log service}} on an open vehicle records a shop visit — oil change, tires, repair, inspection, or registration — with the date, the odometer at the visit, what it cost, and a note about where. A service logged with miles **also saves an odometer reading**, so the mileage history stays current for free.

Oil changes drive the oil chips you see on every card:

- {{chip:green|Oil OK · next 120,000}} — more than 1,000 miles of runway left
- {{chip:yellow|Oil due in 800 mi}} — inside the last 1,000 miles
- {{chip:red|Oil overdue 1,480 mi}} — past due, get it in

The math is simple: last oil change's odometer plus the vehicle's interval (5,000 miles unless you change it in {{button:outline|Edit}}), compared against the latest reading. No chip shows until the vehicle has both an oil change with miles and a reading — so log the current state once and it tracks from there. The chips above the board count how many vehicles are due soon or overdue across the whole fleet.

## Vehicle details

{{button:outline|Edit}} on an open vehicle changes year, make, model, VIN, and the weekly insurance and registration costs (those print on pay stubs and feed the fleet total). {{button:outline|Update value}} records what replacing the vehicle would cost today — the history stays in the ledger. Deleting a vehicle removes its whole history with it, so park old vehicles as **Unassigned** instead unless you really mean delete.
