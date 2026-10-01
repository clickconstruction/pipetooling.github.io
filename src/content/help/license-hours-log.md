---
title: export a license hours log for the plumbing or electrical board
category: Office
roles: dev, master_technician, assistant, controller
keywords: license, hours log, apprentice, journeyman, tradesman, board, TSBPE, TDLR, CSV, export, experience
order: 58
---
When a helper works toward a more advanced license, the board wants proof of the hours they worked. The Hours log gives you that detail, ready to download as a CSV.

In Texas that proof is the employer certification of experience. The supervising licensee signs it. The **Hours log** shows every job the person worked, with approved clock hours. A CSV is a plain spreadsheet file.

## Opening the hours log

Go to **People → Licenses**. Click the person's row to expand it. Two buttons appear:

:::example Expanded person row
{{button:outline|Hours log}} {{button:blue|+ Add license}}
:::

Click {{button:outline|Hours log}}. A modal opens, a window over the page. It shows every **approved** clock session the person has, grouped by job and week:

- A summary line up top. It shows total hours, how many jobs, and the first and last work date.
- One section per job. It shows the job number, name, address and service type. Each week gets a row showing sessions and hours.
- Hours that were not clocked to a job show up separately. They appear as ***Estimating (bid work)*** or **Unassigned / office**. So the log always reconciles against payroll hours.

Only approved, clocked-out sessions count. That is the same rule as every other hours surface in the app. Wages never appear here.

## Filling in the certification header

The fields above the table print at the top of the CSV. So the export reads like a board submission:

- **Registration / license #**: the person's apprentice or tradesman registration number.
- **Employer**: your company name. It is remembered on this device for the next export.
- **Supervising licensee**: the responsible leader's name and license number. This is also remembered.
- **From / To**: leave blank for all recorded time. Or narrow to the period the board asks about.

## Downloading the CSV

Click {{button:blue|Export CSV}}. The file starts with the certification block. That block holds the employee, registration number, employer, supervising licensee, period and total hours. Then comes one row per job per week:

:::example CSV detail columns
Week start · Week end · Job # · Job name · Job address · Service type · Sessions · Hours
:::

A final **Total** row repeats the session count and total hours. So the detail provably adds up. Attach the file to the board's employer certification form. Or keep it on file in case the board asks for backup.

## Who can use this

Devs, assistants, controllers and Pay-Approved leaders can use this. They are the same people who can see the Licenses tab. If a person shows *no linked app account*, their hours were never clocked in the app under their own login. Link the roster person to a user account first.
