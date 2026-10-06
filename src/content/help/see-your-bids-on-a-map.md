---
title: see your bids on a map
category: Office
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: map, bids, bid board, pins, distance, miles from the office, due, directions, where is the bid, site walk, hide map, zoom, scroll wheel, mouse wheel, zooms out, play, tour, pause, sections one at a time
order: 67
---
The Bid Board has a **Bids on a map** card between the section pills and the sections. The card plots the bids the board is showing.

The map shows the same list as the board. So the search box, the trade pill above the tabs and **My bids** all change the pins. Nobody sees a pin here they couldn't already open from the board.

## Reading the map

Each pin is one bid, colored by its board section. {{chip:gray|Unsent}} is grey and {{chip:yellow|Pending}} is yellow. {{chip:green|Won}} is green and {{chip:green|Started}} is dark green. {{chip:red|Lost}} is red. The chips next to the title double as the key and as switches. You tap one to hide or show that section's pins. **Lost starts hidden**. You tap it when the question is where you win and lose.

The dark diamond is the office, with dashed rings at **25 and 50 miles**. The bid form's Distance to Office is measured from the same office.

An unsent bid that is due within the next few days wears an **amber ring**. Once it is past due, the ring turns **red**. Sent and decided bids never ring, since the deadline is behind you.

:::example Planning a site-walk day
Two amber-ringed pins sit north of the 50 mile ring, an hour apart. Turn off Pending and Won, and what's left is the unsent work you could walk on the same trip.
:::

## Play: the sections one at a time

{{button:outline-blue|Play}} next to the title walks the map through its sections on its own. Play shows **one section alone on the map for two seconds**, then the next, around and around. The order is Unsent, then Pending, then Won, Started and Lost. The chip for the section that is up fills with its color. A thin line runs across it so you can see the beat. Sections with no pins are skipped.

{{button:outline-blue|Pause}} holds whatever view is showing, so you can stop on Won and talk about it. Clicking any chip while Play runs pauses Play too. The same click also works the chip as usual. Play only appears when at least two sections have pins.

:::example A five-minute look at the territory on the office screen
Press Play and let it run while the room talks. Grey is where the unsent work sits, yellow is what's out for decision, green is where you win. The map re-frames on each view, so a cluster you never noticed shows up on its own turn.
:::

## Opening a bid from a pin

You click a pin for its card. The card shows the bid number and project, the GC or customer, and the section. The card also shows the due date, the estimator, the address and how far it is from the office. The bid value shows when it is set. Then come three buttons:

- {{button:outline-blue|Open bid}} opens the bid preview, the same one the bid number opens on the board.
- {{button:outline-blue|Edit}} opens Edit Bid.
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

Clicking a pin also lights the bid's row on the board below and scrolls to it. So the map and the list stay one thing.

On a phone, tapping a pin shows the bid as a bar under the map instead of a pop-up. So the buttons stay big and the pin stays in view.

## Cluster the piles

Around Austin and San Antonio the pins sit on top of each other. **Cluster** sits beside **Fit all**. Cluster groups pins that overlap at the current zoom into one disc with a count on it:

- The disc takes the color of the section most of its bids are in. The disc wears a **red** or **amber** ring when any bid inside is overdue or due soon. So nothing urgent hides in a pile.
- **Click a disc** to zoom the map onto its bids. If you zoom in on your own, the discs break back into pins as soon as they have room.
- Clustering is **off unless you turn it on**. The choice is remembered on that device. The link reads **Clustered ✓** while it's on. The section chips, the distance boxes and **Play** all keep working. The discs recompute from whatever pins are showing.

## The rail beside the map

On a desktop the map takes the left of the card, and a rail takes the right. The rail says what the map knows:

- **By distance from the office** has three boxes: **≤ 25 mi**, **25–50 mi** and **50 mi +**. Each box says how many bids are pinned there, their total bid value, and how many are due soon. You tap a box to hide or show that band's pins, the same way the section chips work. You tap it again to bring them back. Miles are the bid's Distance to Office when it has one. Otherwise the miles are the straight line from the office. The rings use the same yardstick.
- ***Unsent and due · nearest first*** lists the unsent bids with a due date. Overdue comes first, then due soon, then closest to the office. You tap a row to jump to its pin and light its row on the board. "+ N more" means the list is capped at five.
- The last line reads the pinned total, like *146 pinned · $34.8M · Lost 71 off*. The line carries the **no map location** link described below.

On a phone the rail sits under the map: the three boxes in a row, then the due list.

## Add the addresses the map is missing

Under the map, ***N bids have no map location yet · add their addresses*** is a link. The link opens a sheet with every bid the map can't place. The ones with **no address** come first. Then come the ones whose address the map **couldn't find**. Each bid has its address ready to type or fix. Every row starts with the bid's stage in the section's colour: **Unsent**, **Pending**, **Won**, **Started** or **Lost**. So you can skip the lost ones and type the addresses that still matter.

1. Type the site address: street, city and state. Then tap {{button:blue|Save}} or press Enter. The row reads *Placed ✓ · 38 mi from the office* as soon as the map finds it. If the map still can't find it, it says so and asks you to check the address.
2. Not sure of the spelling? {{button:outline-blue|Check on Google Maps ↗}} opens what's in the box, not what's saved.
3. When the customer has an address on file, it's shown under the row with {{button:outline-blue|Use it}}. One tap fills the box. You tap Use it for a residential bid at the customer's own address. Nothing is saved until you tap Save.
4. Anything else on the bid: {{button:outline-blue|Edit bid}} opens the full form.

Saving an address on a bid whose **Distance to Office** is blank fills the distance too. The distance is measured in road miles, the same way the bid form does it. Fixed bids stay in the sheet until you close it, so you can watch the pins land.

## From a row to its pin

The link between map and list works the other way too. On a desktop, you rest the mouse on any bid row. That bid's pin on the map wears a pulsing halo in its section colour. So you can find where a bid is without clicking anything. If the pin is folded into a cluster disc, the disc pulses instead. A bid whose section chip is off shows nothing. A bid with no address yet shows nothing either. You turn the chip on or add the address. Phones have no hover, so there the link runs one way. You tap a pin to light its row.

## Fit all, Hide map and the Map pill

The map opens on the 50-mile ring. The first view frames the office, the pins inside the ring, and the ring itself. So one bid in another state doesn't zoom it out to the whole country. The far pins are still drawn, just off the first view. **Fit all** sits beside **Hide map**. Fit all frames every pin and the office, near and far. There's no instruction line under the map any more. For a reminder of what pins, rings and chips do, you hover over the **Bids on a map** title. **Hide map** collapses the card to its title line. The choice is remembered on that device. **Show map** brings it back. Tapping the **Bids on a map** title does the same thing in either direction. The **Map** pill in the sticky section row jumps to the card from anywhere on the board. The pill also shows the card if it was hidden.

On a desktop, the mouse wheel scrolls the page when the pointer crosses the map. So you can scroll past it without the map zooming out. **Click the map once** and the wheel zooms it from then on. The **+** and **−** buttons, dragging and the pins work from the start.
