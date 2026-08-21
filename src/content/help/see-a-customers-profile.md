---
title: see a customer's full profile from the Pipeline board
category: Office
roles: assistant, master_technician
keywords: customer, profile, modal, pipeline, stages, balance, days to pay, contact
order: 45
---
Every job row on Jobs → Pipeline shows the customer's name with a small contact-card icon next to it. Clicking the icon **or the name** opens the customer's profile — everything the app knows about them, without leaving the board.

## What's in the profile

:::example Done Right Foundation
{{chip:blue|Commercial}} · Customer since Mar 2024

**Open balance $11,040** {{chip:green|none 30+ days}} · **Lifetime collected $86,410** · **Pays in ~9 days**
:::

- **Header** — chips for Commercial/Residential, and a {{chip:gray|GC on 7 jobs}} chip when they're a General Contractor on jobs, with "statement last sent" in the subline.
- **Contact band** — phone (tap to call), email (tap to write), address (opens Maps), plus any contact persons on file.
- **Money strip** — their **open balance** with an aging chip (green when nothing is 30+ days old, amber and red as bills age), **lifetime collected** across all their jobs, and **"Pays in ~N days"** — the median time from bill sent to payment received over the last year. Glance at it before a collections call: a customer who normally pays in 9 days with a fresh balance needs a different conversation than one at 45.
- **Jobs list** — money first: each job row shows its status dot, the job as a link (opens Job Detail *on top* of the profile), what's billed and how old ({{chip:red|170d}} reds at 90+), and the open dollars on the right. The visible rows plus the "+N more · $X open" line always add up to the open balance. **show all** expands the full list.
- **Work rails** — their projects (with the current step), bids, and estimates as clickable pills with status dots. Each pill opens the thing itself: projects open the workflow, bids open Bid Preview, estimates open the estimate.
- **Recent activity** — the latest notes and events across their newest jobs, so "what's happening with this customer lately" is answered without opening anything.
- **Footer** — {{button:outline|✎ Edit customer}} opens the normal customer editor; **Their projects** filters the Projects page to them. (A **Public page** button is reserved here for a coming feature.)

## Jobs without a linked customer

If a job only has a customer *name* typed on it (no linked customer record), the same icon opens the **link-or-create flow** instead, so you can fix the link right there — the "Not in Customers" badge next to the name is the tell.
