---
title: mark property kinds from Quickfill
category: Office
roles: dev, master_technician, assistant, controller
keywords: property kind, residential, commercial, non-residential, quickfill, lien clock, google maps, unpaid jobs, station, looks right
order: 11
---
Quickfill has a station called Property kinds. It lists every unpaid job whose property is not yet marked residential or commercial.

## Why it matters

A property's kind sets its lien clock. A residential property's notice is due a month sooner. A job with no kind reads the wrong deadline until someone picks.

## What the list shows

Each row is one property, not one job. The jobs at that address sit under it as chips. Rows with a lien clock running come first. Those are Billed and Collections jobs. The rest follow, biggest balance first.

The row says what the app already knows. A GC on the job leans commercial. GC means the general contractor. A commercial account leans commercial. A homeowner account leans residential. A word like tenant or suite leans commercial. That half of the switch is outlined and reads looks right. Nothing is saved until you tap.

:::example A row with a hint
8507 Culebra Road · Culebra Crossing Partners LLC · GC: Ventana Builders · HCP 1211 and 1240, Billed · Looks commercial: a GC on the job · {{button:outline|Residential}} {{button:amber|Commercial · looks right}}
:::

## Picking

Tap the address to open it in Google Maps. A house is residential. So is a duplex, triplex, fourplex, or a condo the owner lives in. Everything else is commercial. Apartments count as commercial.

Tap {{button:outline|Residential}} or {{button:outline|Commercial}}. The pick lands on the customer's property. Every job at that address follows it. The row turns into a green line that says what happened. Tap {{button:outline|Undo}} on the green line if you picked wrong.

Some jobs have a typed address with no saved property. The row says so. The pick saves the address as a property on the customer and links the job.

## What is not here

A job with no customer and no GC has nowhere to keep a property. The foot of the station counts those jobs. They are in Missing job info on the same page. Fix the customer there first.

You can also change a kind later from the Pipeline. See [mark a property residential or commercial from the Pipeline](/help/mark-a-property-residential-or-commercial).
