---
title: see every job and bid on one map
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: map, jobs, bids, estimates, pins, office, miles, rings, fit all, draw an area, filter, far from the office, wrong address, geocode, no address, could not be found, where is the job, directions, zoom, scroll wheel, mouse wheel, zooms out, cluster, status colors, working, waiting, billed, collections, paid, lost, rail, nearest, distance, places, one pin per address, precincts, justice court
---
The Map page plots every job, bid and estimate that has an address. It is the whole company on one map. The Bid Board and the Pipeline each have a map of their own list. This page has everything at once.

## The first view

The map opens on the office. The dark diamond is the office. The dashed rings are 25 and 50 miles out. The first view frames the office, the 50 mile ring and the pins inside it. Press {{button:outline|Fit all}} to frame every pin and the office.

## Reading the pins

Each pin is one address. An address with several jobs, bids or estimates wears their count. The pin's color says where the liveliest record there stands. It is the same color that record's row dot has elsewhere in the app.

- A job takes its Pipeline section. {{chip:yellow|Waiting}} is amber and {{chip:blue|Working}} is blue. **Ready to bill** is teal, **Billed** is orange and {{chip:green|Paid}} is green. A job in Collections keeps Billed's color and wears a **red ring**.
- A bid takes its Bid Board section. {{chip:gray|Unsent}} is grey and {{chip:yellow|Pending}} is yellow. {{chip:green|Won}} is green, **Started** is dark green and {{chip:red|Lost}} is red. An unsent bid that is due soon wears an **amber ring**. Once it is past due the ring turns **red**.
- An estimate is {{chip:purple|violet}}.

The chips over the map are the key and the switches. Each one carries its count of placed records. Tap a chip to hide or show its pins. **Paid, Lost and Estimates start off**, so the live work is what you see first. A chip that is off still says how many pins it hides.

:::example Where is the work this month
Leave the chips as they open. What is left is every live job and every live bid, on one map.
:::

## Cluster the piles

Around San Antonio the pins sit on top of each other. {{button:outline|Cluster}} sits beside {{button:outline|Fit all}}. Cluster groups pins that overlap at the current zoom into one disc with a count on it.

- The disc takes the color most of its pins have. The disc wears a **red** or **amber** ring when any pin inside is in Collections, overdue or due soon. So nothing urgent hides in a pile.
- **Click a disc** to zoom the map onto its pins. If you zoom in on your own, the discs break back into pins as soon as they have room.
- Clustering is **off unless you turn it on**. The choice is remembered on that device. The button reads **Clustered ✓** while it is on.

## Opening a record from a pin

Click a pin for its card. A single record shows its number, its kind and stage, and the address. An address with several records lists each one with its stage and an **Open** button. Then come the buttons.

- {{button:outline|Open}} opens the record. A job opens in its window. A bid or an estimate opens on its page.
- {{button:outline|Directions}} opens the address in Google Maps, ready to navigate.

The same card sits at the top of the rail beside the map. On a phone the rail is under the map, so the card is the bar there.

On a desktop, the mouse wheel scrolls the page when the pointer crosses the map. So you can scroll past it without the map zooming out. **Click the map once** and the wheel zooms it from then on. The **+** and **−** buttons, dragging and the pins work from the start.

## Cluster the piles

Around San Antonio the pins sit on top of each other. {{button:outline|Cluster}} sits beside {{button:outline|Fit all}}. Cluster groups pins that overlap at the current zoom into one disc with a count on it.

- The disc takes the color most of its pins have. The disc wears a **red** or **amber** ring when any pin inside is in Collections, overdue or due soon. So nothing urgent hides in a pile.
- **Click a disc** to zoom the map onto its pins. If you zoom in on your own, the discs break back into pins as soon as they have room.
- Clustering is **off unless you turn it on**. The choice is remembered on that device. The button reads **Clustered ✓** while it is on.

## Opening a record from a pin

Click a pin for its card. The card shows the record and its number, its kind and stage, and the address. Then come two buttons.

- {{button:outline|Open}} opens the record. A job opens in its window. A bid or an estimate opens on its page.
- {{button:outline|Directions}} opens the address in Google Maps, ready to navigate.

On a phone, tapping a pin shows the record as a bar under the map instead of a pop-up. So the buttons stay big and the pin stays in view.

On a desktop, the mouse wheel scrolls the page when the pointer crosses the map. So you can scroll past it without the map zooming out. **Click the map once** and the wheel zooms it from then on. The **+** and **−** buttons, dragging and the pins work from the start.

:::example Where is the work this month
Turn off Estimates and the Lost stage. What is left is every job and every live bid, on one map.
:::

## The rail beside the map

On a desktop the map takes the left and a rail takes the right. The rail says what the map knows.

- The **Filter** box at the top narrows the map and the rail by name, address or number. Press **Clear** to see everything again.
- **By distance from the office** has three boxes. The boxes read **≤ 25 mi**, **25–50 mi** and **50 mi +**. Each box says how many places and records are pinned there. Tap a box to hide or show that band's pins. Tap it again to bring them back.
- **Nearest the office** lists the places on the map, closest first. Rest the mouse on a row and its pin wears a pulsing halo. Click a row to select the place and fly the map to it.
- The last line counts what is on the map, like *244 places · 373 records*.

On a phone the rail sits under the map.

## Draw an area

Pick the polygon tool at the top left of the map. Click along the edge of an area. Click the first point again to close the shape. The map and the rail then show only the pins inside the shape. Press {{button:outline|Clear draw}} to remove the shape.

## Records the map cannot place

A line under the map counts the records with no map location. It also counts the addresses far from the office. Click it to open the sheet. The sheet has three parts.

- **No address** lists each record with no address, or with a stub like a dot. Click the record to open it and type the site address.
- **Could not be found** lists each address the geocoder has no match for, with its reason. Press **Check on Google Maps** to see the spelling. Then fix it on the record.
- **Far from the office** lists each address more than 300 miles out, with its count and miles. It is a far job or a wrong address. The map draws these pins but never frames them. Press **Show on the map** to fly there. The office can press **Re-check with Google** to ask Google again.

While the geocoder is still working, the line reads **Placing 4 addresses…** instead.

## Precincts

The office keeps a map of the justice precincts, the courts a small claim is filed in. Tap {{chip:blue|Precincts}} at the end of the chips to draw them. Each precinct shows as a tinted shape with its county and number on hover. With the layer on, a place's card names its justice court, such as **Bexar JP Pct 2**. An address within about a hundred metres of a line names both precincts. The office draws and fixes the precincts in the Court areas mode. See [draw the justice precincts on the map](/help/draw-the-justice-precincts-on-the-map).
