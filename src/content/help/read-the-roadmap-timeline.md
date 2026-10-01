---
title: read the roadmap Timeline
category: Office
roles: dev, master_technician, assistant, controller, primary
keywords: roadmap, timeline, gantt, waves, pace, calendar, projection, milestone, front, forecast, finish date
order: 45
---
Roadmap → Timeline draws the roadmap as a Gantt chart, a bar chart of work in order. The roadmap has no dates, so the columns are dependency waves, not months.

You open it from the header under **Roadmap**. A dependency wave is a set of stages you can work at the same time. Everything in the *Now* wave can be worked today. The next wave unlocks when the front clears. And so on to the 🎯 goal.

## How to read it

- **Rows** cascade by wave, then by your stage order. They carry the same number badges as everywhere else.
- **Bar width = remaining work**. Each bar is **one slot per task**, laid end to end in task order. Green slots are done, in their true position. The amber-ringed slot is next up. Outlined slots remain. You hover a slot for the task's name. The done/total count sits next to the stage title.
- **◆ diamonds** are milestone stages. A milestone stage has no tasks of its own. It is reached, not worked. A task-less stage with nothing leading into it is not a milestone yet. It shows a hollow **◇ not planned yet** until you add tasks to it or link a stage into it. It never counts as done on its own.
- The **amber line** is the work front. It shows how far the roadmap has actually moved.
- **Tap a row** to unfold its tasks as a waterfall. Each task sits on its own line with its numbered bar in its slot. The bars step across the stage's span in the order the work will burn down. Titles stretch across the open lane right up to their own bar. Assignees sit in gray beside them. You tap a task's title or bar to open its card.

## The calendar

The band across the top is a real calendar. Months run left to right. An amber **today** tick marks today. A blue runway covers the remaining work. A 🎯 flag sits on the projected finish. There is nothing to set. The finish date comes from your **observed pace**. That is the tasks you actually completed in the last 4 weeks. If the last month was quiet, it uses your all-time average instead. Every task you complete updates the pace and pulls the flag closer for real.

When stages block each other, small dots on the calendar mark when each later wave clears. If the projected finish is more than a year out, the runway runs off the right edge instead. Then the caption leads with what you can act on. It names the tasks left and the pace that **would** land it within the year. The honest far-off date comes after. On a phone the month labels thin out to every second or third month so they stay readable. You hover or long-press a column for its name.

:::example Why the dates say ≈
88 tasks left at your recent pace of 7/week ≈ 13 weeks — so the flag sits in November and reads "≈ Nov". The chart never claims a date you didn't earn; it shows where your real pace is taking you.
:::

## The what-if dial

The **what if** slider next to the calendar lets you dream without lying to yourself. It starts at your real pace. The little amber **▲ you** tick never moves. You drag the slider and it draws a dashed **what-if** line on the calendar next to the solid 🎯 flag. It reads like *at our real pace, ≈ Jul; at 10/week, ≈ Oct*. The gap between the two flags is what the faster pace would actually buy. The dial resets every time you open the page. **clear** snaps it away. Only completing tasks moves the solid flag.

On a brand-new roadmap with no completed tasks yet, there is no real pace to project from. So the dial is all you have. Its dashed flag gives you a first horizon, clearly marked as a what-if.
