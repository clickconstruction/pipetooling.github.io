---
title: see everyone's pay setup
category: Billing & Money
roles: dev, master_technician, controller
keywords: pay config, wages, hourly wage, office rate, salary, salaried, record hours, vehicle deal, workday, pay lens, users lens, account lens, training mode, supervision
order: 30
---
Wages, office rates, salary flags and vehicle deals used to live in a pop-up on the Payroll tab; roles, training mode and supervision in Settings. Both are now **lenses** on People → Users: the same roster, grouped the same way, with a different set of columns.

## Switch the lens

Beside the search on People → Users: {{button:outline|Contact}} · {{button:outline|Account}} · {{button:outline|Pay}}. Contact is the row you know. The Pay lens needs pay access; on a phone the roster stays on Contact.

The Payroll tab's {{button:outline|People pay config ↗}} button opens the Pay lens directly, and `/people?tab=users&lens=pay` is the same door.

## The Pay lens

One row per person, every pay-config person included (people without a login stay visible here):

- **Hourly $** and **Office $** — the office rate is optional and greyed out for salaried people; blank means the same as the hourly wage.
- **Salary** — the flat 8-hour weekday day, priced at the hourly wage. A ⏱ beside an unticked box means a workday template still exists for that login; unticking Salary clears it.
- **Rec. hrs** — record real hours alongside the salaried credit.
- **Vehicle** — the deal that decides where fuel and truck cost land on Review.
- {{button:outline|Workday…}} — for a salaried person with a login: the day's start time, split, weekends and today's override.

Edits save on their own after a moment, exactly as the pop-up did.

## The Account lens

Role, last sign-in, **Training** (read-only mode — a dev, a controller or a pay-approved Leader may flip it, never on their own row) and **Supervision** (can run a job / needs supervision), with a **Desk** link for what a row cannot hold: password, name, email, merge, archive.

## Related

- *open a person's desk* — one person, every control.
- *hire someone* — the one form that makes the rows this lens edits.
