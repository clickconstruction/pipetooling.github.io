---
title: read the roadmap Timeline
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: roadmap, timeline, gantt, waves, pace, calendar, projection, milestone, front, forecast, finish date
order: 45
---
**Checklist → Roadmap → Timeline** is the roadmap as a Gantt chart — with one honest twist: the roadmap has no dates, so the chart's columns are **dependency waves**, not calendar months. Everything in the *Now* wave can be worked today; the next wave unlocks when the front clears; and so on to the 🎯 goal.

## How to read it

- **Rows** cascade by wave, then your stage order — same number badges as everywhere else.
- **Bar width = remaining work**, and each bar is **one slot per task**, laid end to end in task order: green slots are done (in their true position), the amber-ringed one is next up, outlined ones remain. Hover a slot for the task's name; the done/total count sits next to the stage title.
- **◆ diamonds** are milestone stages (stages with no tasks of their own — they're reached, not worked). A task-less stage with *nothing leading into it* isn't a milestone yet: it shows a hollow **◇ not planned yet** until you add tasks to it or link a stage into it, and it never counts as done on its own.
- The **amber line** is the work front: how far the roadmap has actually moved.
- **Tap a row** to unfold its tasks as a waterfall — each task on its own line with its numbered bar in its slot, stepping across the stage's span in the order the work will burn down. Titles stretch across the open lane right up to their own bar (assignees in gray beside them). Tap a task's title or bar to open its card.

## The calendar

The band across the top is a real calendar: months left to right, an amber **today** tick, a blue runway for the remaining work, and a 🎯 flag on the projected finish. There's nothing to set — the finish date comes from your **observed pace**: tasks you actually completed in the last 4 weeks (or your all-time average if the last month was quiet). Every task you complete updates the pace and pulls the flag closer for real.

When stages block each other, small dots on the calendar mark when each later wave clears. If the projected finish is more than a year out, the runway runs off the right edge instead — and the caption leads with what you can act on (tasks left, and the pace that **would** land it within the year) before the honest far-off date. On a phone the month labels thin out to every second or third month so they stay readable; hover or long-press a column for its name.

:::example Why the dates say ≈
88 tasks left at your recent pace of 7/week ≈ 13 weeks — so the flag sits in November and reads "≈ Nov". The chart never claims a date you didn't earn; it shows where your real pace is taking you.
:::

## The what-if dial

The **what if** slider next to the calendar lets you dream without lying to yourself. It starts at your real pace — the little amber **▲ you** tick never moves — and dragging it draws a dashed **what-if** line on the calendar next to the solid 🎯 flag: "at our real pace, ≈ Jul; at 10/week, ≈ Oct." The gap between the two flags is what the faster pace would actually buy. The dial resets every time you open the page and **clear** snaps it away — only completing tasks moves the solid flag.

On a brand-new roadmap with no completed tasks yet, there's no real pace to project from, so the dial is all you have: its dashed flag gives you a first horizon, clearly marked as a what-if.
