---
title: read the Crew P&L tab
category: Billing & Money
roles: dev
keywords: crew pnl, teams, labor cost, billing credit, profit per person, hours weighted, estimated, unmatched, cached figures
order: 32
---
**Jobs → Crew P&L** (formerly "Teams") answers one question per person: *did the work they did bring in more than it cost?*

## The columns

- **Hours** — clocked crew hours (from approved time, split by each day's job assignments) plus their share of sub-sheet labor hours.
- **Labor Cost** — those hours × their wage, plus their share of sub-sheet labor cost (including drive).
- **Billed (gross)** — their credit of the job's gross total bill (what was billed — not cash collected, not revenue before overhead), **weighted by hours**: a job's total is credited as *job total × (their hours on the job ÷ everyone's hours on the job)*. Someone who worked 8 of a job's 10 hours gets 80% of the credit.
- **Profit** — Billed (gross) − Labor Cost, green when positive.
- **$/hr** — Billed (gross) ÷ Hours.

:::example The ≈ marker
A job with revenue but **no clocked crew hours** can't be weighted, so its total is split equally among the job's team members as an **estimate**, marked with **≈** on the row and its drill-down lines. When those guesses make up most of a person's billing, the row carries an {{chip:yellow|≈ estimated}} tag and sorts **below the real rows** in every numeric sort (Profit, $/hr, Hours…), with a divider line at the seam — so the top of the table is always the hours-weighted answer, not an artifact of a job nobody clocked on.
:::

:::example Cached figures
The tab loads the complete job list itself because the page's shared cache leaves out paid jobs. While that loads, a small grey line says the figures come from the page cache; if the load fails, an amber line reads **"Showing cached figures from 3:42 PM — the complete job list didn't load…"** with a {{button:outline|Refresh}} button. Until it clears, paid jobs may be missing and Billed and Profit can read low.
:::

## Date range

Pick a preset (This month, Last month, Quarter, Year) or a custom range. It filters **work dates** — and billing follows the hours, so a window credits the slice of a job's revenue earned by hours worked inside it.

## Drill down

Click any person to expand their per-job lines (hours, labor cost, billing credit); click a job number to open Job Detail. Sub-sheet labor shows as separate lines. Flat-rate sub sheets are weighed as cost ÷ the **Org-wide sub rate** in the toolbar — one number for the whole company. Type a new rate and click {{button:blue|Save for everyone}} (or press Enter); leaving the box empty keeps the current rate, it never resets. People are matched to the roster, so different spellings of the same name land in one row — accents, punctuation, "Garcia, Jose" for "Jose Luis Garcia", or "J. Garcia" all merge when only **one** roster person can match. A small {{chip:yellow|unmatched}} tag means no single roster name fit (two people could match, or it is a lone first name). To merge it, fix the spelling on the sub sheet or session, or add the person under People.

## Not the same as team leads

The {{button:outline|Team leads}} modal on People → Users manages leader/member links. This tab is a per-person profit rollup across jobs.
