---
title: export a license hours log for the plumbing or electrical board
category: Office
roles: dev, master_technician, assistant, controller
keywords: license, hours log, apprentice, journeyman, tradesman, board, TSBPE, TDLR, CSV, export, experience
---
When a helper is working toward a more advanced license, the plumbing or electrical board wants proof of the hours they've worked — in Texas that's the employer certification of experience the supervising licensee signs. The **Hours log** gives you the detail behind that certification: every job the person worked, with approved clock hours, ready to download as a CSV.

## Opening the hours log

Go to **People → Licenses** and click the person's row to expand it. Two buttons appear:

:::example Expanded person row
{{button:outline|Hours log}} {{button:primary|+ Add license}}
:::

Click {{button:outline|Hours log}}. The modal shows every **approved** clock session the person has, grouped by job and week:

- A summary line up top — total hours, how many jobs, first and last work date.
- One section per job: job number, name, address, and service type, with a row per week showing sessions and hours.
- Hours that weren't clocked to a job show up separately as **Estimating (bid work)** or **Unassigned / office**, so the log always reconciles against payroll hours.

Only approved, clocked-out sessions count — the same rule as every other hours surface in the app. Wages never appear here.

## Filling in the certification header

The fields above the table are printed at the top of the CSV so the export reads like a board submission:

- **Registration / license #** — the person's apprentice or tradesman registration number.
- **Employer** — your company name. Remembered on this device for the next export.
- **Supervising licensee** — the responsible master's name and license number. Also remembered.
- **From / To** — leave blank for all recorded time, or narrow to the period the board asks about.

## Downloading the CSV

Click {{button:primary|Export CSV}}. The file starts with the certification block (employee, registration number, employer, supervising licensee, period, total hours), then one row per job per week:

:::example CSV detail columns
Week start · Week end · Job # · Job name · Job address · Service type · Sessions · Hours
:::

A final **Total** row repeats the session count and total hours so the detail provably adds up. Attach the file to the board's employer certification form, or keep it on file in case the board asks for backup.

## Who can use this

Devs, assistants, controllers, and Pay-Approved masters — the same people who can see the Licenses tab. If a person shows "no linked app account," their hours were never clocked in the app under their own login; link the roster person to a user account first.
