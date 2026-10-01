---
title: manage employment dates for my team
category: Office
roles: dev, master_technician, assistant
keywords: employment, start date, end date, hire date, salaried, roster, archived, pay
order: 55
---

The Employment tab on the People page is one place to see and manage each person's employment details. Open People → Pay → Employment to find it.

**Employment** is a view in the Pay row, beside Hours and Payroll.

## Finding a person

The left side lists every employee. That is everyone with a login account plus externally-added roster people. Subcontractors are left out. They are not employees, so they have no employment dates, pay setup, or time off. The list is grouped into **Salaried** and **Hourly** sections so each pay model is easy to scan. Use the search box to filter by name. Expand **Archived** at the bottom to see people who no longer appear elsewhere.

Each row shows quick chips about how the person is set up:

- {{chip:blue|Salaried}}: this person is paid a flat salary day. That is 8 hours on weekdays. Inside the Salaried group the chip is omitted. Instead {{chip:yellow|no workday template}} warns when their schedule has not been set up yet.
- {{chip:gray|records hours}}: a salaried person who still logs hours for record-keeping.
- {{chip:yellow|Name matches a different login user}}: the roster row is linked to one login account. But the person's name matches a different one. It is worth fixing, since pay screens match people by name.
- {{chip:gray|Linked by name only}} or {{chip:gray|No login user}}: informational. They say how, or whether, this roster row connects to a login account.

## The header: schedule, pay history, and pay totals

With a person selected, the header row offers two buttons and four totals:

- {{button:blue|Schedule}} opens a large month view of their upcoming schedule. It shows dispatch blocks and clock sessions day by day, starting today. Use the arrows to page a month back or forward. It is disabled for roster rows with no login account, since schedules belong to logins.
- {{button:blue|Pay history}} lists every payment recorded against their pay reports. Each shows date, amount and note. Newest come first, over the last 90 days. A button at the bottom loads 90 more days at a time. Each payment links to the full **Pay report** it belongs to.
- **Avg**: average paid per week. Only weeks that received a payment count. The matching per-year figure sits underneath.
- **Paid**: everything ever paid to this person.
- **Due**: generated pay reports not yet fully paid. It turns orange when anything is owed.
- **Upcoming**: estimated pay for hours worked since their last pay report.

## Setting employment dates

1. Select the person on the left.
2. In the **Employment dates** card, set the **Start** date. That is their first working day. When someone leaves, set the **End** date. That is their last working day. Both use company calendar dates.
3. Press {{button:blue|Save}}.

Leave the end date empty while the person still works here.

:::example Why dates matter for salaried people
A salaried person is credited 8 hours per weekday on pay reports. Setting the start and end dates
keeps that credit inside their actual employment — someone hired mid-week isn't credited for the
Monday before they started, and someone who left stops accruing days.
:::

## Pay setup

The **Pay setup** card on each person sets how they're paid. Changes save automatically after a moment.

- **Hourly wage**: the rate used everywhere, including for salaried people. Their pay is this rate × 8 hours per weekday.
- **Office wage**: an optional second rate for office, bid or unassigned time. Hourly people only. It does not apply to salaried people.
- **Salaried**: a slider switch to the flat salary day. That is 8 hours on weekdays and 0 on weekends, regardless of clock time. Turning it **off** asks for confirmation first, because it permanently deletes the person's workday schedule. Turning it back on does not restore the schedule.
- **Record hours anyway**: shown for salaried people only. Their logged hours appear on the Hours grids for record-keeping. But pay stays on the flat salary day.

:::example Switching someone to salaried
Check {{chip:blue|Salaried}}, then set up their **Salaried workday** card below (start time, one
block or two). Their scheduled sessions start appearing automatically — they no longer clock in
or out.
:::

## Salaried workday schedule

For salaried people, the **Salaried workday** card edits their daily schedule right here. It has the same settings as Settings → Salaried workday. Those are a continuous or split day, start time, weekends, and a custom schedule for a single date. If the card says no login user matches the person's name, fix the roster name or invite them first.

## Recording time off

The **Time off** card lists a person's time off. It lets you add or remove ranges. Ranges use company calendar dates, inclusive. Time off always clears the person's scheduled salary sessions for those days.

For **salaried** people you choose the kind:

- {{chip:yellow|Unpaid}}: the days are not paid. They reduce the salaried weekday credit on pay reports.
- {{chip:green|Paid}}: the person keeps their pay for those days. They just do not appear on the schedule.

Hourly people can have time off recorded too. But it is informational. Their pay already follows the hours they log.

:::example Vacation for a salaried tech
Select the person, add a range for their vacation week, and pick **Paid**. Their calendar shows
the time off, the on-shift strip skips them, and their pay report still credits the full week.
:::

People can also add their own **unpaid** time off from Settings. The salaried-workdays bulk modal on the Hours tab still handles marking many people at once.
