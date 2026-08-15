---
title: move between a job's Job, Edit, and Bill tabs
category: Office
roles: dev, master_technician, assistant, controller
keywords: job window, tabs, job detail, edit job, billing, bill tab, invoices, payments, line items, one window
order: 65
---
A job now opens as **one window with three tabs** — no more separate Job Detail and Edit Job modals bouncing you between each other. One **✕** (or **Escape**) closes the whole thing.

## The three tabs

- {{chip:blue|Job}} — the read view: photo and address, customer and contacts, the numbered activity feed, work/bill dates, and the profit summary. This is where "open job detail" lands.
- {{chip:blue|Edit}} — the job itself: numbers, name, address, service type, Account Man, Team, Customer, Project/Plans/Bid links, and the **Line Items** (the job's scope and Job Total). The row's ✎ Edit button lands here, and so does the ⚙ on the Job tab.
- {{chip:blue|Bill}} — all the money: the billing summary bar, the segment bar with the break-off slider, **New Invoice**, the Invoices and Payments received tables, and Labor & Parts Cost with the Cost Timeline.

## Things worth knowing

- **Switching tabs never loses work.** Type half a job name, hop to Bill to check the remaining amount, come back — your keystrokes are still there, and autosave keeps running throughout (see *know when Edit Job saves my changes*).
- Edits you make on the Edit or Bill tab show up on the Job tab right away — it refreshes itself after each save.
- {{button:red|Delete}} lives at the bottom of the **Edit** tab only.
- Creating a **new** job still uses the plain New Job form — a job with nothing to read or bill yet doesn't need tabs.

:::example A billing round-trip
Open the job → **Bill** tab → drag the slider to 80% → Create invoice → hop to **Job** to confirm the billed bar moved. One window the whole time.
:::

Field roles (Sub and Helper) keep the simple read-only Job Detail view they've always had.
