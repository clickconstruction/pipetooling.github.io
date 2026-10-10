---
title: move a bar on the schedule and say why
category: Bids & Estimating
roles: dev
keywords: gc mode, schedule, gantt, chart, move, bar, drag, why it moved, reason, link, push, undo, redo, the schedule changed, form, not before, must finish by, gap, real days, part, split, place, where the work is
order: 104
---
Each GC project has a schedule. You move a bar by dragging it on the chart, or by changing it in its form. The app asks why it moved before it saves. Every move stays on the schedule's record with who made it and why.

Only devs can move a bar for now. The rest of the office gets the Schedule window later.

## Open the schedule

1. Open [GC projects](/gc).
2. Find the project's card.
3. Press {{button:outline|Schedule}}.

The window shows the chart. A project with nothing drawn yet offers {{button:blue|Draw a first draft}} instead.

## Move a bar

1. Press **Open all** so every trade's bars show.
2. Drag a bar to its new days. Drag an end of a bar to make it longer or shorter.
3. Let go. The **Why it moved** window opens.

While you drag, the chart shows what moves after the bar. The window says the same before anything saves.

## Say why it moved

1. Pick a reason, like **Weather** or **The trade before**.
2. Write what happened in your own words.
3. Press {{button:blue|Save the move}}.

Nothing saves without a reason and a sentence. The window names the bars the move pushes, and says what happens to the finish.

## Change a bar in its form

Press a bar on the chart. The bar's form opens under the chart.

1. Change its **Starts** or **Finishes** day.
2. Set **Not before** for a day it cannot start before, like a delivery.
3. Set **Must finish by** for a day it has to be done.
4. Tick what it waits on under **It waits on**. Type a gap in days after one, like cure time.
5. Press {{button:blue|Save, and say why}}.

The **Why it moved** window opens next, as it does for a drag. The form also shows what a slip of 5 or 10 days would do.

## Say where the work is

A trade's bar has a **Place** line in its form, like Roof or Level 2. Type the place and press **Set the place**. A guess shows until you set one. The **Where the work is** card under the chart sets every bar's place at once. The chart then flags a day with too many trades in one place.

## Keep the days it really ran

The form has a **Really** line at the bottom. Type the day the work really started, and the day it finished. Then press **Keep the real days**. The real days save at once, with no reason asked.

## Move one part of a split bar

A split bar shows its parts on the chart. Drag one part to its new days. The **Why it moved** window says what the part does, and what the whole bar does.

## Link two bars

Drag from the end of one bar to another bar. The second bar then waits on the first. Press a link line to take it away. Adding a link and taking one away each ask why, like any move.

## When someone saved first

Two people can have the schedule open at once. Your save stops when someone saved a change after you opened the window. The window then says **The schedule changed while you were working.** Below those words, the window lists their change with its time.

Your reason and your words stay in the window. The chart now shows their dates. Press {{button:blue|Save the move}} again to save your move on the new dates.

## Undo a move

The newest move sits at the top of **Changes to the schedule**. Press **Undo** to put every date it changed back. The move stays on the record, marked undone. Press **Redo** to make the move again.

Undo works only while nothing the move touched has moved since.

## Try moves first

To try moves without changing the schedule, make a copy. See [try moves on a copy of the schedule](/help/try-moves-on-a-copy-of-the-schedule).
