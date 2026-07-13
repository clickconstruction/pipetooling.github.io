---
title: see jobs, bids, and estimates on the map
category: Office
roles: dev, master_technician, assistant, estimator
keywords: map, pins, geocode, bid stages, lost bids, filter map, draw area, legend
---
The Map page plots every job, bid, and estimate that has an address. Pin colors tell you what kind of record you're looking at — the key in the map's top-right corner is always in sync: blue is a job, orange is a bid, green is an estimate.

## Show or hide layers

The pills in the header toggle each layer on and off:

:::example the header layer pills
{{chip:blue|Jobs}} {{chip:yellow|Bids}} {{chip:green|Estimates}}
:::

A filled pill is on; a grayed-out pill is hidden. The map, the key, and the table below all follow the pills.

## Filter bids by stage

While the {{chip:yellow|Bids}} pill is on, a row of smaller chips appears next to it — **Unsent**, **Pending**, **Won**, **Started**, and **Lost**. These are the same sections as the Bid Board, so a bid sits in exactly one:

- **Unsent** — working bids that haven't been sent yet
- **Pending** — sent, not yet won or lost
- **Won** — marked won
- **Started** — started or complete
- **Lost** — marked lost

Turn a stage chip off to hide those bids from the map and the table. Turning the whole Bids pill off hides every bid and the stage chips with it.

:::example show only lost bids
Turn off every stage chip except {{chip:yellow|Lost}} to see where lost work clusters — useful for spotting neighborhoods or builders worth a second look.
:::

Clicking a bid pin shows its stage in the popup.

## Draw an area

Use the polygon tool (top-left of the map) to draw around an area — the table below narrows to the pins inside it. {{button:outline|Clear draw}} removes the shape.

## When an address doesn't show up

Pins only appear for addresses the app could geocode. While addresses resolve, a **Geocoding** progress list appears in the header showing each address with its job, bid, or estimate number. If one fails, the list shows the reason next to it. Fix the address on the job, bid, or estimate, then press {{button:outline|Reload data}}.
