---
title: fix a job's percent done in Quickfill
category: Office
roles: dev, master_technician, assistant
keywords: percent complete, % done, quickfill, stages, paid, ticked, dismiss for one week, pipeline, station
order: 12
---
Quickfill has a station called Percent complete. It lists every open job whose ticked stages or paid money disagree with its % done.

## Why it matters

The Pipeline reports each job's % done. A customer may have paid for a stage while the job still says 0% done. That looks wrong to anyone who reads the row. Only a person can set the right number. This station puts those jobs in one place.

## What the list shows

Each card is one open job. The newest money comes first. The card shows the job's number and name. Tap the name to open its row on the Pipeline. Under it is the stage bar, drawn the same way the Pipeline draws it. A ticked stage is one the customer has paid for.

One sentence says what disagrees.

:::example A card
879 · Hunter Homes, lot 12 · {{chip:yellow|Paid, nothing done}} · 0% done · 40% paid · Rough ✓ · *Rough is ticked and 40% is paid, but the job says 0% done.* · Suggested 40%, the ticked stages' share · **40** % done · {{button:blue|Save 40%}} {{button:outline|Dismiss for one week}}
:::

The station finds four shapes.

- A stage is ticked, or money is paid, and the job says 0% done.
- The ticked stages add up to more than the job says.
- No stage is ticked, but the paid money is well past what the job says.
- The bid is paid in full, but the job says less than 100% done.

A paid deposit does not count as work. A job that has not started does not show here.

## Fixing the number

The box already holds the number the facts suggest. The line under the sentence says where it came from. It is the ticked stages' share, or the paid share when nothing is ticked.

1. Read the sentence and look at the bar.
2. Change the number if the crew says the job is further along or not as far.
3. Press {{button:blue|Save 40%}}.

The job's % done changes right away. A note lands in the job's activity, the same as a change from the Pipeline. The card turns into a green line that says what happened. Press {{button:outline|Undo}} on that line if you saved the wrong number.

## Dismissing a card

Some cards are right as they are. Maybe the crew has not started yet. Press {{button:outline|Dismiss for one week}}. The card hides for seven days. The whole office shares the dismissal. The card turns into a grey line with {{button:outline|Undo}}.

## When a save fails

The card says which job and why. The other cards still work. Fix the reason and try again.

## When the list is empty

The header reads *All agree*. Every open job's % done matches its stages and its money. Press the station's mark button to say you checked.

You can also set a job's % from your dashboard. See [update how done a job is from my dashboard](/help/update-percent-done-from-my-dashboard).
