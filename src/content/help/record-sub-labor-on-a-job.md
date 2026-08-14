---
title: record sub labor on a job
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub labor, subcontractor, sub sheet, labor book, job picker
order: 62
---
Sub labor lives on **Jobs → Sub Labor**. Every entry belongs to a job — the New Sub Labor form starts with the standard job search, and everything downstream (the job's profit band, Crew P&L, sub sheets) rolls the cost up to that job automatically.

## New entry — three quick steps

{{button:blue|New Sub Labor}} opens a short three-step form (built for phones, same on desktop) with a progress bar up top. Enter moves you forward; {{button:outline|Back}} never loses what you typed.

1. **Job** — tap the field to open the same job search Schedule uses: type a number, name, address, or customer, and every result shows its trade pill and what stage the job is in ({{chip:yellow|Working}}, {{chip:blue|Billed}}, and so on), finished jobs under their own divider. Picking the job shows its **address right under the name** — it comes from the job and isn't edited here (fix it in Edit Job if it's wrong). The pick also pre-selects the job's crew for the next step. Date and service type live here too.
2. **Crew** — the job's team arrives pre-selected as tappable chips; tap to add or remove people from External Subs, Internal Subs, or Office Team, or search across all three. {{button:blue|Add Sub}} creates a new external sub on the spot.
3. **Work and cost** — describe the work and its cost, or flip on **Itemize hours and rate**. The **Labor book** section fills line items from your book prices for the picked service type. {{button:blue|Save}} shows what's still missing right on the button until everything's in.

:::example Where did Distance go?
New entries no longer ask for miles — the drive-cost math simply isn't applied to them. Older entries keep their saved distance, keep paying out drive cost, and still show the field when edited.
:::

## Editing old entries

Editing opens the classic single-page form: entries created before the picker keep their typed **Job #**, **Address**, and **Distance** fields — nothing moves or re-links. The job association still matches by number, so keep the number matching the job's # if you change it.
