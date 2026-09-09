---
title: move between a job's Job, Edit, and Bill tabs
category: Office
roles: dev, master_technician, assistant, controller
keywords: job window, tabs, history, day grid, days worked, job detail, edit job, billing, bill tab, invoices, payments, line items, one window
order: 65
---
A job now opens as **one window with four tabs** — no more separate Job Detail and Edit Job modals bouncing you between each other. One **✕** (or **Escape**) closes the whole thing.

Under the tab bar, **every tab** shows the same job header: the job name, the action icons (share · supply house · send as task · calendar · mail · ⚙), and the **Street View photo** with the 📍 map link. The icons work from any tab — open the job calendar while billing, share the job while editing — and the address stays one glance away so you always know which house you're on. The **supply house** storefront icon turns **teal** once a job-account packet has gone out for this job; hover it to see who got it and when, click it for the history or to resend (see [share a job with a supply house](?g=share-job-with-supply-house)).

## The four tabs

- {{chip:blue|Job}} — the read view: photo and address, customer and contacts, the numbered activity feed, work/bill dates, the **Labor & Parts Cost** block with the Cost Timeline, and the profit summary. This is where "open job detail" lands.
- {{chip:blue|Edit}} — the job itself: numbers, name, address, service type, and the people-and-customer rows (below). The row's ✎ Edit button lands here, and so does the ⚙ on the Job tab.
- {{chip:blue|Bill}} — all the money, starting with the **Line Items** (the job's scope and Job Total) right at the top, then the billing summary bar, the segment bar with the break-off slider, **New Invoice**, the Invoices and Payments received tables, and Labor & Parts Cost with the Cost Timeline.

- {{chip:blue|History}} — the day grid: one row per day worked, coloured by how many people were on site. The same view Projects → Job History shows, now for every job, project or not.

## Where is the team labor number?

Owners, controllers and master techs see a **Team labor** row at the top of the Job tab's cost block — the total, then "8.0 h · Malachi" or "277.5 h · 7 people" under it. Tap it for the per-person split. That row is the same number the Cost Timeline's 👷 markers add up to and the same one Job Summary's **Labor** column shows, so the three always agree. A salaried day counts as 8 h on whichever job the person was clocked to; hourly people count their recorded session hours. Other roles see the block as **Parts Cost**, without the row — the dollars come from wages.

## The History tab

**History** looks back 180 days by default (move the range to see more). Tap a day to see who was there and what it cost. Nothing on this tab edits anything.

## The Edit tab reads as rows

The middle of the Edit tab — **Account man, Team, Customer, Phone, Email, GC/Builder, Date met, Folders, Project, Plans, Bid, Development** — is a compact list: each row shows the current value at a glance, with a **—** where nothing is set. Tap a row (or its ✎) to open the familiar editor for just that field; tap again to fold it away. The **Folders** and **Plans** rows keep their Drive links clickable right on the row, so opening the customer's files never requires expanding anything.

:::example Fixing a phone number
Edit tab → tap the **Phone** row → retype the number → tap the row again to fold it. Autosave takes it from there.
:::

## Things worth knowing

- **Switching tabs never loses work.** Type half a job name, hop to Bill to check the remaining amount, come back — your keystrokes are still there, and autosave keeps running throughout (see *know when Edit Job saves my changes*).
- Edits you make on the Edit or Bill tab show up on the Job tab right away — it refreshes itself after each save.
- {{button:red|Delete}} lives at the bottom of the **Edit** tab only. Its confirm rounds team labor to a readable figure ("≈ 22.8 hrs") and points a dev to **Settings → Data & recovery → Recently deleted** for the 90-day restore.
- Creating a **new** job still uses the plain New Job form — a job with nothing to read or bill yet doesn't need tabs. If you've typed anything, Cancel, Escape or clicking outside asks **Discard this job?** first — an untouched form just closes. Escape closes only the window on top, so a New Job opened from a bid never takes the bid window with it.

:::example A billing round-trip
Open the job → **Bill** tab → drag the slider to 80% → Create invoice → hop to **Job** to confirm the billed bar moved. One window the whole time.
:::

Field roles (Sub and Helper) keep the simple read-only Job Detail view they've always had.
