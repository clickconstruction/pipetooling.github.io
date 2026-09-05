---
title: see whether the crew was full
category: Office
roles: dev, master_technician, assistant, controller
keywords: capacity, utilization, available hours, field hours, crew, roster, full, busy, room to sell, job summary
order: 42
---

Timeline says thirty-six jobs were running. **Capacity** says whether that was ninety percent of the crew or sixty — the same weeks, the same window, read together.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Capacity}}. **Worked in** sets the weeks.

## Reading a bar

Each bar is one week:

- the **outline** is available field hours — every master technician and helper active on the roster that weekday, at 8 hours each
- the **filled bar** is approved field hours from the day ledger
- the number on top is **utilization**, filled ÷ outline; {{chip:yellow|under 60%}} reads amber, {{chip:red|over 100%}} reads red

Hover a week for the hours, the roster count, and how many people were actually on jobs.

## The tiles

**Utilization** over the window, the **peak week**, **weeks under 60%** (room to sell), **weeks over 100%** (more field hours than the roster's day — overtime, or people missing from the roster), and the **crew now**.

:::example What under 60% for three weeks means
The crew is there and the work isn't. That's a sales signal, not a crew one — and the Ahead view will say whether the backlog covers it.
:::

## Watch-outs

- PTO and holidays aren't subtracted yet, so a holiday week reads low.
- Office hours by field people count against capacity, not toward it — a master's day in the office is a day not on a job.
- If your role can't read the roster, the view estimates available hours from the people who clocked in that week and says so under the chart. A week nobody worked then reads as no capacity, not as idle capacity.
- Field sessions still awaiting approval aren't counted. Approve them on People → Hours and the bar fills in.
