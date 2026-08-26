---
title: schedule a task for later or make it repeat
category: Office
roles: all
keywords: checklist, schedule, future task, repeat, weekly, day of week, days after completion, when, add task, remind, reminder, escalate, day before, phone alert, email
order: 41
---
When you add a checklist task, the **When** choice is right under the people picker — three plain options, and a green sentence below always tells you exactly what Save will do.

## Today

The default. The task lands on the assignee's **Today** list immediately. Leave {{chip:blue|Stays on the list until done}} checked and it keeps showing until someone completes it (that's almost always what you want).

## On a date

Pick **Do on** and the task appears on that day instead — until then it waits in Today → **Upcoming**. This is how you schedule something for next week.

On **Manage**, a future-dated task sits in its own **Scheduled** section below the open list, wearing a blue {{chip:blue|starts Mon, Aug 31}} chip instead of the red open clock — "open" only counts tasks someone can act on today.

### Due by — startable Monday, late after Friday

One-off tasks can also carry an optional **Due by** date. The task lands on the list on its **Do on** day as usual, shows a calm {{chip:gray|due Fri, Sep 4}} chip through its window, turns {{chip:yellow|due today}} on the day, and only goes red — {{chip:red|2 days late}} — once the deadline passes. Setting a due date locks **Stays on the list until done** on (a deadline is meaningless for a task that vanishes first), and History marks completions that ran past it with *done N days late*.

:::example The sentence tells you
One task on Robert's list from Mon, Aug 31 — due Fri, Sep 4, stays until completed.
:::

Reminders follow the deadline too: **remind the day before** fires the day before the due date, and **escalate after N days** now means N days *late*. Leave Due by empty and everything works exactly as it always has.

### Pushed back — the app remembers the original promise

Move a due date later and the task starts carrying its history: a {{chip:yellow|pushed ×2}} chip on **Manage**, an amber *"Originally due Fri, Aug 29 — pushed ×2, +5 days so far"* line in the edit window, and a named entry in the task's activity — *Robert pushed the due date Fri, Aug 29 → Mon, Sep 1*. Escalation messages carry the same rider, so a deadline can't be quietly managed around. Pulling a date **earlier** never earns a marker, and bringing it back to the original clears it.

:::example The sentence tells you
One task on Robert's list on Fri, Aug 28 — stays until completed.
:::

## Repeats

Two kinds:

- **Weekly on…** — tap the day pills (M, T, W…), set **Starts**, optionally **Ends**. Each chosen day gets its own occurrence. A missed day doesn't pile up — yesterday's copy quietly retires unless someone deliberately reopens it.
- **— days after it's done** — for chores with a rhythm ("change the oil 30 days after each time"). The next occurrence is scheduled only when the current one is completed.

Repeating tasks stay stocked about five weeks ahead automatically and keep going until their end date — set one, or they run forever.

To see every repeating task in one place, open **Manage** and tap the {{chip:blue|↻ Repeating}} pill — each row shows its schedule and a green chip with its next occurrence.

## Notifications

**When it's done, notify** is one line: check **Me** to hear when it's completed, and add one more person with the picker. Reminders at a set time of day live under **Advanced**.

## Remind

Below the notify options, the **Remind** row sets a nudge time: {{chip:blue|Morning 7:00}}, {{chip:gray|Midday 12:00}}, {{chip:gray|End of day 4:00}}, or **Custom…** for any time. Pick one and three plain choices unfold:

- **Keep reminding every day until it's done** — on by default. Uncheck it and the reminder fires only on the due date itself.
- **Also remind the day before it's due** — a heads-up the afternoon before (shows only when the task is due later than today).
- **Still not done after — days? Remind me too** — after that many overdue days, the daily reminder starts copying *you*, the task's creator.

Reminders arrive as one grouped phone alert per person (never one buzz per task). If someone has no phone alerts set up, the reminder goes to their **email** instead — the modal shows how each assignee will be reached, and a green sentence restates the whole plan.

:::example The sentence tells you
Reminds Michael A & Bryan every day at 7:00 AM until it's done — and you after 3 days.
:::

## Peek at the checklist without losing your draft

The small checklist icon in the top-right corner of the Add-task window brings up the Checklist page **behind** the window — the window stays open and everything you've typed stays put. Use it to check whether the task already exists, then keep typing; and if you hit it by accident, nothing is lost.