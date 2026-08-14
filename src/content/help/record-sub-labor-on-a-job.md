---
title: record sub labor on a job
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub labor, subcontractor, sub sheet, labor book, job picker
order: 62
---
Sub labor lives on **Jobs → Sub Labor**. Every entry belongs to a job — the New Sub Labor form starts with the standard job search, and everything downstream (the job's profit band, Crew P&L, sub sheets) rolls the cost up to that job automatically.

## New entry

{{button:blue|New Sub Labor}} opens the form. Start at the top:

1. **Job** — search by number, name, address, or customer, exactly like the pickers on Schedule and Accounts Receivable. Picking the job fills the **Address** and pre-checks the job's crew under Contractors — no more typing the job number and address by hand.
2. **Distance (mi)** — still yours to enter; it drives the drive-cost portion of the sub's pay (mileage plus drive-time at the labor rate).
3. **Contractors** — the pick pre-checked the job's team; adjust with the checkboxes (External Subs, Internal Subs, Office Team). {{button:blue|Add Sub}} creates a new external sub on the spot.
4. **Line items** — describe the work and its cost, or flip on **Itemize hours and rate**. The **Labor book** section fills line items from your book prices for the picked service type.

:::example Address looks wrong?
The address fills from the job, but stays editable — fix it here if the sub actually worked from a different address, without touching the job itself.
:::

## Editing old entries

Entries created before the picker keep their typed **Job #** and **Address** fields when you edit them — nothing moves or re-links. The job association still matches by number, so keep the number matching the job's # if you change it.
