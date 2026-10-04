---
title: see the pipeline on a map
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller, superintendent
keywords: map, pipeline, jobs, pins, where is the job, distance, miles from the office, collections, directions, hide map, cluster, paid jobs, fit all, zoom, scroll wheel, mouse wheel, zooms out, to collect, ask for money, oldest bill, rail, hover, as of, rewind, scroll back in time, history, play, slider, crews, who is where, clocked in, violet ring
order: 32
---
The Pipeline has a Jobs on a map card under the toolbar. It plots the jobs the board is showing as pins.

**Jobs → Pipeline** has a **Jobs on a map** card under the toolbar. It plots the same list the board shows. So the search box and the GC, development, Account Man and contract filters all change the pins. GC means the general contractor. Nobody sees a pin here they could not already open from the board.

## Reading the map

Each pin is one job, colored by its Pipeline section. The colors are the same as the status dots on the rows. {{chip:yellow|Waiting}} is amber. {{chip:blue|Working}} is blue. {{chip:purple|Ready to bill}} is teal. {{chip:gray|Billed}} is orange. {{chip:green|Paid}} is green. The chips next to the title double as the key and as switches. You tap one to hide or show that section's pins. **Paid starts hidden**. With hundreds of paid jobs on the map the live ones would disappear under them.

A job in **Collections** keeps the Billed color and wears a **red ring**. So the bills that are hardest to collect stand out without a chip.

The dark diamond is the office, with dashed rings at **25 and 50 miles**. It is the same office the Bid Board map and the bid form's Distance to Office use. Miles on this card are straight-line from the office.

:::example Where the crews are this week
Turn off Billed and Waiting. What's left is the blue Working pins — where the trucks are going today — and the ring tells you which ones are an hour out.
:::

## Opening a job from a pin

You click a pin for its card. The card shows the job number and name, and who the bills go to. That is the GC on a GC-paid job, otherwise the customer. It also shows the section, the percent done, the address and how far it is from the office. On a billed job it shows what is still owed. Then three buttons:

- {{button:outline-blue|Open job}} opens the job window, the same one the rows open.
- {{button:outline-blue|Edit}} opens the job's Edit tab.
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

Clicking a pin also lights the job's row on the board below and scrolls to it. The # jump does the same. So the map and the list stay one thing.

On a phone, you tap a pin. The job shows as a bar under the map instead of a pop-up. So the buttons stay big and the pin stays in view.

## Paid jobs

The board only loads Paid jobs when you open the Paid in Full section. So the Paid chip reads **…** until then. You tap it once and the board loads them and their pins appear. You tap it again to hide them.

## The rail beside the map

On a desktop the map takes the left of the card. A rail on the right says what the map knows:

- **By distance from the office** has three boxes: **≤ 25 mi**, **25–50 mi**, **50 mi +**. Each box says how many jobs are pinned there. It says the dollars still to collect on them. That is open bills minus what has been paid, the same numbers the Billed and Ready to Bill sections use. It says how many jobs to ask. You tap a box to hide or show that band's pins, the same way the section chips work.
- ***Ask for money · longest waiting first*** lists the billed and ready-to-bill jobs, oldest bill first, then nearest. *Billed 46 d* reads red when the job is in Collections. It reads amber once a bill is 30 days old. You tap a row to jump to its pin and light its row on the board. "+ N more" means the list is capped at five.
- The last line reads the pinned total and what is still to collect. It reads *112 pinned · $696k to collect · Paid 723 off*. It carries the **no map location** link.

On a phone the rail sits under the map. The three boxes sit in a row, then the ask list.

:::example Friday collections call
Three amber rows and one red one at the top of Ask for money. Tap the red one — the pin lights, the Billed row scrolls into view under the map, and Open job takes you to the bill and the customer's number.
:::

## From a row to its pin

On a desktop, you rest the mouse on any job row on the board. That job's pin on the map wears a pulsing halo in its section colour. So you can find where a job is without clicking anything. The pin may be folded into a cluster disc. Then the disc pulses instead. A job whose section chip is off shows nothing. A job with no map location yet shows nothing. Phones have no hover. So there the link runs one way. You tap a pin to light its row.

## Scroll back in time

{{button:outline-blue|⏮ As of}} beside the title opens a row under the map. It holds **Play**, the day, a slider and jump chips. The chips read ***today · 1 wk · 1 mo · 3 mo · 6 mo · Feb 22***. You drag the slider left. Every pin wears the status the job had on that day. It is blue where it was still working. It is orange where the bill had already gone out. A job that did not exist yet is not drawn. The chips, the distance boxes and Ask for money all read that day. The dollars to collect are the bills that had gone out minus the payments in by then.

**Play** walks the map forward a day at a time to today. You drag the slider or tap a chip to pause it.

A line under the map says what happened since. It reads *Since Jun 2: +41 jobs started · 38 billed · 52 paid · 2 sent to collections*.

History starts on **Feb 22, 2026**, the day the Pipeline began recording moves. The slider stops there and says so. While you are rewound, the map shows every job that existed that day. The search box and filters do not matter then. They describe today's rows. Two things are not replayed. One is the percent done. The other is a past stay in Collections that has since been paid off.

:::example Was June as busy as it felt?
Tap **3 mo** and count the blue pins, then press Play and watch the orange spread as the summer's bills go out. The since-then line gives the tally without counting.
:::

## Crews on the day

**Crews** beside the title turns on a layer that reads the day's clock sessions. Every pin where someone clocked in wears a **violet ring**. The pin's card says *2 people clocked in here today*. The rail says *Crews today: 5 people on 4 jobs*. Rewound with **As of**, it shows who was where on that day instead. The layer is off until you turn it on. The choice is remembered on this device.

:::example Where did everyone go on Tuesday?
Set **As of** to Tuesday, turn on **Crews**, and the violet rings are the jobs that had people on site. A blue pin with no ring was open but nobody was there.
:::

## Cluster, Fit all, Hide map

Around Austin and San Antonio the pins sit on top of each other. **Cluster** groups pins that overlap at the current zoom into one disc with a count. A disc holding a job in Collections wears the red ring. You **click a disc** to zoom the map onto its jobs. Clustering is off unless you turn it on. The choice is remembered on that device.

The map opens on the 50-mile ring. So one job in another state does not zoom it out to the whole country. **Fit all** frames every pin and the office.

On a desktop the mouse wheel scrolls the page when the pointer crosses the map. So you can scroll down to the board without the map zooming out. You **click the map once** and the wheel zooms it from then on. The **+** and **−** buttons, dragging and the pins work from the start. **Hide map** sits in the top right corner of the card. It collapses the card to its title line. That choice is remembered on that device. **Show map** or tapping the title brings it back.

## A job with no map location yet

Under the map, *N jobs have no map location yet* lists the jobs the map could not place. The address is looked up in the background the first time the card needs it. The map may still not find a job's address. Then that job is listed by its number as a link to its row. You open it and check the address.
