---
title: see your jobs on a map
category: Jobs & Scheduling
roles: dev, master_technician, assistant, controller, subcontractor, helpers, estimator, primary, superintendent
keywords: map, my jobs, dashboard, pins, directions, where is the job, job location, working, waiting
order: 31
---
The Dashboard has a **Your jobs on a map** card above your Assigned Jobs. It plots every active job you're on — the same jobs as your Assigned Jobs rows, plus, for a superintendent, the jobs on your assigned projects. Nobody sees a job here they couldn't already open from the Dashboard.

## Reading the map

Each pin is one job, colored by where it is in the pipeline: {{chip:blue|Working}} blue, {{chip:yellow|Waiting}} amber. The counts next to the title double as the key. Jobs that have moved on to billing don't get a pin — the map is about where you might drive today.

:::example A superintendent's morning
The card shows **3 working · 2 waiting**. Two blue pins sit across town, one is the job you're on, and the amber pins are the two that start next week.
:::

## Opening a job from a pin

Click a pin for its card: job number and name, the address, the stage it's on and when the last report came in, then two buttons.

- {{button:outline-blue|Open job}} opens the same job window your Assigned Jobs rows open.
- {{button:outline-blue|Directions}} opens the address in Google Maps, ready to navigate.

On a phone, tapping a pin shows the job as a bar under the map instead of a pop-up, so the buttons stay big and the pin stays in view.

## Fit all and Hide map

{{button:outline-blue|Fit all}} re-centers the map on every pin after you've zoomed in on one. **Hide map** collapses the card; the choice is remembered on that device, and **Show map** brings it back.

## A job with no map location yet

A job whose address hasn't been placed on the map yet is listed under the map as *1 job has no map location yet*, with its name as a link so you can still open it. The address is looked up in the background the first time anyone's Dashboard needs it; a job with no address at all stays in the list until someone adds one.
