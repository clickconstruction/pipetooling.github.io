---
title: read the Crew P&L tab
category: Billing & Money
roles: dev
keywords: crew pnl, teams, labor cost, billing credit, profit per person, hours weighted, estimated, unmatched, cached figures
order: 32
---
The Crew P&L tab answers one question per person. Did the work they did bring in more than it cost?

You open it at **Jobs → Crew P&L**. P&L means profit and loss. The tab was formerly called "Teams".

## The columns

- **Hours** is clocked crew hours plus their share of sub-sheet labor hours. A sub sheet is a subcontractor's labor sheet. Clocked hours come from approved time. They are split by each day's job assignments.
- **Labor Cost** is those hours × their wage. It adds their share of sub-sheet labor cost, including drive.
- *Billed (gross)* is their credit of the job's gross total bill. That is what was billed. It is not cash collected, and not revenue before overhead. The credit is **weighted by hours**. A job's total is credited as the job total × their share of the hours. Their share is their hours on the job ÷ everyone's hours on the job. Someone who worked 8 of a job's 10 hours gets 80% of the credit.
- **Profit** is *Billed (gross)* − Labor Cost. It is green when positive.
- **$/hr** is *Billed (gross)* ÷ Hours.

:::example The ≈ marker
A job with revenue but **no clocked crew hours** can't be weighted, so its total is split equally among the job's team members as an **estimate**, marked with **≈** on the row and its drill-down lines. When those guesses make up most of a person's billing, the row carries an {{chip:yellow|≈ estimated}} tag and sorts **below the real rows** in every numeric sort (Profit, $/hr, Hours…), with a divider line at the seam — so the top of the table is always the hours-weighted answer, not an artifact of a job nobody clocked on.
:::

:::example Cached figures
The tab loads the complete job list itself because the page's shared cache leaves out paid jobs. While that loads, a small grey line says the figures come from the page cache; if the load fails, an amber line reads **"Showing cached figures from 3:42 PM — the complete job list didn't load…"** with a {{button:outline|Refresh}} button. Until it clears, paid jobs may be missing and Billed and Profit can read low.
:::

:::example Why office and admin rows read negative
Office hours, bid hours and the Office job carry real **Labor Cost** but bill nobody, so their **Billed (gross)** is $0 and **Profit** is minus their wages — by construction. A negative office row is the cost of running the office, not a job that lost money; look for the field rows above it.
:::

## Date range

You pick a preset or a custom range. The presets are This month, Last month, Quarter and Year. The range filters **work dates**. Billing follows the hours. So a window credits the slice of a job's revenue earned by hours worked inside it.

## Drill down

Click any person to expand their per-job lines. Each line shows hours, labor cost and billing credit. Click a job number to open Job Detail. Sub-sheet labor shows as separate lines. Flat-rate sub sheets are weighed as cost ÷ the **Org-wide sub rate** in the toolbar. That rate is one number for the whole company. Type a new rate and click {{button:blue|Save for everyone}}, or press Enter. Leaving the box empty keeps the current rate. It never resets. People are matched to the roster. So different spellings of the same name land in one row. Accents, punctuation, "Garcia, Jose" for "Jose Luis Garcia" or "J. Garcia" all merge. They merge only when just **one** roster person can match. A small {{chip:yellow|unmatched}} tag means no single roster name fit. Two people could match, or it is a lone first name. To merge it, fix the spelling on the sub sheet or session. Or add the person under People.

## Not the same as supervision

Who supervised whom is read off the schedule and the clock. That lives in People → Who's where, and in each person's *needs supervision* switch. This tab is a per-person profit rollup across jobs.
