---
title: see where everyone clocked in is right now
category: Office
roles: dev, master_technician, assistant, controller, superintendent, primary
keywords: map, clocked in, currently in, where is everyone, who is where, crew locations, job map, dispatch, directions, travel time, drive time, distance to office
---
The **Currently In** bar — on the Dashboard, on People → Hours and on Quickfill — has a {{button:outline|Map}} button in its control cluster, next to the other small controls. It opens **Where everyone is**: the people clocked in right now, placed on a map by the job or bid they are clocked on.

## Reading the map

**A pin is a job, not a person.** Everyone clocked on one job shares a pin, and the number on it is the head count. Jobs are {{chip:blue|blue}}, bids {{chip:purple|violet}} — the same colors as the Dashboard and Bid Board maps. The office is the navy diamond with its distance ring; anyone clocked on the office job sits there rather than on a pin of their own.

:::example A Tuesday at 11:45
Seven people in. Abraham and Paige share the Vecchio Pinpoint pin with a **2** on it, three other jobs have one pin each, Grace is on the office diamond, and Isiah — clocked in with no job yet — is named under the list with an Assign button.
:::

## The stops beside the map

The list on the right is the same people regrouped by place, most people first. Each stop shows the job, its address and the miles from the office, then who is there and for how long. Tap a stop to select its pin; tap a pin to see its people.

- {{button:outline-blue|Open job}} opens the same job window the strip's rows open ({{button:outline-blue|Open bid}} goes to the Bid Board for a bid).
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

**Not on a job** lists anyone clocked in with no job or bid. They are never guessed onto the map — use the {{button:outline-blue|Assign}} door there (the strip's own) and they move onto their pin as soon as it saves.

## Travel times to the office

The miles beside each stop are straight-line at first, so opening the map costs nothing. Press {{button:outline-blue|Travel times}} in the header (on a phone, on the line under the title) and every stop on the map is routed to the office: the line becomes **20 mi · 32 min to the office**, in the list, in the pin's card and on the phone bar. It is one lookup per job, not per person, and the answers are kept for the page, so pressing again only routes stops that are new. A stop the router cannot answer shows an estimate marked ≈ (straight line × 1.3 at 35 mph), and the footer says how many were routed and how many estimated.

## It moves on its own

The map reads the same live feed as the Currently In bar, so it changes as people clock in and out; the header shows the time and *live*. There is nothing to refresh, and closing and reopening it costs nothing.

## On a phone

The map opens as a full-screen sheet. Tapping a pin shows that stop as a bar under the map with two big buttons, and the other stops are listed beneath. Close with ✕.

## A job with no map location yet

A job whose address has not been placed yet is named under the map as *1 job has no map location yet*, with a link so you can still open it. The address is looked up in the background the first time any map needs it. For the everything-view with filters, use *Open the full map ›* in the footer.
