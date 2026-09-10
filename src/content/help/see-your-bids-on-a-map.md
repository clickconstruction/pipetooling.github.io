---
title: see your bids on a map
category: Office
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: map, bids, bid board, pins, distance, miles from the office, due, directions, where is the bid, site walk, hide map, play, tour, pause, sections one at a time
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

## Play: the sections one at a time

{{button:outline-blue|Play}} next to the title walks the map through its sections on its own: **one section alone on the map for two seconds**, then the next, around and around — Unsent, then Pending, then Won, Started and Lost. The chip for the section that is up fills with its color and a thin line runs across it so you can see the beat. Sections with no pins are skipped.

{{button:outline-blue|Pause}} holds whatever view is showing, so you can stop on Won and talk about it. Clicking any chip while it plays pauses it too, then works the chip as usual. Play only appears when at least two sections have pins.

:::example A five-minute look at the territory on the office screen
Press Play and let it run while the room talks. Grey is where the unsent work sits, yellow is what's out for decision, green is where you win. The map re-frames on each view, so a cluster you never noticed shows up on its own turn.
:::

## Opening a bid from a pin

Click a pin for its card: bid number and project, the GC or customer, the section, the due date, the estimator, the address and how far it is from the office, and the bid value when it is set. Then three buttons:

- {{button:outline-blue|Open bid}} opens the bid preview, the same one the bid number opens on the board.
- {{button:outline-blue|Edit}} opens Edit Bid.
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

Clicking a pin also lights the bid's row on the board below and scrolls to it, so the map and the list stay one thing.

On a phone, tapping a pin shows the bid as a bar under the map instead of a pop-up, so the buttons stay big and the pin stays in view.

## Cluster the piles

Around Austin and San Antonio the pins sit on top of each other. **Cluster** (beside **Fit all**) groups pins that overlap at the current zoom into one disc with a count on it:

- The disc takes the color of the section most of its bids are in, and wears a **red** or **amber** ring when any bid inside is overdue or due soon, so nothing urgent hides in a pile.
- **Click a disc** to zoom the map onto its bids. Zoom in on your own and the discs break back into pins as soon as they have room.
- It's **off unless you turn it on**, and the choice is remembered on that device — the link reads **Clustered ✓** while it's on. The section chips, the distance boxes and **Play** all keep working; the discs recompute from whatever pins are showing.

## The rail beside the map

On a desktop the map takes the left of the card and a rail on the right says what the map knows:

- **By distance from the office** — three boxes: **≤ 25 mi**, **25–50 mi**, **50 mi +**, each with how many bids are pinned there, their total bid value, and how many are due soon. Tap a box to hide or show that band's pins, the same way the section chips work; tap it again to bring them back. Miles are the bid's Distance to Office when it has one, else the straight line from the office — the same yardstick as the rings.
- **Unsent and due · nearest first** — the unsent bids with a due date: overdue first, then due soon, then closest to the office. Tap a row to jump to its pin and light its row on the board. "+ N more" means the list is capped at five.
- The last line reads the pinned total — *146 pinned · $34.8M · Lost 71 off* — and carries the **no map location** link described below.

On a phone the rail sits under the map: the three boxes in a row, then the due list.

## Add the addresses the map is missing

Under the map, **N bids have no map location yet · add their addresses** is a link. It opens a sheet with every bid the map can't place — the ones with **no address** first, then the ones whose address the map **couldn't find** — each with its address ready to type or fix.

1. Type the site address (street, city, state) and tap {{button:blue|Save}} or press Enter. The row reads *Placed ✓ · 38 mi from the office* as soon as the map finds it; if the map still can't, it says so and asks you to check the address.
2. Not sure of the spelling? {{button:outline-blue|Check on Google Maps ↗}} opens what's in the box, not what's saved.
3. When the customer has an address on file it's shown under the row with {{button:outline-blue|Use it}} — one tap fills the box (right for a residential bid at the customer's own address; nothing is saved until you tap Save).
4. Anything else on the bid: {{button:outline-blue|Edit bid}} opens the full form.

Saving an address on a bid whose **Distance to Office** is blank fills the distance too, the same routed-miles path the bid form uses. Fixed bids stay in the sheet until you close it, so you can watch the pins land.

## Fit all, Hide map and the Map pill

The map opens on the 50-mile ring — the office, the pins inside the ring, and the ring itself — so one bid in another state doesn't zoom it out to the whole country; the far pins are still drawn, just off the first view. **Fit all** (beside **Hide map**) frames every pin and the office, near and far. There's no instruction line under the map any more; hover the **Bids on a map** title if you want the reminder of what pins, rings and chips do. **Hide map** collapses the card to its title line; the choice is remembered on that device, and **Show map** brings it back. Tapping the **Bids on a map** title does the same thing in either direction. The **Map** pill in the sticky section row jumps to the card from anywhere on the board, and shows it if it was hidden.
