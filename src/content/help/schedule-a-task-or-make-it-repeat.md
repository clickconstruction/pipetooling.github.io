---
title: schedule a task for later or make it repeat
category: Office
roles: all
keywords: checklist, schedule, future task, repeat, weekly, day of week, days after completion, when, add task, remind, reminder, escalate, day before, phone alert, email
order: 41
---
When you add a checklist task, the When choice is right under the people picker. It has three plain options, and a green sentence below tells you exactly what Save will do.

## Today

This is the default. The task lands on the assignee's **Today** list immediately. You leave {{chip:blue|Stays on the list until done}} checked. It then keeps showing until someone completes it. That is almost always what you want.

## On a date

You pick **Do on** and the task appears on that day instead. Until then it waits in Today → **Upcoming**. This is how you schedule something for next week.

On **Manage**, a future-dated task sits in its own **Scheduled** section below the open list. It wears a blue {{chip:blue|starts Mon, Aug 31}} chip instead of the red open clock. "Open" only counts tasks someone can act on today.

### Due by — startable Monday, late after Friday

One-off tasks can also carry an optional **Due by** date. The task lands on the list on its **Do on** day as usual. It shows a calm {{chip:gray|due Fri, Sep 4}} chip through its window. It turns {{chip:yellow|due today}} on the day. It only goes red, {{chip:red|2 days late}}, once the deadline passes. Setting a due date locks **Stays on the list until done** on. A deadline is meaningless for a task that vanishes first. History marks completions that ran past it with *done N days late*.

:::example The sentence tells you
One task on Robert's list from Mon, Aug 31 — due Fri, Sep 4, stays until completed.
:::

Reminders follow the deadline too. Here **remind the day before** fires the day before the due date. And **escalate after N days** now means N days *late*. You leave Due by empty and everything works exactly as it always has.

### Pushed back — the app remembers the original promise

You move a due date later and the task starts carrying its history. A {{chip:yellow|pushed ×2}} chip appears on **Manage**. An amber *"Originally due Fri, Aug 29 — pushed ×2, +5 days so far"* line appears in the edit window. A named entry lands in the task's activity: *Robert pushed the due date Fri, Aug 29 → Mon, Sep 1*. Escalation messages carry the same rider, so a deadline cannot be quietly managed around. Pulling a date **earlier** never earns a marker. Bringing it back to the original clears it.

:::example The sentence tells you
One task on Robert's list on Fri, Aug 28 — stays until completed.
:::

## Repeats

There are two kinds:

- **Weekly on…**: you tap the day pills, M, T, W and so on. You set **Starts** and optionally **Ends**. Each chosen day gets its own occurrence. A missed day does not pile up. Yesterday's copy quietly retires unless someone deliberately reopens it.
- ***— days after it's done***: for chores with a rhythm, like "change the oil 30 days after each time". The next occurrence is scheduled only when the current one is completed. It counts from the day you check it off. Done 5 days late, the next one still lands a full 30 days out.

Repeating tasks stay stocked about five weeks ahead automatically. They keep going until their end date. You set one, or they run forever.

To see every repeating task in one place, you open **Manage** and tap the {{chip:blue|↻ Repeating}} pill. Each row shows its schedule and a green chip with its next occurrence.

## Notifications

**When it's done, notify** is one line. You check **Me** to hear when it is completed. You add one more person with the picker. Reminders at a set time of day live under **Advanced**.

## Remind

Below the notify options, the **Remind** row sets a nudge time. You pick {{chip:blue|Morning 7:00}}, {{chip:gray|Midday 12:00}}, {{chip:gray|End of day 4:00}}, or **Custom…** for any time. You pick one and three plain choices unfold:

- **Keep reminding every day until it's done** is on by default. You uncheck it and the reminder fires only on the due date itself.
- **Also remind the day before it's due** is a heads-up the afternoon before. It shows only when the task is due later than today.
- ***Still not done after — days? Remind me too*** means after that many overdue days, the daily reminder starts copying *you*, the task's creator.

Reminders arrive as one grouped phone alert per person, never one buzz per task. If someone has no phone alerts set up, the reminder goes to their **email** instead. The modal shows how each assignee will be reached. A green sentence restates the whole plan.

:::example The sentence tells you
Reminds Michael A & Bryan every day at 7:00 AM until it's done — and you after 3 days.
:::

## Peek at the checklist without losing your draft

You tap the small checklist icon in the top-right corner of the Add-task window. It brings up the Checklist page **behind** the window. The window stays open and everything you have typed stays put. You use it to check whether the task already exists, then keep typing. If you hit it by accident, nothing is lost.

### See dated tasks on a calendar

**Manage → {{chip:blue|📅 Timeline}}** lays every one-off with a due date on a real calendar. The solid bar runs from **Do on** to **Due by**. It turns green once done, and is kept for two weeks as recent history. The red line is today, and weekends are shaded. Where a task was pushed, a hollow amber ○ marks the **original promise**. It never moves. A hatched trail stretches to the current due date, with a *→ pushed ×2 · +5d* badge. You tap a row to open the task.
