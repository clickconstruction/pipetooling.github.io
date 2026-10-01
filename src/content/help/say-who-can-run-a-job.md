---
title: say who can run a job on their own
category: Office
roles: dev, master_technician, assistant
keywords: supervision, needs supervision, can run a job, helper, subcontractor, coverage, unsupervised, crew, team leads, who's where
order: 89
---
Every helper and every subcontractor, an outside crew you hire, starts out needing supervision. They are not left to run a job on their own.

When the office decides someone can, you flip the switch. That one switch is the whole org chart for hourly, per-job work. **A job is covered on a day when at least one person on it does not need supervision.** Masters never need it, so a master on the job always covers it.

## Flip the switch

- **Settings → Active accounts**: every helper and sub row has a checkbox under their last login, *Needs supervision*. You untick it and the label reads *Can run a job*.
- **People → Users**: you open the ⋯ menu on a helper or sub and choose *Can run a job*. You choose *Needs supervision* to put it back. The row shows a small chip with the current state.

Only a dev, a master or an assistant can flip it, and never on their own account. New helper and sub accounts start with it on.

## What changes when someone can run a job

- **Who's where** marks their head {{chip:green|SUP}} on every crew and island they are on. A crew or a job with nobody like that reads **unsupervised**. The week strip counts unsupervised job-days, which is the number to watch.
- They count as the job's supervisor for that day. Their Dashboard grows a **My crew** section. It lists the reports owed for the job-days they supervised, with a *Write it* button. It also shows their crew's hours read-only. See *supervise a crew*. Once a month, *Rate my crew* deals them a card per person they supervised. There is nothing to assign.
- **Schedule dispatch** puts an amber *unsupervised* pill on a block whose people all need supervision. It says so while you build the block. It never refuses. You add a master or someone who can run a job as a linked copy. Or you keep it if you know better.

:::example A job-day, three ways
**Malachi + Isiah + Kyle** — covered: Malachi is a master.
**Tristen + Kyle** — covered once Tristen's switch is off; unsupervised while it is on.
**Kevin + Ray**, both needing supervision — unsupervised. Put a master or a qualified helper on the block.
:::

## Why there is no leader list

The Team leads list is retired as of v2.3616. There someone named a leader and their members by hand. It went stale. The switch replaces it. Who supervises whom on any day is simply who was on the job and could run it. That is read off the schedule and the clock. Nothing is assigned and nothing needs maintaining.
