---
title: run the office day with Quickfill
category: Office
roles: assistant
keywords: quickfill, daily, mark up to date, office routine, sections
order: 10
---
Quickfill is the office's daily runway: one page of review sections, each with a button that says "I've looked at this." Working top to bottom keeps the whole operation reviewed on a rhythm without anyone keeping a mental checklist.

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

## What's on the page

The sections cover the office's recurring review surfaces — among them:

- **Warnings** and **Office Arriving / Office Leaving** — start and end of day checks.
- **People Hours** and **Unassigned field time** — time approval.
- **Jobs Billing** and **Billing Awaiting Payments** — the billing loop (see the billing guide).
- **Complete, no Total Bill** — jobs marked **100% complete** (latest field report %, or the Edit Job **% complete** field when no report has one) whose **Total Bill** is empty or $0, listed right in the section. Each job shows when work **started**, its **clock sessions** and hours (hover for every work date); {{button:outline-blue|Job Detail}} opens the Job Detail modal, {{button:red|Edit job}} opens Edit Job to set the Job Total, and {{button:outline|Activity ▾}} expands the same activity history you see in Job Detail. Uses the same 100% rule as the Job Summary **%** column and the same minimum-HCP cutoff as Jobs Billing.
- **Dispatch inbox** — field requests, including Turnaway alerts with their {{button:outline-amber|Create trip charge}} button.
- **Schedule** ("Are there any obvious schedule conflicts?") and **Tomorrow's Schedule** ("Who is on what job tomorrow?").
- **Email / Texts / Physical inbox** — communication queues.
- **Prospects**, **Supply Houses**, **Banking sorting**, and more.

Devs can reorder sections, hide them, and edit each section's banner prompt — everyone else sees the configured order.

## The habit

The page is built for one pass in the morning and a lighter pass after lunch. If every bar is green by mid-morning, the office is caught up; anything {{button:red|red}} is exactly where to spend attention next.
