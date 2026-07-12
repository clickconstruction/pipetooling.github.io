---
title: read the Crew P&L tab
category: Billing & Money
roles: dev
keywords: crew pnl, teams, labor cost, billing credit, profit per person, hours weighted
order: 32
---
**Jobs → Crew P&L** (formerly "Teams") answers one question per person: *did the work they did bring in more than it cost?*

## The columns

- **Hours** — clocked crew hours (from approved time, split by each day's job assignments) plus their share of sub-sheet labor hours.
- **Labor Cost** — those hours × their wage, plus their share of sub-sheet labor cost (including drive).
- **Billing** — their credit of job revenue, **weighted by hours**: a job's total is credited as *job total × (their hours on the job ÷ everyone's hours on the job)*. Someone who worked 8 of a job's 10 hours gets 80% of the credit.
- **Profit** — Billing − Labor Cost, green when positive.
- **$/hr** — Billing ÷ Hours.

:::example The ≈ marker
A job with revenue but **no clocked crew hours** can't be weighted, so its total is split equally among the job's team members as an **estimate**, marked with **≈** on the row and its drill-down lines.
:::

## Date range

Pick a preset (This month, Last month, Quarter, Year) or a custom range. It filters **work dates** — and billing follows the hours, so a window credits the slice of a job's revenue earned by hours worked inside it.

## Drill down

Click any person to expand their per-job lines (hours, labor cost, billing credit); click a job number to open Job Detail. Sub-sheet labor shows as separate lines. People are matched to the roster, so different spellings of the same name land in one row — a small **unmatched** tag means the name only exists in free-text fields.

## Not the same as People → Teams

People → Teams manages leader/member team structures. This tab is a per-person profit rollup across jobs.
