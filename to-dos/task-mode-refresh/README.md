---
name: "Task Mode: the refresh and the doer's tools"
number: 369
group: close
status: design picked by the owner 2026-11-16 ("I like your plan, please build the entire PR train") · all fifteen steps live on main 2026-11-17, A1 to D3 (v2.7533 to v2.7551) · both migrations pushed and checked on prod · eight small presses from the browser walk of 2026-11-21 in v2.8230 · walked in an iPhone simulator 2026-11-25: the page and its presses hold, and one fault was found, a helper's done line names nobody when a dev gave the task · that fault mended in v2.8560 · Manage's Delete, which said nothing, says what happened in v2.8572 · left: the simulator's look at the names mend, a look at the delete's line, and a walk on a real phone · both looks made in the simulator on 2026-11-25, and both hold: the done line names who hears, a task with Tell me off has no such line, and Manage's delete reads *Task deleted.* · seen on that look and not built: the New task window misbehaved twice, once each way, with no cause found in the code, and the done row gives its words a narrow column on a phone · Manage's delete seen once more on the live site the same evening, by a walker: *Task deleted.* 0.3 seconds after the press, the window closed, the row gone
summary: >
  The owner sent a screenshot of Task Mode and asked for a visual refresh in the family of the New task
  window, and for tools that let the person doing tasks act without waiting on someone. Checklist → Today
  is redrawn: one head that says where you stand, a Next card, a done task as one line, quiet presses with
  names, and an old-task list that is red only when a real due day has passed. Eight tools follow on the
  card: move a task to another day, say you cannot do it, say it no longer applies, go through the old
  ones, add proof as you finish, add your own task or a follow-up, hand a task on, and draw a map or leave
  a point on one.
next: A second look at the New task window on a quiet day, each send on its own yes: five sends in a row from Manage, each followed by ＋ New task at once, to see whether it ever fails to open or opens holding the task just sent. Weigh the done row on a phone, where four presses leave the words about 75 points. Then someone walks Task Mode on a real phone.
size: L as a train of fifteen (M · S · S · S · S · M · S · S · M · S · M · M · S · S · S), built; left: a look at the names mend (XS), a look at the delete's line (XS) and a walk on a phone (XS)
blocker: a person at a phone for the walk.
ver: v2.7533 · v2.7536 · v2.7537 · v2.7539 · v2.7541 · v2.7542 · v2.7543 · v2.7544 · v2.7545 · v2.7546 · v2.7547 · v2.7548 · v2.7549 · v2.7550 · v2.7551 · v2.8560 · v2.8572
opinion: build — the refresh changes no data, each tool is one small press on the card, and the one migration is additive
---

# Task Mode: the refresh and the doer's tools (#369)

## The ask, in the owner's words

2026-11-16, with a screenshot of Task Mode at a desk:

> Can you please take a look at task mode. I think it needs a visual refresh just like we gave new task a
> visual refresh recently. Can you please take a deep look at what can go into tasks and I want to come up
> with tools to increase the users autonomy with it.

After the first mock-up:

> When a user is in task mode, I would like to give them the opportunity to draw a map. Can we also add
> this feature where the same way they can add a note or a photo, they can also draw a map? I think that
> on top of drawing a map they should also be able to leave a point on the map.

And the go-ahead, the same day: "I like your plan, please build the entire PR train and let me know when
it is live."

## What the look found

Task Mode has no screen of its own. It is `/checklist` with the tab strip cut to Today and History
(`taskModeToggle.ts`, `useTaskModeEnabled`, `TaskModeChip`, the bounce in `Layout.tsx`). Today is
`ChecklistTodayTab` in `src/pages/Checklist.tsx`.

Read through the dev seat on 2026-11-16, counts only:

- 21 tasks were finished in 30 days and none was looked over. Every finished task read *Waiting on review*.
- 17 one-off tasks were open past their day, 12 of them for more than 80 days. None had a due day. The
  red *due Aug 20* was only the day the task was given (`overdueAgeLabel` reads `scheduled_date`).
- 135 repeating days had gone unticked since February. They drop off the list and nothing asks why.
- Since August 1: 12 notes, no photos, no due-day changes.

What a person given a task could not do alone: move it to another day, say it no longer applies, say
they are stuck in a way anyone is told of, hand it on, choose what comes first, do several at once.
The office's FWD (`saveFwd`) makes a new one-off for the other person and deletes the first day row, so
its notes, place, Done when… lines and photo switch are lost.

## The decision

The owner picked the refresh and all eight tools as drawn in [mockup.html](mockup.html). The calls below
were put to him with a pick each, and he said to build the plan, so each stands as drawn:

1. **Review.** A done task says when, and who hears. The solid *Waiting on review* chip goes.
2. **Red.** A task with no due day shows its age in amber and reads *given Aug 20*. Red is for a real due
   day that has passed.
3. **What comes first.** Today's open tasks in the office's order, then tasks sent back, then the oldest.
4. **Sunlight.** The August card (v2.1854) avoided tints on purpose. The tick, the ring and Mark done keep
   their thick dark edges. Tints only repeat what words say.
5. **The note press.** It stays on the right, where a thumb misses the tick, and it is smaller.
6. **Closing and handing on.** The giver is told. The giver is not asked first.
7. **A map on a task that has one.** The doer adds to that map and cannot swap it.
8. **A point and the task's place.** A point stays on the map. The task's own place still comes only from
   where the person stands (v2.7067).
9. **Where my tasks are.** A task with a map and no place has no dot today. It could show at its line's
   start. Not built until he says so.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| Today's page | `ChecklistTodayTab`, `ChecklistOutstandingSection`, `TaskPlacesMapCard` | the head, Next, Then, Done today (`src/lib/tasks/todayPage.ts`) |
| The card | `ChecklistInstanceCard`, looks `card` and `row` | a third look, `fresh`, with `lead` |
| The language | `src/components/checklist/newTask/` (the When bar, the Add row's pills, the Send bar) | `TaskDayBar`, `TASK_PILL_STYLE` |
| A task's thread | `checklist_instance_events`, six kinds held by a check | new kinds for moved, stuck, dropped, handed on and a map |
| The due day | `checklist_items.due_date` with its change log `checklist_item_due_changes` | a narrow function so the doer may set it |
| Handing on | `saveFwd`, a copy and a delete | a swap of who the task is for |
| A map | `painted_maps`, the door `paintPaintedMap`, *Add to it* for whoever reads the task | a narrow function so the doer's map lands on a task with none, the shape of `add_task_place_from_the_spot` |

Another session is designing @ tags in task notes. It adds a button to the note box
(`ChecklistItemActivity`) and a block above Today's list. Step A1 leaves room for both.

## The plan

One small PR per line, each with its guide, release note and fragment.

| Step | What lands | Database | Size | State |
|---|---|---|---|---|
| A1 | The top half of Today: the head and its sentence, the Today and History bar in Task Mode, Next, Then, Done today, presses with names | none | M | live, v2.7533 |
| A2 | The lower half: Still open with amber age, *given* in place of *due*, the whole tag, the fold | none | S | live, v2.7536 |
| B1 | Tool 6: ＋ Add a task for me, and Follow-up on a done task | none | S | live, v2.7537 |
| B2 | Tool 5: who hears before the start, 📷 Photo on every card, and the photo and the note offered in words once a task is done (no sheet on every Mark done; see v2.7539) | none | S | live, v2.7539 |
| B3 | Tool 8, first half: Map on a task that has a map opens it at Add to it | none | S | live, v2.7541 |
| C1 | The ground for the rest, no screen: the new thread marks and one narrow function per act (`20261117120000_task_doer_acts.sql`, bed `task-doer-acts`) | migration | M | live, v2.7542; pushed 2026-11-17 |
| C2 | Tool 8, second half: the doer paints a map or leaves a point on a task with none | uses C1 | S | live, v2.7543 |
| C3 | Tool 1: Not today, with the card's ⋯ More and the thread's words for every tool's line | uses C1 | S | live, v2.7544 |
| C4 | Tool 3: No longer applies, drawn in History and Review. Not offered on a roadmap or a vehicle task, whose close would say work was done | uses C1 | M | live, v2.7545 |
| C5 | Tool 4: Go through the old ones. Built after C6 | none | S | live, v2.7547 |
| C6 | Tool 2: Can't do it, with the stuck list on Review. Built ahead of C5 | uses C1 | M | live, v2.7546 |
| C7 | Tool 7: Hand it on. Both of the page's Forward windows call the same function and keep the task whole. Dashboard's My Inbox had a third Forward, moved onto the same function in v2.7563 | uses C1 | M | live, v2.7548 |
| D1 | Do first: a press under More that lifts one task into Next on this device | none | S | live, v2.7549 |
| D2 | Mark N done: one press for a round of daily tasks | none | S | live, v2.7550 |
| D3 | Yesterday: a missed repeating task asks once, did it or skipped (`20261117130000_task_skipped_line.sql`) | a small migration | S | live, v2.7551; pushed 2026-11-17 |

## How to verify

- Turn Task Mode on from the gear menu on a phone. Today should open on the date, one green sentence and
  the joined Today and History bar.
- A day with open tasks shows one **Next** card with **Mark done**. Press it and the task moves to
  **Done today** as a struck line.
- Give a ZZ test task to a test account with *Tell me* lit. Its done line should name who hears.
- The full app, with Task Mode off, keeps its four tabs and its title, and Dashboard's My Inbox keeps the
  older card.

## Where it stands

All fifteen steps are on main since 2026-11-17. A1 to C1 merged one PR each (#8444, #8445, #8448, #8450,
#8452, #8453). C2 to C7 landed together in #8459 and D1 to D3 in #8462, so the train fit the owner's seven
hours. The step PRs they carried were closed with a note. Both migrations were pushed right after their merges
and read back on prod. None has been walked in the app: step A1 and A2 were looked at as a static page at
phone and desk width, and the rest stand on their tests. The first walk is on the live site, on a real phone.

Two things fall short of the mock-up, and each fragment says so. A roadmap task and a vehicle task cannot be
closed as no longer applying, since a close is a completion (v2.7545). And the finish offers the photo and
the note in words beside their presses, with no sheet on every Mark done (v2.7539).

### The walk of 2026-11-21

The owner's main session walked Task Mode at 375 px in a browser, signed in as the dev, looking only. It was the first time the train was seen drawn in the app. The screens read as designed and no page slid sideways. Eight presses were under a thumb's 44 px, and v2.8230 grew each on a phone without moving the lines three of them sit in:

| Press | Was | Now |
|---|---|---|
| **＋ Note**, **📷 Photo**, **🗺 Map**, **⋯ More** on the Next card | 32 tall | 44 |
| **Exit** on the Task Mode strip | 28 | 44, the pill inside it still 28 and the strip still 39 |
| **Go through them** | 20 | 44 |
| **Fold ▴** on Tagged notes | 34 × 18 | 44 × 44 |
| **Today** and **History** | 38 | 44 |

Left as read: the task ring on a Still open row is 36 × 36 and **▶ Upcoming** is 36 px tall. The walk did not name them.

A browser at phone width is not a phone. This card still waits on a walk with a real phone in a hand.

### Walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, on the live site. It is a simulator and not a real phone, so the walk with a phone in a hand still stands. The dev gave one ZZ test task to ZZ Test Learner with **Tell me** lit, and the page was read through View as that helper.

**Holds.** Today opens on the date, the green sentence and the joined Today and History bar. The **Next** card has **Mark done**, and a press moves the task to **Done today** as a struck line.

**One fault found, read in the code the same day, not built: the done line names nobody.** The line read *Done* and the time. Before the press, the **Next** card had no *hears when it is done* line. The task was saved as told when done.

- The words are right and were handed no name. The Today page reads the names of the people who hear straight from the people table (`Checklist.tsx`). A helper may not read a dev's row there, nor a master's who has not adopted them. So a helper, a sub or a superintendent given a task by one of those reads no name, on a real phone too.
- The mend is the client alone, S: read the names through the names function every signed-in person may call (`fetchUserDisplayNames`), as other pages do.

**Mended in v2.8560.** Both reads of names on the Today page go through that function, so the **Next** card's line before the start, the done line, the giver's name in the sheets of the doer's tools and the writers' names in a task's notes all mend together. The function answers for a person who has left, which the people table never did. A note still names such a writer. A line that says who hears names no one who has left, as before. A task with **Tell me** off reads no such line, as before.

Not seen on the live site. The look is the simulator's: a ZZ test task from the dev to the test helper with **Tell me** lit, read through View as that helper before the start and after **Mark done**, and the task deleted from Manage after.

Seen in the code on the way, and not built: a task's activity panel and the History list read their people's names from the people table the same way (`ChecklistItemActivity.tsx`, `ChecklistHistoryLedger.tsx`). A helper there may read *Someone* or nothing for a dev's name. Nobody has seen it drawn.

**Not walked.** **Exit** on the Task Mode strip: with *Modes at open* ticked a row of three modes stands in its place. **Go through them**: it needs an old task, and the test account has none.

**Left on the live site.** One done ZZ test task and its day row. Both presses have a way back, so neither is on the list of presses nothing takes back (#443): the done line's own press reads **Mark not done**, and Checklist → Manage → **Delete** removes the task with its day rows for a dev, a master or an assistant. The walk did not delete it.

**Manage's Delete said nothing, seen on the walk of 2026-11-25 that cleaned that task up. Mended in v2.8572.** The task was deleted and no line said so: the row leaving the list was the only sign. Read in the code beside it: a failure drew the database's own words at the page's foot, and a delete the row rules refuse closed the window in silence. The press now says each end in a toast: *Task deleted.*, the task was not deleted with its reason, or the task was not deleted because it is someone else's or already gone. Not seen on the live site. The look writes one ZZ Test task and deletes it.

