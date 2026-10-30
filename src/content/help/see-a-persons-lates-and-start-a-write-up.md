---
title: see a person's lates and start a write-up
category: Office
roles: dev, master_technician, assistant, controller
keywords: attendance, late, lates, tardiness, write-up, writeups, no call no show, NCNS, excused, strip, ninety days, clock records, grace
order: 46
---
The Writeups view keeps a person's attendance beside their write-ups. It draws the last ninety days from clock records. You see the days before you start a paper about them.

## Open the card

1. Open **People**, then **Paperwork**, then **Writeups**.
2. Type one person's name in **Subject**.
3. Keep *Show attendance (derived)* on.

The card appears above the list. It reads *Attendance, last 90 days*. Nothing on it is filed. The app works it out from the schedule and the clock.

## Read the chips

The chips at the head of the card are the counts. Hover one for its words.

:::example The head of the card
{{chip:yellow|late 6 · 1 excused}} {{chip:red|NCNS 1}} {{chip:green|on time 52 of 59}}
:::

- **late** counts the unexcused late days. Late means the first clock-in came more than 15 minutes after the earliest block's start. The excused ones sit after the dot.
- **NCNS** counts the no call, no show days the office filed.
- **on time** counts the scheduled days the person clocked in inside the grace.

## Read the strip

Each column is one day. Today is at the right edge, outlined in blue. The last 30 days are shaded. The labels under the strip name the first day, each month's first, the shaded run and today.

- A **ring** is a scheduled day clocked on time.
- An **amber dot** is a late day. A bigger dot means more minutes past the grace.
- A **red diamond** is a no call, no show.
- A **grey slash** is a late day someone excused.
- A **faint ring** is a scheduled day with no clock-in at all.
- An empty column is a day with no block.

A salaried person's strip marks no day late or on time. Their clock sessions are made at schedule time, so the clock cannot show them late. The card says so under the chips.

## Open a day's receipt

Press any marked day. Its receipt opens under the strip.

:::example A late day's receipt
Tue, Oct 27
Block 7:00 AM on J996.
First clock-in 7:35 AM.
20 minutes past the 15-minute grace.
:::

An excused day adds who excused it, when, and the note. A no call, no show adds who filed it and the note. Press the ✕ to close the receipt, or press another day.

## Start a tardiness write-up

Three unexcused lates in the last 30 days show an amber line under the strip. It says how many and offers {{button:outline|Start a tardiness write-up →}}.

Press it. The write-up opens with the person and the tardiness template picked. A context box above the form lists the lates. Each late is one line with its day, its block, its clock-in and its minutes past grace. You write the write-up. The context box is read only.

## Excuse a late

The list under the card has a row for each late day. Press **Add note** on a row to write what happened. The day turns into a grey slash on the strip and leaves the late count. See [schedule people onto jobs](/help/schedule-dispatch#who-came-in-late) for the Late chip on the Schedule board.
