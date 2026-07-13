---
title: manage employment dates for my team
category: Office
roles: dev, master_technician, assistant
keywords: employment, start date, end date, hire date, salaried, roster, archived, pay
order: 55
---

The **Employment** tab on the People page is one place to see and manage each person's employment
details. Open **People → Employment** (it sits just left of Hours).

## Finding a person

The left side lists everyone on your roster. Use the search box to filter by name, and expand
**Archived** at the bottom to see people who no longer appear elsewhere.

Each row shows quick chips about how the person is set up:

- {{chip:blue|Salaried}} — this person is paid a flat salary day (8 hours on weekdays). If it says
  *no workday template*, their schedule hasn't been set up in Settings yet.
- {{chip:gray|records hours}} — a salaried person who still logs hours for record-keeping.
- {{chip:yellow|Name matches a different login user}} — the roster row is linked to one login
  account, but the person's name matches a different one. Worth fixing, since pay screens match
  people by name.
- {{chip:gray|Linked by name only}} / {{chip:gray|No login user}} — informational: how (or whether)
  this roster row connects to a login account.

## Setting employment dates

1. Select the person on the left.
2. In the **Employment dates** card, set the **Start** date (their first working day) and, when
   someone leaves, the **End** date (their last working day). Both use company calendar dates.
3. Press {{button:blue|Save}}.

Leave the end date empty while the person still works here.

:::example Why dates matter for salaried people
A salaried person is credited 8 hours per weekday on pay reports. Setting the start and end dates
keeps that credit inside their actual employment — someone hired mid-week isn't credited for the
Monday before they started, and someone who left stops accruing days.
:::

## What's coming to this tab

Pay setup (wages and the salary flag), the salaried workday schedule, and paid/unpaid time off are
moving into this tab so everything about a person lives in one place. Until then they remain in
the Hours tab ({{button:outline|Pay config}}) and Settings.
