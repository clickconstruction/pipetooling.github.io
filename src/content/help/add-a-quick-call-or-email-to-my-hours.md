---
title: add a quick call or email to my hours
category: Office
roles: assistant, controller, estimator, primary, master_technician, dev
keywords: quick time, quick add, add time, off hours, after hours, phone call, email, text, five minutes, 5 minutes, clock in, without clocking in, hours, office
order: 45
---
A customer calls at 7:40 in the evening. You take it, because nobody pauses a customer to clock in.

Ten minutes later that time is gone unless you remember to add it. **Quick time** is for exactly that. It records a call, an email or a text you handled off the clock. Each add is 5 to 30 minutes.

## Where it is

Look in the clock row on your Dashboard when you are **not** clocked in. The quick clock is the blue square with a **clock and a plus**, right after Clock In. It is the same size as the history clock beside it:

:::example The clock row
{{button:amber|Clock In}} {{button:blue|🕒＋}} {{button:blue|🕒}} {{button:blue|Job Report}}
:::

If you are clocked in, the square is not there. That time is already counting.

## Add it

1. Tap the **clock with a plus**.
2. **How long**: tap {{button:blue|＋5}} once for each five minutes. ＋5, ＋5 is a ten-minute call. Or tap a number on the bar to jump straight to it. Tapping the last lit number takes five back off. The bar stops at 30.
3. **What it was**: pick {{chip:gray|Call}}, {{chip:gray|Email}} or {{chip:gray|Text}} and type a few words. Say who, and what about. *Acme, the Oak St invoice* is plenty.
4. Check the line underneath. It reads ***7:40 – 7:50 pm** today · Office · ended just now*. If you are adding it a while after the fact, tap **just now**. Pick *15 min ago*, *30 min ago*, *1 h ago* or *2 h ago*.
5. The button says the number back to you: {{button:green|Add 10 min}}. Tap it.

It lands on your hours for today like any other entry, on the Office job. It goes to approval the same way.

## What it will not do

- **Overlap hours you already have.** Say the ten minutes would land on top of time you were clocked in. Then it tells you which hours are in the way. Pick a different *ended* time.
- **Reach into another day.** Quick time is for today, or for the last two hours on whichever day they fell. So the call that ran past midnight still goes in at 12:05. The line then says *last night*. For anything older, open the day on **My Time**.
- **Replace the clock.** There is a daily limit, two hours of quick adds out of the box. If you are working a real stretch, clock in. That is what the clock is for.

## Who sees it

Whoever approves your hours sees it marked as a **quick add**, with the words you typed. That is the point of the words. *Call — Acme, the Oak St invoice* approves itself. A blank would not.

You see the same mark on your own day. Open the day on **My Time** and the entry carries the {{chip:purple|quick add}} chip beside its times.

You can fix the words afterwards, but not stretch the entry. To record a longer call, add another one or ask the office.

## Changing who and how much (dev)

Go to **Settings → People & teams → Quick time add**. Tick the roles that get the link under the clock. Out of the box those are assistant, controller, estimator and dev. Primary and master technician can be added for leaders who take after-hours calls. Set the most minutes of quick adds one person can add in a day. Out of the box that is 120. {{button:blue|Save}} applies the next time each person's Dashboard loads. The database checks the same settings when the time is saved, so the link and the refusal always agree. Salaried people and anyone in training mode never get the link, whatever is ticked.
