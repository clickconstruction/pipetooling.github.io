---
title: run the office day with Quickfill
category: Office
roles: assistant
keywords: quickfill, daily, mark up to date, office routine, sections
order: 10
---
Quickfill is the office's daily runway: one page of review sections, each with a button that says "I've looked at this." Working top to bottom keeps the whole operation reviewed on a rhythm without anyone keeping a mental checklist. The dashboard's chase-work nudges live here too as their own stations — **Lost bid reasons**, **GC weekly review**, and **Job follow-ups** — each with its one-tap card and its own mark button — and the dashboard's **Needs you** card itself closes the page as the last station. On a clean day the cards hide but the rituals stay stampable.

On a desktop it's the heart icon in the header; on a phone, open the ☰ menu on the left — **Quickfill** is the first entry.

## How marking works

Every section is a card with a **"Mark [Section] up to date!"** button. The button's color tells you how fresh the last review is:

:::example The freshness colors
{{button:red|Mark Warnings up to date!}} &nbsp;— never marked, or more than 30 hours ago

{{button:amber|Mark Warnings up to date!}} &nbsp;— 12 to 30 hours ago

{{button:green|Mark Warnings up to date!}} &nbsp;— reviewed within the last 12 hours
:::

Pressing it records who marked it and when, and collapses the section into a green bar:

:::example A marked section
{{chip:green|Warnings — Marked up to date at 8:41 AM by Dana. Expands automatically in 12h.}} &nbsp; {{button:outline|Open now}}
:::

Sections re-expand on their own after 12 hours, so tomorrow's pass starts fresh. Use {{button:outline|Open now}} to peek inside a collapsed section, and the history icon to see who marked it recently.

Marking a section also removes its chip from the **floating section bar** at the bottom of the screen for the rest of your visit — the bar shrinks toward empty as your pass progresses. The chips all come back the next time you open Quickfill (the sections themselves stay collapsed until their 12 hours are up), and {{button:outline|Open now}} puts a section's chip back immediately.

## Finding a section fast

A **search box** sits between the jump buttons and the first section. Typing filters the section list live by name — for example `bill` leaves only the billing sections on the page:

:::example Searching sections
Search sections… `bill` → shows **Jobs Billing**, **Billed Awaiting Payment**, and **Complete, no Total Bill**; everything else hides until you clear the search (✕ or Escape).
:::

The jump buttons above the box always show every section, and the floating section bar follows the search. The filter resets when you leave the page.

On a phone the jump buttons are a single row you flick sideways, with a one-line tally under it — **3 of 19 fresh · 16 need a look · oldest 2d** — so the first section starts right under the search box. Every section header also carries a small {{button:red|✓ Mark}} that does the same thing as the big button at the foot, so a long list never stands between you and marking it (sections that ask for a note first — Texts, Email, Physical inbox — keep just their own button).

## What's on the page

The sections cover the office's recurring review surfaces — among them:

- **Warnings** and **Office Arriving / Office Leaving** — start and end of day checks.
- **Assistant Dailys** — the office's shared daily duties (schedule conflict check, email and physical inboxes, time-off heads-up, trash out at day's end). One set of checkboxes for the whole team each day: whoever does a duty checks it off, the row shows who and when, and the list clears overnight. There's no assigning — if a box is open, it's anyone's to take.
- **Vehicle check-ins** — vehicles due for an odometer reading: assigned trucks weekly, motor-pool trucks monthly (those rows say *walk out & check* — there's nobody to call). Each row has the holder's name as a tap-to-call link, the last reading with its age, a **Miles** box, and the check-in questions as checkboxes — *Any lights on the dash?* out of the box. Check a box and a short note about what you saw is required; {{button:blue|Save}} writes the reading, puts the whole check-in on the vehicle's history, and files a problem report for anything you checked. Unassigned vehicles are skipped, and a dev can tune the cadence and questions from People → Vehicles → **⚙ Check-ins ›**.

:::example Saving a check-in
2019 Ford F250 · ☎ Malachi · **Miles: 231,400** · ☑ Any lights on the dash? → "ABS light came on yesterday" → {{button:blue|Save}} — the reading and the answer land on the truck's history, and an ABS-light problem report opens on the fleet board.
:::
- **People Hours** and **Unassigned field time** — time approval. When clock sessions from the last 7 days have no job or bid, a **Match sessions to jobs** block appears right on the Unassigned field time section (the same flow People → Hours opens from its {{button:outline|Match sessions}} button): sessions spread out in columns grouped by person, each with one-tap suggestions, a job search, and Skip — plus **Apply all** for sessions with exactly one Dispatch match. When the window is clear, the block disappears. In the unassigned list, a day whose only assignment is the Office job reads **"Office only — doesn't cover field time"**: Office time is overhead, so the day stays listed until a field job is assigned. The day audit's **Job / bid assignments** panel marks Office rows the same way, and its {{button:outline|↺ Re-sync from clock}} button rebuilds the day's assignments from its approved clock sessions — the quick fix when the assignment no longer matches where the person actually clocked.
- **Crew Jobs / Bids** — the per-person day splits behind Team Labor costs. A row wearing the **⏱ from clock** badge is owned by approved clock sessions: it recomputes on every approval or time adjustment, so it's locked here — fix the underlying sessions instead. Rows without the badge (unassigned or unclocked days) stay hand-editable, and that's where hours with no job get assigned before payroll.
- **Jobs Cleanup** — two things in one station. First, **sub labor with no job**: every sub labor sheet whose job number is blank or matches no job, newest first, with its contractor, date, address, total and what's due; {{button:blue|Link job}} opens that sheet in Edit Sub Labor with the Job search one tap away, and the row disappears once the sheet is linked. Second, **Today's Money Opportunities** — the same cards as Jobs → Pipeline (bill the finished work, chase the 90+ tail, allocate deposits, bills with no bill line, statement rounds, who to call about payment); every button lands on the Pipeline with that exact list or filter open. The "N open" count is sheets + cards; when both are empty the section says the pipeline is clean.
- **Jobs Billing** and **Billed Awaiting Payment** — the billing loop (see the billing guide).
- **Complete, no Total Bill** — jobs marked **100% complete** (latest field report %, or the Edit Job **% complete** field when no report has one) whose **Total Bill** is empty or $0, listed right in the section. Each job shows when work **started**, its **clock sessions** and hours (hover for every work date); {{button:outline-blue|Job Detail}} opens the Job Detail modal, {{button:red|Edit job}} opens Edit Job to set the Job Total, and {{button:outline|Activity ▾}} expands the same activity history you see in Job Detail. Uses the same 100% rule as the Job Summary **%** column (a paid invoice on a job with no Total Bill still counts as complete here — that is exactly what the section is for) and the same minimum-HCP cutoff as Jobs Billing.
- **Missing bill dates** — bills that are billed or paid but have no bill date, so their payments can't teach the pay-speed math (the clock behind "when will this customer pay?"). Each row shows the customer, address, HCP number, amount, and a clue chip — {{chip:gray|paid 08/24}} means the money landed then, and the bill usually went out a bit before. Figure out the real date and tap **＋ add date**: type it as six digits (MM/DD/YY — the slashes fill themselves in) and {{button:blue|Save}}; the row clears on the spot. **Open job ›** lands on the job's Bill tab for the ones that need digging. Only bills that still matter appear — history older than the No Count Date is left alone.
- **Dispatch inbox** — field requests, including Turnaway alerts with their {{button:outline-amber|Create trip charge}} button.
- **Schedule** ("Are there any obvious schedule conflicts?") and **Tomorrow's Schedule** ("Who is on what job tomorrow?").
- **Email / Texts / Physical inbox** — communication queues.
- **Prospects**, **Supply Houses**, **Banking sorting**, and more.
- **Unreachable Prospects** — only appears when at least one prospect is flagged can't-reach; at zero it disappears from the page entirely (working the last one out of the list is the goal).
- **My Inbox** — *yours alone*: the same Due Today and Overdue tasks as the Dashboard's My Inbox card, with the same checkboxes, Forward, and mute controls. Because it's personal, it has no shared "Mark up to date" button and its jump chip stays neutral instead of red/yellow/green — it clears itself as you complete tasks, and shows "Nothing in your inbox right now" when you're done.

Devs can reorder sections, hide them, and edit each section's banner prompt — everyone else sees the configured order.

## The habit

The page is built for one pass in the morning and a lighter pass after lunch. If every bar is green by mid-morning, the office is caught up; anything {{button:red|red}} is exactly where to spend attention next.

## Missing job info

The **Missing job info** section lists every job that's missing a **linked customer**, a **customer pictures link**, or (for Ready to Bill jobs) a **billing email** — the same three chips that appear at the top of Jobs → Pipeline. Each row shows the job number, name, customer, and address so you know exactly which job it is. For pictures and email, type the value right in the row and press **Save** (or Enter) — the row disappears once it's fixed. Linking a customer opens Edit Job with one click.
