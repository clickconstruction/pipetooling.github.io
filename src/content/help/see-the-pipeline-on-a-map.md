---
title: see the pipeline on a map
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller, superintendent
keywords: map, pipeline, jobs, pins, where is the job, distance, miles from the office, collections, directions, hide map, cluster, paid jobs, fit all, to collect, ask for money, oldest bill, rail, hover
order: 32
---
**Jobs → Pipeline** has a **Jobs on a map** card under the toolbar. It plots the jobs the board is showing — the same list, so the search box and the GC, development, Account Man and contract filters all change the pins. Nobody sees a pin here they couldn't already open from the board.

## Reading the map

Each pin is one job, colored by its Pipeline section — the same colors as the status dots on the rows: {{chip:yellow|Waiting}} amber, {{chip:blue|Working}} blue, {{chip:purple|Ready to bill}} teal, {{chip:gray|Billed}} orange, {{chip:green|Paid}} green. The chips next to the title double as the key and as switches — tap one to hide or show that section's pins. **Paid starts hidden**; with hundreds of paid jobs on the map the live ones would disappear under them.

A job in **Collections** keeps the Billed color and wears a **red ring**, so the bills that are hardest to collect stand out without a chip.

The dark diamond is the office, with dashed rings at **25 and 50 miles** — the same office the Bid Board map and the bid form's Distance to Office use. Miles on this card are straight-line from the office.

:::example Where the crews are this week
Turn off Billed and Waiting. What's left is the blue Working pins — where the trucks are going today — and the ring tells you which ones are an hour out.
:::

## Opening a job from a pin

Click a pin for its card: job number and name, who the bills go to (the GC on a GC-paid job, otherwise the customer), the section, the percent done, the address and how far it is from the office, and what is still owed on a billed job. Then three buttons:

- {{button:outline-blue|Open job}} opens the job window, the same one the rows open.
- {{button:outline-blue|Edit}} opens the job's Edit tab.
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

Clicking a pin also lights the job's row on the board below and scrolls to it, the same way the # jump does, so the map and the list stay one thing.

On a phone, tapping a pin shows the job as a bar under the map instead of a pop-up, so the buttons stay big and the pin stays in view.

## Paid jobs

The board only loads Paid jobs when you open the Paid in Full section, so the Paid chip reads **…** until then. Tap it once and the board loads them and their pins appear; tap it again to hide them.

## The rail beside the map

On a desktop the map takes the left of the card and a rail on the right says what the map knows:

- **By distance from the office** — three boxes: **≤ 25 mi**, **25–50 mi**, **50 mi +**, each with how many jobs are pinned there, the dollars still to collect on them (open bills minus what has been paid — the same numbers the Billed and Ready to Bill sections use), and how many jobs to ask. Tap a box to hide or show that band's pins, the same way the section chips work.
- **Ask for money · longest waiting first** — the billed and ready-to-bill jobs, oldest bill first, then nearest. *Billed 46 d* reads red when the job is in Collections and amber once a bill is 30 days old. Tap a row to jump to its pin and light its row on the board. "+ N more" means the list is capped at five.
- The last line reads the pinned total and what is still to collect — *112 pinned · $696k to collect · Paid 723 off* — and carries the **no map location** link.

On a phone the rail sits under the map: the three boxes in a row, then the ask list.

:::example Friday collections call
Three amber rows and one red one at the top of Ask for money. Tap the red one — the pin lights, the Billed row scrolls into view under the map, and Open job takes you to the bill and the customer's number.
:::

## From a row to its pin

On a desktop, rest the mouse on any job row on the board and that job's pin on the map wears a pulsing halo in its section colour, so you can find where a job is without clicking anything. If the pin is folded into a cluster disc, the disc pulses instead. A job whose section chip is off, or that has no map location yet, shows nothing. Phones have no hover, so there the link runs one way: tap a pin to light its row.

## Cluster, Fit all, Hide map

Around Austin and San Antonio the pins sit on top of each other. **Cluster** groups pins that overlap at the current zoom into one disc with a count; a disc holding a job in Collections wears the red ring. **Click a disc** to zoom the map onto its jobs. Clustering is off unless you turn it on, and the choice is remembered on that device.

The map opens on the 50-mile ring, so one job in another state doesn't zoom it out to the whole country. **Fit all** frames every pin and the office. **Hide map** collapses the card to its title line and is remembered on that device; **Show map** or tapping the title brings it back.

## A job with no map location yet

Under the map, *N jobs have no map location yet* lists the jobs the map couldn't place. The address is looked up in the background the first time the card needs it; a job whose address the map still can't find is listed by its number as a link to its row, so you can open it and check the address.
