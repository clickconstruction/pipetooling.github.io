---
title: catch up on payroll weeks that never got a report
category: Office
roles: dev, controller
keywords: payroll, draft payroll, unreported, pay report, catch up, missed week, earlier weeks
order: 59
---
Draft Payroll shows one week at a time, and the Pay run table only lists reports that exist. The catch-up scan finds the weeks where someone worked but nobody made a report.

Before the scan, a week like that was invisible.

## Finding unreported weeks

Open **Payroll → Draft Payroll**. Next to Print you'll see one of two buttons:

- {{chip:yellow|⏳ Earlier unreported: 4}} means the scan found earlier weeks with hours and no report. Tap it.
- {{button:outline|Earlier weeks ✓}} means the last 8 weeks are clean. You can still tap it and scan further back.

The scan checks the 8 weeks before your current period. **Scan 8 more weeks** at the bottom keeps going back.

## Working the list

Each row is one person and one week, newest first. It shows their hours and estimated cash due:

:::example An unreported week
Zach W · Apr 26 – May 2 (W18) · 42.76 hours · $641.39
:::

- {{button:blue|Report}} generates the pay report for that week right there. The row stays put. It flips to {{button:gray|View}} and {{button:green|Record payment}} so you can pay it in the same sitting.
- **Open week** points Draft Payroll at that week instead. Use it when you want the full pre-flight first. The pre-flight is the pending clock-session approvals, the days needing the Correct mark, and the print view.

Estimates use each person's current pay config. The generated report is the authoritative number. That is exactly like the Cash Due preview on the current week.

## Sizing up what is still upcoming

The header on **Payroll → Pay run** carries an amber {{chip:yellow|29 upcoming: $19,743.79}} link. It counts every week with clocked time and no pay report yet. Each week is estimated at hours times wage. Tap it to open the list.

:::example The upcoming list, one chip per person
Malachi $6,699.89 3w · Abraham $2,521.67 2w · Michael A $2,298.83 3w · … · William $7.46 2w
:::

- **The chips at the top** are one per person. Each shows their estimated gross, the pay before anything comes off, and how many weeks are waiting. Tap a chip to leave that person out of the estimate. The chip goes dashed and their rows are struck through. The header reads "1 excluded, −$6,699.89". Tap again to put them back, or use **Include everyone**. This is a what-if for sizing the week. It changes nothing on the ledger and resets when you close.
- **The ▾ on a chip** jumps to that person's weeks in the table.
- **Sort** by {{button:blue|Amount}}, {{button:outline|Name}} or {{button:outline|Hours}}. Use the chooser or click a column header. Click the same choice again to reverse it. People move together. A person's weeks always stay under their name.
- **The table groups by person.** Each person has a subtotal row. Click it to fold their weeks away. **Collapse all** leaves one line per person. The checkbox on the row is the same switch as the chip. The period link on any week still opens that week's days, where you can approve sessions.
