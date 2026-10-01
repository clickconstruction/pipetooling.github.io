---
title: see jobs, bids, and estimates on the map
category: Office
roles: dev, master_technician, assistant, estimator
keywords: map, pins, geocode, bid stages, lost bids, filter map, draw area, legend
order: 30
---
You open the Map page to see every job, bid and estimate that has an address. Each pin's color says what kind of record it is.

The key in the map's top-right corner is always in sync. Blue is a job, orange is a bid, green is an estimate.

## Show or hide layers

You tap a pill in the header to turn that layer on or off:

:::example the header layer pills
{{chip:blue|Jobs}} {{chip:yellow|Bids}} {{chip:green|Estimates}}
:::

A filled pill is on. A grayed-out pill is hidden. The map, the key and the table below all follow the pills.

## Filter bids by stage

While the {{chip:yellow|Bids}} pill is on, a row of smaller chips appears next to it. The chips are **Unsent**, **Pending**, **Won**, **Started** and **Lost**. Only **Won** and **Started** start selected. You tap any chip to turn it on or off. These are the same sections as the Bid Board, so a bid sits in exactly one:

- **Unsent**: working bids that have not been sent yet
- **Pending**: sent, not yet won or lost
- **Won**: marked won
- **Started**: started or complete
- **Lost**: marked lost

Turn a stage chip off to hide those bids from the map and the table. Turning the whole Bids pill off hides every bid and the stage chips with it.

:::example show only lost bids
Turn off every stage chip except {{chip:yellow|Lost}} to see where lost work clusters — useful for spotting neighborhoods or builders worth a second look.
:::

You click a bid pin to see its stage in the popup.

## Draw an area

You use the polygon tool to draw around an area. The polygon tool is the one that draws a shape. It sits at the top-left of the map. The table below narrows to the pins inside the shape. {{button:outline|Clear draw}} removes the shape.

## When an address doesn't show up

Pins only appear for addresses the app could geocode. To geocode is to turn an address into a spot on the map. While addresses resolve, a **Geocoding** progress list appears in the header. It shows each address with its job, bid or estimate number. If one fails, the list shows the reason next to it. You fix the address on the job, bid or estimate. Then you press {{button:outline|Reload data}}.
