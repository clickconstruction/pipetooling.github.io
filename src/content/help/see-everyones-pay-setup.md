---
title: see everyone's pay setup
category: Billing & Money
roles: dev, master_technician, controller
keywords: pay config, wages, hourly wage, office rate, salary, salaried, record hours, vehicle deal, workday, pay lens, users lens, account lens, training mode, supervision
order: 30
---
Wages, office rates, salary flags and vehicle deals used to live in a pop-up on the Payroll tab. Roles, training mode and supervision lived in Settings.

Both are now **lenses** on People → Users. A lens is the same roster, grouped the same way, with a different set of columns.

## Switch the lens

Beside the search on People → Users you find {{button:outline|Contact}}, {{button:outline|Account}} and {{button:outline|Pay}}. Contact is the row you know. The Pay lens needs pay access. On a phone the roster stays on Contact.

The Payroll tab's {{button:outline|People pay config ↗}} button opens the Pay lens directly. The address `/people?tab=users&lens=pay` is the same door.

## The Pay lens

There is one row per person, every pay-config person included. People without a login stay visible here:

- **Hourly $** and **Office $** are the wages. The office rate is optional and greyed out for salaried people. Blank means the same as the hourly wage.
- **Salary** is the flat 8-hour weekday day, priced at the hourly wage. A ⏱ beside an unticked box means a workday template still exists for that login. Unticking Salary clears it.
- **Rec. hrs** records real hours alongside the salaried credit.
- **Vehicle** is the deal that decides where fuel and truck cost land on Review.
- {{button:outline|Workday…}} is for a salaried person with a login. It sets the day's start time, split, weekends and today's override.

Edits save on their own after a moment, exactly as the pop-up did.

## The Account lens

It shows the role, the last sign-in, **Training** and **Supervision**. Training is read-only mode. A dev, a controller or a pay-approved Leader may flip it, never on their own row. Supervision says whether the person can run a job or needs supervision. A **Desk** link covers what a row cannot hold: password, name, email, merge and archive.

## Related

- *open a person's desk* is one person, every control.
- *hire someone* is the one form that makes the rows this lens edits.
