---
name: "See a person's Task Mode from Review"
number: 381
group: ready
status: asked 2026-11-17 · looked at, designed, drawn and rendered the same day · seven calls put to the owner, each with a pick · nothing built yet
summary: >
  On Checklist → Review the owner opens a person's card and sees their open tasks as a list. He asked for a
  press there that opens a window showing what that person's phone shows in Task Mode, with their current
  tasks and what is coming up. This card adds that press and that window. The window is a look: he stays
  signed in as himself, it reads with the read the office already has, and no press inside it works. It
  draws Today with the same code the person's phone runs, so the two cannot drift apart.
next: The owner's word on the seven calls, then step 1, Today's reads taking the person as a value.
size: M as a train of five (M · M · M · S · XS)
blocker: The owner's picks. Each call has a default.
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
line and the access line.

| Step | What lands | Database | Size | State |
|---|---|---|---|---|
| 1 | Today's reads take the person as a value, in one tested place under `src/lib/tasks/`. Today draws the same. | none | M | not started |
| 2 | Today's look-only mode: every act dead, a card still opens. The page's render tests prove the doer's Today is unchanged. | none | M | not started |
| 3 | The window and the press on Review. Guide, Glossary, `ACCESS_CONTROL.md`. | none | M | not started |
| 4 | Coming up: the next 7 days from dated tasks and repeat rules. | none | S | not started |
| 5 | The walk: the window beside the real Task Mode for one test account. | none | XS | not started |

## How to verify

- As the owner or a dev, open Checklist → Review and open a person's card. The press sits beside
  *＋ Add task for*. An assistant sees the board with no such press.
- Press it. The window's phone shows the date, the green sentence, Next, Then, Done today and Still open
  for that person, and Coming up lists the next 7 days.
- Press **Mark done** inside the window. Nothing happens, and the person's task stays open.
- Sign in as a sample account in a second browser, turn Task Mode on, and hold the two side by side. The
  lists match line for line.

## Where it stands

Designed and drawn. The calls are with the owner. Nothing is built.
