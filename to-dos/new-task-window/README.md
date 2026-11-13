---
name: "The window that gives a task: redraw Add checklist item as New task, so the common task fits one phone screen and every row has its own shape"
number: 331
group: close
status: asked 2026-11-12 · the card and the mock-up the same day · built 2026-11-13 on Grace's "Yes, build it" and "Build them now" · all four PRs live and walked on clicktooling.com by 17:00 UTC · open for the notes below
summary: >
  The Add checklist item window works, but it shows every choice at once and at the same weight.
  On a phone it is 1,267 px tall, one and a half screens, and the day sits 711 px down. Of the 137
  tasks made in it, 96 used none of its eight extras and 110 of the 129 one-time tasks were for
  today. The card proposes the same fields and the same save in a new order: what, for whom, when,
  where. People become a row of faces, the day one joined bar, places a shelf, and the rare things
  quiet presses in a row called Add. A bar at the bottom says in words what will happen, and its
  button names who gets the task. The drawn window is about 570 px tall. No database change.
next: Grace opens New task on a phone and types a task, to see Send sit just above the keyboard; if it does, the second Send at the top of a phone comes off. The notes under What should change next wait for her word.
size: M as a train of four (S · M · M · S), built; left: the phone walk and notes
blocker: Nothing built is left. The phone walk needs a real phone, which a headless walk cannot be.
opinion: build PRs 1 and 2, then walk it on a real phone before the other two windows follow — the bar above the keyboard is the one thing a drawing cannot prove
ver: v2.7082 · v2.7085 · v2.7092 · v2.7093
---

# The window that gives a task (#331)

## The ask

Grace, 2026-11-12, after seeing the Add window with the new Place row and Photo of the spot in it:

> Should we refactor how the "Add checklist item:" looks so we can give it a visual upgrade. I
> don't think we're offering the best tool here, help me visually create the best tool

This card is the answer and [mockup.html](mockup.html) is the picture. The suggested window in the
mock-up can be pressed. She saw both and said "Yes, build it", so each of the six calls below took
its pick. PR 1 is built: the words and the order, with no screen in it (v2.7082). PR 2 is built: the
window itself (v2.7085). On the local app it is 581 px tall on a phone, against 1,267 px before.

## The answer, in short

Yes. The window is honest and complete, and it is hard to use for the reason most long forms are:
it grew one field at a time, and each field arrived open.

- **It is long.** 1,267 px on a 390 by 844 phone. The day is 711 px down. The reminder and the
  bottom Send are below the screen's edge. 53 boxes and presses show before a word is typed.
- **Its weight does not match its use.** The list of people is always open and takes 260 px. The
  reminder section is always open and 13 tasks used it. Place and Photo of the spot, added this
  week by #328, took another 245 px.
- **Its name is old.** The window says *Add checklist item:*. The button that opens it says *Task*,
  the mode is Task Mode and the guide says "give someone a task".

## What the record says

Read on 2026-11-12 from the live record with every write refused. Counts only, no names.

| | Of the 137 tasks made in this window |
|---|---|
| Used none of the eight extras | 96 |
| For one person / for several | 119 / 18 |
| For someone other than the giver | 108 |
| One-time, for the day it was made | 110 of 129 |
| One-time, for the next day | 10 |
| One-time, for another day | 9 |
| Repeats | 8 |
| Tell someone else when it's done | 14 |
| Tell me when it's done, turned off | 33 of the 108 for someone else |
| A reminder | 13 |
| Stays until done, turned off | 7 |
| A link | 6 |
| A due day | 2 |
| Done when… lines | 1 |
| A photo at the finish | 1 |
| Words past 80 characters | 22 (the middle task is 45, one in ten passes 107) |

Done when… and the photo at the finish are a week old, so their counts say little yet.

## The design

One window, the same fields, the same save. Read top to bottom it is a sentence.

1. **New task.** The title. The go-to-checklist press and the ✕ stay where they are.
2. **What.** A box three lines tall that grows with the words.
3. **For.** A row of faces: Me, anyone just picked from the list, the people given to last, then
   the crews. The row slides sideways on a phone and wraps on a desk. **Someone else** is pinned at
   its end and opens the full list with its search box, in place. The crew presses *New crew* and
   *Edit* move into that panel. The rule that drops the giver when a first other person is picked
   stays as it is.
4. **When.** One joined bar: Today, Tomorrow, Pick a day, Repeats. A date box or the weekdays open
   under it only when asked for.
5. **Where.** One row: **New**, then the places used last, with **Photo** pinned at its end. *New*
   opens the *Where is it?* sheet as today.
6. **Add.** The rare things as quiet presses, each by name: Remind, Tell someone else, Link, Due
   by, Done when…, Photo at the finish, Just for the day. A press opens that one thing in place. A
   thing that is set is lit and shows its value.
7. **The bar.** The sentence the window already writes, moved to where the eye ends: "Theo gets it
   today. It stays until it is done. You hear when it is done." Beside Send, a bell for *Tell me
   when it's done*, lit by default and shown only when the task is for someone else. The Send
   button names the act: *Send to Theo*, *Send to Theo and Imani*, *Send to 4 people*, *Add to my
   list*. With no words typed the button is dead and the sentence says "Type the task first."

Each row has its own shape, so the eye finds a row by its look: circles are people, the bar is the
day, dots are places. The only solid blue in the window is Send.

Opened from a job, the Job row sits above What as it does now.

## What I would not claim

- **The faces do not hold everyone.** Replayed on the 137 tasks: Me and the last four people, which
  is what a phone shows without a swipe, held everyone on 87. Five held 93, six held 95. On the
  rest the giver presses *Someone else* first, one press more than today, where the list is already
  open. Me and three names, about what the Recent line offers now, held 80.
- **The bar above the keyboard is not proven.** The window today keeps a second Send at the top so
  it can be reached with the keyboard up. PR 2 keeps that top Send until a walk on a real phone
  shows the bar holds its place.
- **Nothing here was timed.** The app does not record how long a giver spends in the window, so
  this card cannot promise a faster task. It promises a shorter window and fewer things to read.

## Her calls

1. **The name.** Pick: *New task*.
2. **People.** Pick: the faces with *Someone else*. The other way keeps the list always open.
3. **The rare things.** Pick: the Add row, each named. The other way is one More fold.
4. **The button.** Pick: Send names who gets the task, and Cancel leaves the bar for the ✕.
5. **Tomorrow.** Pick: a Tomorrow press.
6. **The other two windows.** Pick: Change a task and the roadmap's Add task take the same rows next.

## The build

No migration, no edge function, no change to what is saved.

| PR | What | Size |
|---|---|---|
| 1 | A kernel with tests: who is in the row and in what order, the sentence, the button's label, which extras are set. No screen changes. | S |
| 2 | The window: New task, the rows, the bar. The guide `give-someone-a-task` is redrawn with it. Then a walk on a real phone. | M |
| 3 | Change a task takes the same rows. | M |
| 4 | The roadmap's Add task takes the same rows and gains the photo of the spot it lacks. | S |

Wait for #328 to land first: its photo PR (#7836) still changes `ChecklistAddModal.tsx`.

## Where it stands

All four PRs are on main and live, 2026-11-13. No migration and no edge function.

| PR | Version | What | Live |
|---|---|---|---|
| #7862 | v2.7082 | the words and the order, a kernel with no screen | merged 05:47 UTC |
| #7866 | v2.7085 | the New task window | about 14:00 UTC |
| #7873 | v2.7092 | Edit task draws the same rows | 15:53 UTC |
| #7876 | v2.7093 | the roadmap's Add task draws the same rows, with the photo of the spot | 16:55 UTC |

**Walked live** on clicktooling.com, signed in, every write refused, phone and desk, light and dark. Send, Save and Add task were never pressed.

- **New task:** 581 px on a 390 by 844 phone, no scroll, the bar at 568 of 844 and still on screen with Remind open. The sentence, *Add to my list*, a face makes *Send to …*, the bell, Tomorrow, the place shelf, the Photo press, Remind's value on its press, Someone else, Repeats, the ×.
- **Edit task:** Manage → ⋮ → Edit opens on the task's own words, its person lit, its saved reminder lit on the Add row, Save live, the bar on screen.
- **The roadmap's Add task:** the stage named under the title, no When row, nobody picked, the sentence naming the stage and who gets it when the stage unlocks, the place, the Photo press, Done when… turning the photo on, and *Where is it?* opening on top.

**Not proven:** the bar above a real phone's keyboard. A headless walk shrank the visible height and the bar held, but only a real phone can show it.

## What should change next (notes, not built)

- **The second Send at the top of a phone** stays until the phone walk shows the bar holds. Then it comes off: a small GUI change.
- **An old task's sentence in Edit task** reads like *Theo gets it on Tue, Feb 17.* for a day long past. Accurate, but *has had it since Tue, Feb 17.* may read better. Wording only.
- **The faces do not hold everyone.** Replayed on the record, Me and the last four people covered 87 of 137 tasks; the rest press Someone else first. Count it again in two weeks before changing anything.

## How it was checked

- The window was measured on the local app at 390 by 844 and 1400 by 900 with every write refused.
- The counts and the replay were read the same way, through the signed-in page, GET only.
- The mock-up was shot at 375, 768 and 1400 in light and dark, and its suggested window was pressed
  through a task, a crew, a pick from the list and a reminder.
