---
title: run the pay week from Hours to Tally
category: Office
roles: dev, master_technician, controller
keywords: pay week, payroll, hours, approve, draft payroll, generate, pay reports, pay run, week band, tally, mark payroll, checklist, next step, weekly
order: 62
---

The pay week is three stops on three surfaces. Each stop now points at the next one, so you can run the whole thing without remembering the order.

## 1. Approve the hours

**People → Hours.** Approve the week's sessions — from the grid cells, the {{button:outline|Hours approvals}} queue, or {{button:green|Approve all}} on a pending week. Unapproved time is missing from payroll, the Hours grid and the Overhead numbers, so this comes first.

As soon as something is approved, a green chip appears at the top of the Hours tab:

:::example After approving
{{chip:green|6 sessions approved}} &nbsp; **Draft payroll for Aug 24 – 30 →** &nbsp; ×
:::

Tap the link and you land on the next stop with the pay week already selected. The chip clears when you open Draft Payroll or dismiss it. (Assistants approve hours too but don't see the chip — the next stop is pay data.)

## 2. Generate the pay reports

**People → Pay Stubs → Draft Payroll.** The period is the last complete Sun–Sat pay week. {{button:blue|Generate Remaining}} makes a report for everyone with hours and no report yet; you can also generate one person at a time.

When every person with hours has a report, a green line appears under the buttons:

:::example After generating
Every report for this period is generated. Next: mark the payroll transactions on Tally so they resolve without touching job spend. &nbsp; **Open Tally →**
:::

## 3. Mark the payroll transactions

**Job Parts Tally → Transactions.** The payroll run shows up as a bank transaction like any other purchase. On each one with no jobs assigned, press {{button:outline|Mark payroll}} and confirm — it resolves without a job split, so job spend isn't double-counted. Anyone with payroll access can do this (dev, controller, a pay-approved leader); the auto-mark **rules** stay a dev tool. See [mark payroll transactions in the tally](?g=tally-payroll-marking).

## Reading the Pay run table

**People → Pay → Payroll → Pay run** lists every generated report, newest first. A tinted band opens each week so you can see where one week's reports end and the next begin, and it adds the week up for you:

:::example A week band
**7/26–8/1** `w31` · 5 reports · **181.20 h** · **$4,295.83** gross · 4 open
:::

- The band names the period and its week number, then the run's report count, hours, gross pay, and how many of those reports are still open (unpaid or partial).
- Bands follow the rows as they sit: {{chip:gray|Open}}, {{chip:gray|Paid}} and {{chip:gray|All}} each band their own rows, and a name search leaves one band per week that person was paid in.
- A report generated late for an earlier week sits where it was created and opens its own band for that week — the table never re-sorts your history.

## If a stop doesn't offer the next

- No chip after approving: the chip shows only for people with pay access, and only on the Hours tab of People. Approvals from the Dashboard's My Team section don't raise it — open Hours and it will be there after the next approval.
- No green line on Draft Payroll: someone with hours still has no report. The grey line above the table says who.
- No **Mark payroll** on a transaction: it already has job splits. Remove them first, or leave it — a transaction split to jobs is not payroll.
