---
title: see how close the robots are to our numbers
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: robot, twin, scoreboard, shadow, sealed, job type, first drafts, audits, your part, practice, backtest
---
The one sentence: **Bids → 🤖 Robots → Scoreboard shows how close the robots are to our numbers by job type, what is yours to do, and every run they have made — on live bids first, practice on past bids under it.**

## The rule, once

A job type is ready for robot first drafts when the robot lands within **8% of our number five times in a row**. The line under it is the last five scored runs, newest first — green inside 8%, red outside — so you can see at a glance whether they are getting closer.

:::example the top of the page
**How close are the robots?** A job type is ready for robot first drafts when the robot lands within 8% of our number 5 times in a row. None are there yet; 2 are on their way.
Last 5 scored runs, newest first: {{chip:red|+44.2%}} {{chip:green|−7.9%}} {{chip:red|+413.0%}} {{chip:green|−1.2%}} {{chip:green|+5.0%}} · 3 of 5 within 8%
:::

## Your part

The strip under the rule is written for whoever is looking at it, with a door on every line:

- **Sealed numbers on your bids** — the robot locked its price before yours existed. *b385 Galloway Park scores the day you send it. b391 RBFCU Potranco scores once it has a bid value.* {{button:outline-blue|Open b385}}
- **Your bids that are queued** — the robot picks them up in the next weekday batch.
- **Live bids the robots can't see** — usually *no plans link*. The robot needs sheet on that row of the Bid Board says exactly what to attach. {{button:outline-blue|Fix b483}}
- **Audits and questions waiting on anyone** — audits are what hold the robots back most. {{button:blue|Open Audits}}

If none of the bids on the board are yours, the strip shows the office's instead.

## Job types

One row per kind of job — *Vet clinic*, *Fitness club finish-out*, *Oil-change franchise* — ranked closest to ready first. Each row has:

- a state: {{chip:green|Ready for first drafts}} · {{chip:blue|1 of 5 in a row}} · {{chip:gray|Waiting on a score}} · {{chip:yellow|Needs a fix first}}
- the last five scored runs as boxes — **11% low**, **1% low**, a sealed run as **b419 🔒**, empty slots for runs not made yet
- one line on what the robot learned from the last audit and who taught it — *Site/civil is never ours; excluded from counts and named in the letter. After Wendi's audit.* — or what it is waiting on.

## On live bids, then practice

**On live bids** lists every shadow run: the robot's bid number, which of our bids it shadows, and where it stands — *sealed · waiting on you to send b385*, or the score once we sent, *robot $72,854, ours $50,528 · 44% high*. Click the project name to open the five-step story: picked up → estimated blind → 🔒 sealed → we sent → scored. A ✓ means the run counts toward that job type's five in a row.

**Practice on past bids** is the robot re-bidding a decided job blind, then opening the envelope. Six show; {{button:outline-blue|Show all 23 practice runs}} opens the rest. A run that didn't count stays in the list, greyed, with the reason a click away.

## Who counts

A run counts toward readiness only when the robot was scored against a **calibration standard's** number — the estimator the robots are tuned to (the owner picks the standard under Settings → Digital twins). Runs against anyone else's number are shown for comparison and never break a streak.
