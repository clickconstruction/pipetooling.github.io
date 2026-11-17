---
name: "Task Mode: the refresh and the doer's tools"
number: 369
group: close
status: design picked by the owner 2026-11-16 ("I like your plan, please build the entire PR train") · steps A1, A2 and B1 built (v2.7533, v2.7536, v2.7537) · steps B2 to D to build
summary: >
  The owner sent a screenshot of Task Mode and asked for a visual refresh in the family of the New task
  window, and for tools that let the person doing tasks act without waiting on someone. Checklist → Today
  is redrawn: one head that says where you stand, a Next card, a done task as one line, quiet presses with
  names, and an old-task list that is red only when a real due day has passed. Eight tools follow on the
  card: move a task to another day, say you cannot do it, say it no longer applies, go through the old
  ones, add proof as you finish, add your own task or a follow-up, hand a task on, and draw a map or leave
  a point on one.
next: B2 and B3, the last tools that need no database change. Then C1, the ground migration, pushed right after its merge.
size: L as a train of fifteen (M · S · S · S · S · M · S · S · M · S · M · M · S · S · S); left: B2 to D (S · S · M · S · S · M · S · M · M · S · S · S)
blocker: none
ver: v2.7533 · v2.7536 · v2.7537
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
| A1 | The top half of Today: the head and its sentence, the Today and History bar in Task Mode, Next, Then, Done today, presses with names | none | M | built, v2.7533 |
| A2 | The lower half: Still open with amber age, *given* in place of *due*, the whole tag, the fold | none | S | built, v2.7536 |
| B1 | Tool 6: ＋ Add a task for me, and Follow-up on a done task | none | S | built, v2.7537 |
| B2 | Tool 5: who hears, and the finish sheet with Photo, Note and Map | none | S | |
| B3 | Tool 8, first half: Map on a task that has a map opens it at Add to it | none | S | |
| C1 | The ground for the rest, no screen: the new thread marks and one narrow function per act | migration | M | |
| C2 | Tool 8, second half: the doer paints a map or leaves a point on a task with none | uses C1 | S | |
| C3 | Tool 1: Not today | uses C1 | S | |
| C4 | Tool 3: No longer applies, drawn in History and Review | uses C1 | M | |
| C5 | Tool 4: Go through the old ones | none | S | |
| C6 | Tool 2: Can't do it, with the stuck list on Review | uses C1 | M | |
| C7 | Tool 7: Hand it on. FWD becomes the same press and keeps the task whole | uses C1 | M | |
| D | Do first, Mark 3 done, Yesterday | none | S each | |

## How to verify

- Turn Task Mode on from the gear menu on a phone. Today should open on the date, one green sentence and
  the joined Today and History bar.
- A day with open tasks shows one **Next** card with **Mark done**. Press it and the task moves to
  **Done today** as a struck line.
- Give a ZZ test task to a test account with *Tell me* lit. Its done line should name who hears.
- The full app, with Task Mode off, keeps its four tabs and its title, and Dashboard's My Inbox keeps the
  older card.

## Where it stands

Step A1 is built and not yet walked in the app: its look was a static page at phone and desk width, light
and dark. The first walk is on the live site, on a real phone.
