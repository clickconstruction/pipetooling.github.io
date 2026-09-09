---
title: see your bids on a map
category: Office
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: map, bids, bid board, pins, distance, miles from the office, due, directions, where is the bid, site walk, hide map
order: 67
---
The Bid Board has a **Bids on a map** card between the section pills and the sections. It plots the bids the board is showing — the same list, so the search box, the trade pill above the tabs and **My bids** all change the pins. Nobody sees a pin here they couldn't already open from the board.

## Reading the map

Each pin is one bid, colored by its board section: {{chip:gray|Unsent}} grey, {{chip:yellow|Pending}} yellow, {{chip:green|Won}} green, {{chip:green|Started}} dark green, {{chip:red|Lost}} red. The chips next to the title double as the key and as switches — tap one to hide or show that section's pins. **Lost starts hidden**; tap it when the question is where you win and lose.

The dark diamond is the office, with dashed rings at **25 and 50 miles** — the same office the bid form's Distance to Office is measured from.

An unsent bid that is due within the next few days wears an **amber ring**; once it is past due the ring turns **red**. Sent and decided bids never ring — the deadline is behind you.

:::example Planning a site-walk day
Two amber-ringed pins sit north of the 50 mile ring, an hour apart. Turn off Pending and Won, and what's left is the unsent work you could walk on the same trip.
:::

## Opening a bid from a pin

Click a pin for its card: bid number and project, the GC or customer, the section, the due date, the estimator, the address and how far it is from the office, and the bid value when it is set. Then three buttons:

- {{button:outline-blue|Open bid}} opens the bid preview, the same one the bid number opens on the board.
- {{button:outline-blue|Edit}} opens Edit Bid.
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

Clicking a pin also lights the bid's row on the board below and scrolls to it, so the map and the list stay one thing.

On a phone, tapping a pin shows the bid as a bar under the map instead of a pop-up, so the buttons stay big and the pin stays in view.

## Add the addresses the map is missing

Under the map, **N bids have no map location yet · add their addresses** is a link. It opens a sheet with every bid the map can't place — the ones with **no address** first, then the ones whose address the map **couldn't find** — each with its address ready to type or fix.

1. Type the site address (street, city, state) and tap {{button:blue|Save}} or press Enter. The row reads *Placed ✓ · 38 mi from the office* as soon as the map finds it; if the map still can't, it says so and asks you to check the address.
2. Not sure of the spelling? {{button:outline-blue|Check on Google Maps ↗}} opens what's in the box, not what's saved.
3. When the customer has an address on file it's shown under the row with {{button:outline-blue|Use it}} — one tap fills the box (right for a residential bid at the customer's own address; nothing is saved until you tap Save).
4. Anything else on the bid: {{button:outline-blue|Edit bid}} opens the full form.

Saving an address on a bid whose **Distance to Office** is blank fills the distance too, the same routed-miles path the bid form uses. Fixed bids stay in the sheet until you close it, so you can watch the pins land.

## Fit all, Hide map and the Map pill

The map opens on the bids within about 150 miles of the office, so one bid in another state doesn't zoom it out to the whole country; those far pins are still drawn. {{button:outline-blue|Fit all}} frames every pin and the office, near and far. **Hide map** collapses the card to its title line; the choice is remembered on that device, and **Show map** brings it back. Tapping the **Bids on a map** title does the same thing in either direction. The **Map** pill in the sticky section row jumps to the card from anywhere on the board, and shows it if it was hidden.

## A bid with no map location yet

A bid whose address hasn't been placed on the map yet is listed under the map as *1 bid has no map location yet*, with its name as a link that lights its row so you can add or fix the address in Edit Bid. Addresses are looked up in the background the first time anyone's board needs them.
