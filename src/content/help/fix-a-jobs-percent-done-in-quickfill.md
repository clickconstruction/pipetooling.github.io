---
title: fix a job's percent done in Quickfill
category: Office
roles: dev, master_technician, assistant
keywords: percent complete, % done, quickfill, stages, paid, ticked, dismiss for one week, pipeline, station, slider, knob, drag
order: 12
---
Quickfill has a station called Percent complete. It lists every open job whose ticked stages or paid money disagree with its % done.

## Why it matters

The Pipeline reports each job's % done. A customer may have paid for a stage while the job still says 0% done. That looks wrong to anyone who reads the row. Only a person can set the right number. This station puts those jobs in one place.

## What the list shows

Each card is one open job. The newest money comes first. The card shows the job's number and name. Tap the name to open its row on the Pipeline. Under it is the stage bar, drawn the same way the Pipeline draws it. A ticked stage is one the customer has paid for. The dark tick on the bar is where the job stands today. The blue knob is the number you are about to save.

One sentence says what disagrees.

:::example A card
1203 · Ridgeway Builders, lot 7 · {{chip:yellow|Paid, nothing done}} · the stage bar, a dark tick at 0 and a blue knob at 40 · 0% done · 40% paid · Rough ✓ · *Rough is ticked and 40% is paid, but the job says 0% done.* · Suggested 40%, the ticked stages' share · {{chip:blue|Rough ✓ 40%}} {{chip:gray|Top Out 75%}} {{chip:gray|Trim 100%}} · *0% → 40% ▲ 40* · **40** % done · {{button:blue|Save 40%}} {{button:outline|Dismiss for one week}}
:::

The station finds four shapes.

- A stage is ticked, or money is paid, and the job says 0% done.
- The ticked stages add up to more than the job says.
- No stage is ticked, but the paid money is well past what the job says.
- The bid is paid in full, but the job says less than 100% done.

A paid deposit does not count as work. A job that has not started does not show here.

## Fixing the number

The knob starts on the number the facts suggest. The line under the sentence says where it came from. It is the ticked stages' share, or the paid share when nothing is ticked.

You have three ways to move the number.

- Drag the blue knob along the bar. You can also tap anywhere on the bar to jump there. The box follows. Let go near a small mark under the bar and the knob lands on that stage's end.
- Press a stage chip under the bar, like {{chip:gray|Top Out 75%}}. The knob jumps to the end of that stage. The paid share has a chip too when it is not a stage end.
- Type a number in the box. The knob follows.

On a keyboard, tab to the knob and press the arrow keys. Shift with an arrow moves ten. Home and End go to the ends.

The line beside the box reads the move, like *0% → 57% ▲ 57*. The Save button names the number, like {{button:blue|Save 57%}}. When the knob sits where the job already is, the line reads *no change* and Save is grey.

1. Read the sentence and look at the bar.
2. Drag the knob, press a chip, or type a number.
3. Press {{button:blue|Save 57%}}.

The job's % done changes right away. A note lands in the job's activity, the same as a change from the Pipeline. The card turns into a green line that says what happened. Press {{button:outline|Undo}} on that line if you saved the wrong number.

## Dismissing a card

Some cards are right as they are. Maybe the crew has not started yet. Press {{button:outline|Dismiss for one week}}. The card hides for seven days. The whole office shares the dismissal. The card turns into a grey line with {{button:outline|Undo}}.

## When a save fails

The card says which job and why. The other cards still work. Fix the reason and try again.

## When the list is empty

The header reads *All agree*. Every open job's % done matches its stages and its money. Press the station's mark button to say you checked.

You can also set a job's % from your dashboard. See [update how done a job is from my dashboard](/help/update-percent-done-from-my-dashboard).
