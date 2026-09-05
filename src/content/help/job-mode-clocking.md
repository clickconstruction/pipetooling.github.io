---
title: clock in and out with Job Mode
category: Field Work
roles: subcontractor, helpers, superintendent, master_technician
keywords: clock in, clock out, job mode, time tracking, leave report, next job, my requests, dispatch answered
order: 10
---
Job Mode turns the Dashboard into one big card built for working in the field: it shows your current job, your next scheduled job, and big buttons for the things you actually do on site.

## Turning Job Mode on

1. Tap the {{icon:gear}} **gear menu** in the top-right of the header.
2. Toggle **Job Mode**.

With Job Mode on, the Dashboard shows the Job Mode card first. You can always tap {{button:outline|Show full dashboard}} underneath it to see everything else.

The header also changes: the three task buttons become a **Contact:** row — a green phone button that calls the office, plus {{button:blue|dispatch}}, {{button:purple|estimating}}, and {{button:blue|teammate}} spelled out. On a narrow phone screen they stay as the compact icon buttons, with the phone button on the left.

## The Job Mode card

Here's what the card looks like during a working day:

:::example The Job Mode card
**PLUM 512** | Smith House Repipe
123 Main St
*Clocked in since 8:02 AM*

**TODAY · 1 OF 4 DONE**
✓ 8:00 — PLUM 512 · Smith House Repipe
● 10:30 — PLUM 498 · Baker St Water Heater *(NOW)*
! 1:00 — GAS 77 · Riverbend Gas Test *(STILL OPEN)*
○ 3:00 — PLUM 501 · Oakmont Trim Set

{{button:blue|Leave Report}} &nbsp; {{button:green|Next Job}}

{{button:amber|Turnaway — not ready / not home}}

<u>Clock out</u>
:::

- {{button:blue|Leave Report}} — file a field report on the current job (see the Reports guide).
- The green button changes with your day: {{button:green|Clock In}}, {{button:green|Start First Job}}, {{button:green|Next Job}} — and when only your current job is left, it turns into {{button:red|Wrap Up Day}} to clock you out.
- {{button:amber|Turnaway — not ready / not home}} — for when you arrive and can't do the work (see the Turnaways guide).

## Your day on the card

Under the job header, the card lists **every job on today's schedule**, in order:

- ✓ green check — you've already clocked time there today.
- A green ring — the job you're on **now**.
- An amber **still open** flag — a job you drove past (not home, site not ready) that's still owed a visit.
- A hollow dot — coming up later.

**Tap any open job to jump straight to it** — no need to take them in order. You'll get the same quick notes sheet, already pointed at the job you tapped. Jobs you skip aren't lost: they stay flagged, and {{button:green|Next Job}} offers them once the rest of your day is done.

While you're clocked into a job, the card keeps going below the buttons:

- **Customer** — the customer's name with tap-to-call phone and tap-to-email links, so reaching them is one tap.
- {{button:outline|Job detail}} — opens the full **Job Detail** modal right over the card.
- A **Street View photo** of the job address — tap it to open Street View in Google Maps.
- **Job updates** — the same updates thread as Job Detail: read what the office posted and add your own note without leaving the card.

## Clocking in and out

{{gif:job-mode-clocking.gif|Starting the day: the Ready to start card, Start First Job with intent notes, and the clocked-in card}}

- Tap {{button:green|Clock In}} to start your day. If you have a schedule, the card offers your scheduled job; otherwise you can pick a job manually.
- Moving on? Tap {{button:green|Next Job}} — you'll be asked for brief notes about the job you're leaving, and the sheet shows **where you can go**: your suggested next job is preselected, but you can pick any open job instead, or choose **Done for the day** to clock out.
- Your location is captured when you punch, and your hours flow to the office automatically for approval.

### When you have no signal

If the punch can't reach the server — a crawlspace, a basement, a dead zone — the sheet says **No connection — the app couldn't reach the server, so nothing was saved** and shows a {{button:outline|Retry}} button. Nothing was recorded, so it's safe to tap it as soon as you have a bar. When your signal comes back on its own, the message changes to **Back online — tap Retry to try again**; the punch still waits for your tap so it is never sent twice.

:::example Clocking in from a basement
You tap {{button:green|Clock In}}, the sheet shows **No connection** and {{button:outline|Retry}}. You climb the stairs, the line flips to **Back online**, you tap {{button:outline|Retry}} — the timer starts.
:::

The same Retry appears when you save a report offline. Your **Schedule** tab is different: it reloads by itself the moment the signal returns, no tap needed. If a message says something else — for example that you don't have permission — Retry will not appear, because trying again would not change the answer.

## Clocking out

Three ways, depending on your day:

- **End of the day** — when your current job is the last one open, the green button becomes {{button:red|Wrap Up Day}}. Tap it and you'll get the usual clock-out review (notes, and a nudge if a job is missing its report).
- **From the switch sheet** — pick **Done for the day** at the bottom of the "Where to next?" list.
- **Any other time** — lunch, a parts run, leaving early: tap the small underlined **Clock out** link under the buttons. Your remaining jobs stay flagged on the card for when you're back.

Salaried teammates don't clock out manually — their hours are handled automatically, so these buttons don't appear.

The details section (customer contact, Street View, updates) also shows for your **Ready to start** job before you clock in — review the visit before you head out.

Below the card, **My Schedule** shows your upcoming visits — the same section as the full Dashboard — so you can see what's next without leaving Job Mode. {{button:outline|Show full dashboard}} sits just under it.

## The Job Mode tab bar

With Job Mode on, a tab bar pins to the bottom of the screen — everything on it is **yours only**:

- **Dashboard** — the Job Mode card you know.
- **Schedule** — a two-week strip plus your own day agenda: your visits with times, customer, and address. Tap one to open the job.
- **Inbox** — any notification banners meant for you (like stale tally transactions) up top, then your **My Inbox** tasks, then **My requests**: everything you've sent to Dispatch (a red phone or red photos tap, a note to Dispatch) split into **Waiting on Dispatch** and **Answered** — an answered one shows the office's note as {{chip:green|Office answered: "Added — it's 555-0100"}}. You also get a push, **Dispatch answered**, the moment they close it.
- **Customers** — just the customers whose jobs have been on your schedule; tap one for its full interaction summary.

## Good habits

- Clock into the job you're physically working on — switching is one tap, and accurate time keeps everyone's numbers right.
- Leave a report before you head out. It takes under a minute and saves phone calls later.
