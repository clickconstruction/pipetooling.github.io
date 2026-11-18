---
name: "See a person's Task Mode from Review"
number: 381
group: ready
status: asked 2026-11-17 · looked at, designed, drawn and rendered the same day · the owner said *Build my picks* · built and live the same evening as v2.7692, v2.7697 and v2.7698 (PR #8599) · walked on the live site as the dev, read only, on the dev's own window and one teammate's · the look shown as screenshots on 2026-11-18
summary: >
  On Checklist → Review the owner opens a person's card and sees their open tasks as a list. He asked for a
  press there that opens a window showing what that person's phone shows in Task Mode, with their current
  tasks and what is coming up. This card adds that press and that window. The window is a look: he stays
  signed in as himself, it reads with the read the office already has, and no press inside it works. It
  draws Today with the same code the person's phone runs, so the two cannot drift apart.
next: The owner's word on call 7's link to View as, asked on 2026-11-18 with the screenshots. Then retire the card.
size: M as a train of five (M · M · M · S · XS), all five done
blocker: None.
opinion: build — the office can already read every row Today draws, so this is a new look over reads that exist, with no change to the database
---

# See a person's Task Mode from Review (#381)

The mock-up is [mockup.html](mockup.html). One script draws every frame on it from one list of three
made-up people: one with tasks today, one with only old tasks, one with nothing today. It was rendered at a
desk width and a phone width, in light and in dark, before it was shown.

## The ask, in the owner's words

2026-11-17, with a screenshot of Checklist → Review and one person's card open:

> on this page, When a user's tasks are expanded, I would like to see an option to imitate that
> individual, where it opens a modal where I can see what their phone screen would look like in task view
> which would include their current tasks and their upcoming. Would you be able to help me Design, plan,
> mock up, and then create this?

## What the look found

Task Mode has no screen of its own. It is `/checklist` cut to Today and History, and Today is
`ChecklistTodayTab` in `src/pages/Checklist.tsx`. It takes the signed-in person as `authUserId` and reads
with it in six places:

- today's day rows and the older open ones, through `checklist_instance_assignees`
- the person's own order for today's tasks, `checklist_item_assignees.display_order`
- Upcoming, the tasks dated ahead, for an office role only
- Waiting For, the roadmap tasks that wait on another task (`useComingUpWaitingGroups`)
- who hears when a task is done (`taskHearsId`)
- the tagged notes above the list (`TaggedJobNotesSection`), which reads the signed-in person by itself

Everything else on the page is read by the day rows' ids: the threads, the Done when… lines and their
ticks, the photos, the places, the photos of the spot and the painted maps.

**The office can already read all of it.** `is_dev_or_master_or_assistant()` passes a dev, the owner, an
assistant, a controller and a primary, and it is the first test of the read policy on `checklist_instances`,
`checklist_instance_assignees`, `checklist_item_assignees` and `checklist_items`. The threads, the lines,
the ticks and the photos read through the day row (`can_see_checklist_instance`), and the roadmap tables
through `can_select_checklist_tech_tree_roadmap`, which passes staff. Review's own board reads other
people's day rows this way today. So the window needs no new function and no migration.

Three things live on the person's phone and cannot be read from anywhere else. The window says so.

- Whether Task Mode is switched on (`taskModeToggle.ts`, kept per device).
- Do first, the task the person lifted into Next (`readDoFirst`, kept per device).
- How far each task is, which needs where the person stands.

One thing needs a second look at build time: the tagged notes that wait on the person. A task note's tag
reads for whoever can read the note, so the office can read those. A job note's tag has its own rule.

## How this differs from View as

`src/lib/loginAsUser.ts` calls the edge function `login-as-user`. It swaps the whole session for a
sign-in as the other person, writes a `user_imitations` row, and every page and press then works as them.
A dev, the owner and an assistant may call it. The door on a screen is Settings → View as, a dev's.

This window is the opposite on each point. The viewer stays signed in as himself. Nothing is written and
no imitation is recorded. Only the task screen is drawn, and no press on it works. That is why the press
does not use the word *imitate*.

## The calls, each with a pick

| # | Call | The pick | Why |
|---|---|---|---|
| 1 | Look or act | Look only | Every press is drawn and dead, with one line that says so. Acting as someone is what View as is for. |
| 2 | Reading a card | A card opens | A press that only shows more works: a card's notes, its photos, the fold of older tasks. Nothing that writes works. |
| 3 | What Coming up covers | The next 7 days | Tasks dated ahead, repeating tasks by their rule (`checklistMaterialize.ts`), and Waiting For. Shown beside the phone for every person, since a crew phone has no Upcoming fold. |
| 4 | The press's words | *See Dana's Task Mode* | It says what opens. *Imitate* stays the word for the sign-in. |
| 5 | Who gets it | The owner and a dev | The people who see *＋ Add task for* on the card today (`canActForOthers`). Other office roles keep the board as it is. |
| 6 | History | Not in the window | Checklist → History already has a person picker for the office. The bar's History is drawn and dead. |
| 7 | A door to View as | Only where View as is today | A dev sees one quiet link in the side column. Giving the owner that door is a new permission and waits for his word. |

**The owner's word, 2026-11-17:** *Build my picks*, all seven as picked. Six are built. Call 7's link is
not: a dev still reaches View as from Settings, and the window has no door to it.

Call 3 as built: Coming up lists the person's open tasks dated in the next 7 days, one day a line. A
repeating task is already a dated row for 35 days ahead, so the list is a read of rows and no rule is
worked out. Waiting For is not in that list. It is on their screen, where their phone has it.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The press | Review's opened person card, beside *＋ Add task for* | *See <first name>'s Task Mode* |
| Their screen | `ChecklistTodayTab`, read by `authUserId` | the person as a value, and a look-only mode |
| The card | `ChecklistInstanceCard`, `ChecklistOutstandingSection` | every act dead in a look, the card still opens |
| The window | none | one window, phone size at a desk and the whole screen on a phone |
| Coming up | Upcoming's read of dated rows, `checklistMaterialize.ts` for the rules | the next 7 days as one list |
| The words | `src/lib/tasks/todayPage.ts` | the press, the window's head and its look line, in a tested file |

## The plan

One small PR per line, each with its release note and fragment. Step 3 carries the guide, the Glossary
line and the access line. The merge queue was nineteen deep that evening, so steps 1 to 4 landed together
as PR #8599, one commit a version.

| Step | What lands | Database | Size | State |
|---|---|---|---|---|
| 1 | Today's reads take the person as a value, in one tested place under `src/lib/tasks/`. Today draws the same. | none | M | live, v2.7692 |
| 2 | Today's look-only mode: every act dead, a card still opens. The page's render tests prove the doer's Today is unchanged. | none | M | live, v2.7697 |
| 3 | The window and the press on Review. Guide, Glossary, `ACCESS_CONTROL.md`. | none | M | live, v2.7697 |
| 4 | Coming up: the next 7 days from dated tasks and repeat rules. | none | S | live, v2.7698 |
| 5 | The walk: the window beside the real Task Mode for one test account. | none | XS | walked 2026-11-17, below |

## How to verify

- As the owner or a dev, open Checklist → Review and open a person's card. The press sits beside
  *＋ Add task for*. An assistant sees the board with no such press.
- Press it. The window's phone shows the date, the green sentence, Next, Then, Done today and Still open
  for that person, and Coming up lists the next 7 days.
- Press **Mark done** inside the window. Nothing happens, and the person's task stays open.
- Sign in as a sample account in a second browser, turn Task Mode on, and hold the two side by side. The
  lists match line for line.

## Where it stands

Built and live. The guide is `/help/see-a-persons-task-mode`.

**How a look is held to looking.** Three stops, each enough alone. A gate around the screen lets a press
through only when it shows more or folds something away. Today is given nobody to act as, so every write's
guard fails. The windows that act are not drawn at all. The page's render test presses every control
twice and counts the writes.

**Walked on the dev server over live data, before the merge, 2026-11-17.** Signed in as the dev, with every
write stopped at the browser and counted.

- The dev's own window listed the same tasks, in the same order, under the same sentence as the same
  account's real Task Mode at a phone's width. The one difference was Tagged notes, which the window says
  it does not show.
- Every press on the screen was pressed twice. No write was tried and no other window opened. A fold
  showed more rows.
- The window was seen at a desk and at a phone's width, in light and in dark. Coming up sat beside the
  phone at a desk and behind the **Coming up** press on a phone. Nothing ran off the side.

**Walked on the live site, after the deploy, 2026-11-17.** Signed in as the dev in a throwaway browser, with
the owner's word for a read-only look. Every write to the database was stopped at the browser for the
whole run. Nobody signed in as anyone else.

- **A teammate's window.** Every read the window made named that person and none named the dev. Every
  task it listed was one of that person's open rows by a separate plain read. It listed the same tasks as
  their card on Review. Every press was pressed twice: no write was tried and no other window opened.
  **Read again** drew the same day and **Close** shut it. Coming up listed a day.
- **The dev's own window** beside the dev's real Task Mode at a phone's width, both on the live site: the
  same tasks, the same order, the same sentence.
- **A phone's width, in dark:** the teammate's window filled the screen, **Coming up** swapped the screen
  for the list, and nothing ran off the side.

**Not walked.**

- A real phone. Every phone-size look was a desktop browser at a phone's width.
- A teammate's window beside that teammate's own Task Mode. That needs a sign-in as them, which nobody
  asked for. The side-by-side was the dev's own account.
- The owner's account. The press was pressed as a dev. That an assistant is not offered it is held by the
  render test, not by a walk.
- A day with tasks dated today. Neither person had one that evening, so Next and Still open were seen on
  the live site, and Then and Done today were not.
- The empty week's **Add a task** press on the live site, since it opens a window that writes.
- The live site in light. The window was seen in light on the dev server.

**Shown as screenshots, 2026-11-18.** Taken as the dev in a headless browser, on a dev server over live data.
Every write to a table was stopped at the browser. The pictures hold real tasks, so they were shown in the
session and are kept nowhere.

- The door on a person's opened card, at a desk and at a phone's width.
- A teammate with a task today, top to bottom: the head, the look line, the date, the green sentence, Next,
  Still open, Waiting For and the Upcoming fold, with Coming up and the list of what a look does not show.
- A second teammate with a day not ticked and a full week: *Tomorrow*, *repeats* and *1 repeating task again*.
- The dev's own row.
- A person with nothing today, whose screen reads *Nothing due today.*
- An empty week, with the **Add task for** press drawn and not pressed.
- A card opened by its fold. Then **Mark done** pressed twice, with Note, More, Photo and Add a task for me.
  The task stayed under Next and the sentence did not change. No write was tried and no other window opened.
  **Read again** moved the time in the head and Escape closed the window.
- A phone's width of 375, with the bar swapped to **Coming up**. The page measured 375 wide.
- A desk's width in dark.

Not shown, because no person had them that morning: **Then** and **Done today**. They need two tasks dated
today, or one already ticked.

**Left.** The owner's word on call 7. The card's pick is one quiet link to View as for a dev, which is not
built. Then retire the card.
