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

The left side lists every employee — everyone with a login account plus externally-added roster
people — except subcontractors: they aren't employees, so
they have no employment dates, pay setup, or time off. The list is grouped into **Salaried** and
**Hourly** sections so each pay model is easy to scan. Use the search box to filter by name, and
expand **Archived** at the bottom to see people who no longer appear elsewhere.

Each row shows quick chips about how the person is set up:

- {{chip:blue|Salaried}} — this person is paid a flat salary day (8 hours on weekdays). Inside the
  Salaried group the chip is omitted; instead {{chip:yellow|no workday template}} warns when their
  schedule hasn't been set up yet.
- {{chip:gray|records hours}} — a salaried person who still logs hours for record-keeping.
- {{chip:yellow|Name matches a different login user}} — the roster row is linked to one login
  account, but the person's name matches a different one. Worth fixing, since pay screens match
  people by name.
- {{chip:gray|Linked by name only}} / {{chip:gray|No login user}} — informational: how (or whether)
  this roster row connects to a login account.

## The header: schedule, pay history, and pay totals

With a person selected, the header row offers two buttons and four totals:

- {{button:blue|Schedule}} opens a large month view of their upcoming schedule — dispatch blocks
  and clock sessions day by day, starting today. Use the arrows to page a month back or forward.
  (Disabled for roster rows with no login account — schedules belong to logins.)
- {{button:blue|Pay history}} lists every payment recorded against their pay reports — date,
  amount, and note — newest first over the last 90 days, with a button at the bottom to load 90
  more days at a time. Each payment links to the full **Pay report** it belongs to.
- **Avg** — average paid per week (only weeks that received a payment count), with the matching
  per-year figure underneath.
- **Paid** — everything ever paid to this person.
- **Due** — generated pay reports not yet fully paid (orange when anything is owed).
- **Upcoming** — estimated pay for hours worked since their last pay report.

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

## Pay setup

The **Pay setup** card on each person sets how they're paid. Changes save automatically after a
moment.

- **Hourly wage** — the rate used everywhere, including for salaried people (their pay is this
  rate × 8 hours per weekday).
- **Office wage** — optional second rate for office/bid/unassigned time. Hourly people only; it
  doesn't apply to salaried people.
- **Salaried** — a slider switch to the flat salary day: 8 hours on weekdays, 0 on weekends,
  regardless of clock time. Turning it **off** asks for confirmation first, because it permanently
  deletes the person's workday schedule — turning it back on does not restore the schedule.
- **Record hours anyway** — shown for salaried people only: their logged hours appear on the Hours
  grids for record-keeping, but pay stays on the flat salary day.
- **Include in Hours & crew costing** — show the person on the Hours tab and in crew-costing
  rosters and team labor totals.

:::example Switching someone to salaried
Check {{chip:blue|Salaried}}, then set up their **Salaried workday** card below (start time, one
block or two). Their scheduled sessions start appearing automatically — they no longer clock in
or out.
:::

## Salaried workday schedule

For salaried people, the **Salaried workday** card edits their daily schedule right here — the
same settings as Settings → Salaried workday: continuous or split day, start time, weekends, and
a custom schedule for a single date. If the card says no login user matches the person's name,
fix the roster name or invite them first.

## Recording time off

The **Time off** card lists a person's time off and lets you add or remove ranges (company
calendar dates, inclusive). Time off always clears the person's scheduled salary sessions for
those days.

For **salaried** people you choose the kind:

- {{chip:yellow|Unpaid}} — the days are not paid; they reduce the salaried weekday credit on pay
  reports.
- {{chip:green|Paid}} — the person keeps their pay for those days; they just don't appear on the
  schedule.

Hourly people can have time off recorded too, but it's informational — their pay already follows
the hours they log.

:::example Vacation for a salaried tech
Select the person, add a range for their vacation week, and pick **Paid**. Their calendar shows
the time off, the on-shift strip skips them, and their pay report still credits the full week.
:::

People can also add their own **unpaid** time off from Settings, and the salaried-workdays bulk
modal on the Hours tab still handles marking many people at once.
