---
name: "The window that gives a task: redraw Add checklist item as New task, so the common task fits one phone screen and every row has its own shape"
number: 331
group: close
status: asked 2026-11-12 · the card and the mock-up the same day · built 2026-11-13 on Grace's "Yes, build it" and "Build them now" · all four PRs live and walked on clicktooling.com by 17:00 UTC · walked in the iPhone simulator the same day, where a low box pushed the window off the top · fixed, and the second Send taken off, in v2.7155 · left: the owner's word and the notes below
summary: >
  The Add checklist item window works, but it shows every choice at once and at the same weight.
  On a phone it is 1,267 px tall, one and a half screens, and the day sits 711 px down. Of the 137
  tasks made in it, 96 used none of its eight extras and 110 of the 129 one-time tasks were for
  today. The card proposes the same fields and the same save in a new order: what, for whom, when,
  where. People become a row of faces, the day one joined bar, places a shelf, and the rare things
  quiet presses in a row called Add. A bar at the bottom says in words what will happen, and its
  button names who gets the task. The drawn window is about 570 px tall. No database change.
next: the owner's word to retire the card. When a real iPhone and an Android phone are at hand, one minute on each: open New task, tap Done when…, and see the title and Send stay on screen. The notes under What should change next wait for Grace's word.
size: M as a train of four (S · M · M · S), built, and walked in a simulator; left: a look on a real phone and the notes
blocker: Nothing. The walk was a simulator's, so a real phone has not shown it yet.
opinion: close it. The bar holds in every state the simulator could show, and the notes left are small things for other cards, none of them a reason to keep this one open
ver: v2.7082 · v2.7085 · v2.7092 · v2.7093 · v2.7155
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
- **The bar above the keyboard is proven on a simulator, not on a phone.** See The walk below. The
  second Send at the top, kept until that walk, came off in v2.7155.
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
| the close-out | v2.7155 | the window follows the keyboard's slide on an iPhone, and the second Send comes off | with its merge |

**Walked live** on clicktooling.com, signed in, every write refused, phone and desk, light and dark. Send, Save and Add task were never pressed.

- **New task:** 581 px on a 390 by 844 phone, no scroll, the bar at 568 of 844 and still on screen with Remind open. The sentence, *Add to my list*, a face makes *Send to …*, the bell, Tomorrow, the place shelf, the Photo press, Remind's value on its press, Someone else, Repeats, the ×.
- **Edit task:** Manage → ⋮ → Edit opens on the task's own words, its person lit, its saved reminder lit on the Add row, Save live, the bar on screen.
- **The roadmap's Add task:** the stage named under the title, no When row, nobody picked, the sentence naming the stage and who gets it when the stage unlocks, the place, the Photo press, Done when… turning the photo on, and *Where is it?* opening on top.

**The bar above the keyboard** was then walked in the iPhone simulator, which has a keyboard where a headless walk has none. That is the next section.

## The walk

2026-11-13, in the iOS Simulator: an iPhone 17 Pro on iOS 26.4, Safari, the on-screen keyboard up.
The dev's own sign-in on the local app. One *ZZ Test* task was sent to the dev's own list from the
bar, with the keyboard up, and deleted after. Nothing else was sent.

**What it found.** With the keyboard on the words, the bar held as drawn. With the keyboard on a
field low in the window, it did not. Safari slides the page up to show such a field, and the
window was pinned to the page. So the title, the × and the box being typed in left the top of the
screen, and only the bar stayed. The second Send at the top left with them, so it was no way out
in the one place it was kept for. Safari's larger text (its aA menu at 125%) failed the same way.

**What v2.7155 does.** The window follows the part of the page that shows, and the box that has
the keyboard is scrolled back into view. All three windows share the frame, so all three are fixed.

| Window | Keyboard on | Title and × | The box | The bar and Send |
|---|---|---|---|---|
| New task | the words | show | shows | above the keyboard |
| New task | Done when… | show | shows | above the keyboard |
| New task | a link | show | shows | above the keyboard |
| New task | Someone else's search | show | shows | above the keyboard |
| New task | Done when…, text at 125% | show | shows | above the keyboard |
| Edit task | the words, Done when… | show | shows | above the keyboard |
| Roadmap Add task | the words, Done when… | show | shows | above the keyboard |

The rows scroll between the title and the bar with the keyboard up. Putting the keyboard away
gives the window its full height back. Pick a day and Due by open the iPhone's own calendar and
raise no keyboard. Turned sideways, the window is the desk's centred card and its bar shows.

**Its limits.**

- A simulator, not a phone. Its Safari and keyboard are Apple's own, and it is close. A real
  iPhone's keyboard, and a keyboard from another maker, were not seen.
- One phone size. A small iPhone could not be driven, so text at 125% on the 17 Pro stood in. That
  leaves less room than an iPhone SE does.
- iPhone only. Android was not walked. Chrome there makes the page smaller for the keyboard, so it
  should not need the fix, and that is a guess.
- Sideways with the keyboard up, the iPhone leaves a strip a finger high. No window fits there.

## What should change next (notes, not built)

- **An old task's sentence in Edit task** reads like *Theo gets it on Tue, Feb 17.* for a day long past. Accurate, but *has had it since Tue, Feb 17.* may read better. Wording only.
- **The faces do not hold everyone.** Replayed on the record, Me and the last four people covered 87 of 137 tasks; the rest press Someone else first. Count it again in two weeks before changing anything.

**Seen on the simulator walk.** Small things, each for a card of its own or none.

1. **Where is it?** With the keyboard on the place's name the sheet slides as the window did. Its
   title and Cancel leave the top. The name and **Use this place** stay in view.
2. **Someone else.** With the keyboard up, the search box sits just above the bar. The names it
   finds are under the bar until the rows are swiped.
3. **Done when…** Its hint is five lines on a phone. Open, it pushes the window past one screen.
4. **Pick a day.** The four weeks open under the bar and push Where and Add below the screen.
5. **A narrow screen or larger text.** At 322 px wide, *Repeats* is cut at the edge of the When
   bar and the Add row takes four lines.
6. **The roadmap's sentence.** A stage whose name ends in a full stop reads "It joins the stage
   Concrete the upper bridge.. Nobody has it yet."
7. **Edit task.** A one-time task shows "Saving reshapes the days still to come", which is about
   a task that repeats.
8. **Manage.** A task only for its giver reads *notifies on done*. On a phone the ⋮ menu of the
   last task is cut by the list's edge, so only the top of Edit shows and Delete is out of reach.
9. **Opening.** The roadmap's Add task raises the keyboard as it opens. New task rings its box and
   waits for a tap.
10. **Other sheets.** `PhoneSheet` and the dispatch job picker are pinned to the page the same way
    and were not walked.

## How it was checked

- The window was measured on the local app at 390 by 844 and 1400 by 900 with every write refused.
- The counts and the replay were read the same way, through the signed-in page, GET only.
- The mock-up was shot at 375, 768 and 1400 in light and dark, and its suggested window was pressed
  through a task, a crew, a pick from the list and a reminder.
- The built windows were walked in the iPhone simulator with the keyboard up, before and after
  v2.7155. Two pictures are kept here. [walk-new-task.jpg](walk-new-task.jpg) shows the failure,
  the same box after the fix, the words with one Send, and the low box at 125%.
  [walk-edit-and-roadmap.jpg](walk-edit-and-roadmap.jpg) shows Edit task and the roadmap's Add task.
