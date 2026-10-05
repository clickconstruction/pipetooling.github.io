---
title: see whether the crew was full
category: Office
roles: dev, master_technician, assistant, controller
keywords: capacity, utilization, available hours, field hours, crew, roster, full, busy, room to sell, job summary
order: 42
---

Timeline says thirty-six jobs were running. **Capacity** says whether that was ninety percent of the crew or sixty.

Capacity covers the same weeks and the same window, so the two read together.

## Where it is

You go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Capacity}}. **Worked in** sets the weeks.

## Reading a bar

Each bar is one week:

- The **outline** is available field hours. Available field hours count every leader and helper active on the roster that weekday, at 8 hours each.
- The **filled bar** is approved field hours from the day ledger.
- The number on top is **utilization**: filled ÷ outline. Utilization is the hours worked as a percent of the hours available. {{chip:yellow|under 60%}} reads amber. {{chip:red|over 100%}} reads red.

You hover over a week for the hours, the roster count, and how many people were actually on jobs.

## The tiles

The tiles show these:

- **Utilization** over the window.
- The **peak week**.
- **weeks under 60%**: room to sell.
- **weeks over 100%**: more field hours than the roster's day. The cause is overtime, or people missing from the roster.
- **time off**: the hours that came off the available total for days off recorded on People → Hours. The tile reads *no recorded days off* when nothing came off.
- The **crew now**.

:::example What under 60% for three weeks means
The crew is there and the work isn't. That's a sales signal, not a crew one — and the Ahead view will say whether the backlog covers it.
:::

## Watch-outs

- Recorded time off comes off the available hours. The **Time off** tile and the dashed cap on a bar say how much. Company holidays have no record in the app yet. So a holiday week still reads low.
- Office hours by field people count against capacity, not toward it. A leader's day in the office is a day not on a job.
- Your role may not be able to read the roster. Then the view estimates available hours from the people who clocked in that week. The view says so under the chart. A week nobody worked then reads as no capacity, not as idle capacity.
- Field sessions still awaiting approval aren't counted. You approve them on People → Hours and the bar fills in.
