---
name: "The Bridge as a pulse"
number: 334
group: close
status: asked and walked 2026-11-12 in a spike on the Bridge, on live data · the owner said to build the whole train · PRs 1 to 8 are live on clicktooling.com and were walked there, read only, 2026-11-13 · PR 2's migration is pushed · a final walk of the whole page found one fault of the train's own, fixed in v2.7137 · PRs 9 to 12 are built and open
summary: >
  The Bridge is the owner's one page for where the company stands. It asked him to make a call once a
  week, hand the moves to people, and answer on Friday whether the numbers moved. He said the page should
  be a pulse: always the current state, with nothing to record. So the weekly call comes off. The card
  becomes What to do now. Each line on it is one specific thing with its own press, and a check that hands
  it to one person as a to-do card. Beside it the page gains a cash balance, an accrual balance and a
  runway in days. The train also carries what the last Bridge train left out: the list of what the Bridge
  leaves out, the Build, Bill and Collect windows on the shared frame, the Market window's breakouts, a
  supply house card that leads with its bills, and the hours on a job with no percent.
next: PR 9, the check on every line, once #7873 is on main. Then PRs 10, 11 and 12 in order, each migration pushed right after its merge, and a walk on the live site after each.
size: L as a train of twelve (M · M · S · M · M · S · M · L · M · S · S · S)
blocker: PR 9 waits for #7873, from the new task window's train, #331. Both change the window that makes a task, so #7873 goes first and PR 9 takes it in. Nothing else blocks the train.
opinion: build — the owner walked every part on live data and said to build it all. PR 7 is the one that changes what the page is.
mockup: not required — every part was built on a spike and walked by the owner on the live page, 2026-11-12
---

# The Bridge as a pulse (#334)

## The ask

All of this was asked on 2026-11-12, on a spike, while the owner used the page on live data. His words are
paraphrased here. The repo is public, so nothing below is a real name or a real figure.

### The page is a pulse

- He asked why Friday should ask whether the numbers moved. The page should already say so. It should
  always show the current state, like a pulse.
- He pressed *Make this the week's call* once to see what it did. That was the first call ever recorded,
  weeks after the flow shipped. He had it undone.
- He did not like moves handed to people in the open, as a group, in vague words. He said to take the
  call off, and then to take its line off Needs you as well.

So the weekly call comes off with everything that hangs on it. The card that held it stays. Its name is
*What to do now*.

### What to do now

- He said the card was hard to dive into and gave him nothing to act on.
- Each line should be one specific thing. A customer to call. A project's bill. A job with no percent. A
  supply house with bills due on a day.
- Each thing gets its own press that opens the place to act on it.
- A press that only opened the Jobs page was no help, so it went. Each job has *Set the percent* instead.
- For each customer he wants the day they said they would pay, project by project. A press writes a new
  day down. The app's own pay date window does the writing.
- He wants each thing given straight to one person as a to-do card. The card must be exact: who, what, how
  much, a link to the thing, and what done looks like.
- He liked how the card worked and not how it looked. He chose a drawing where each move is a heading with
  its lines as a table.

### The check

He asked for a check on every line, and said yes to each of these:

- Grey when nobody has the thing. Press it to make the to-do.
- Blue while a to-do is open. The person's name and the to-do's age sit beside it.
- Amber when the to-do has waited too long.
- After a finish the line names who finished it and when. Then the check is grey again.
- A press on a blue check opens a window with the task, the person and the day it was given.
- A customer's line counts how many of its projects are handed out. A project under an open customer to-do
  reads *covered*.

### Cash, accrual and runway

- He said the red band *Under the floor today* was not productive. It folds into *Made last week*.
- He asked for a cash balance beside an accrual balance. His rule for accrual: the bank, plus what
  customers owe, less what the company owes, less payroll. What is owed to subs comes off too.
- He asked for the runway in days beside both. It counts payroll and overhead and nothing else.
- He asked for the slowest step to sit left of the balances.

### What the Bridge leaves out

Some work should not move the page's numbers. The owner keeps a list of the developments the Bridge leaves
out, with a picker to change it. The list was built and walked on the earlier spike, and the last train
left it for later. With the list on, the page reads differently. On the spike the lit step moved.

### The windows on one frame

The last train put the Market and Sales windows on one shared frame. Build, Bill and Collect were rebuilt
on the same frame on the spike and did not ride along. They ship here. The header also says which weeks
the page reads.

### The Market window's breakouts

- He asked to press either of the window's two amounts and see what makes it up. Each amount opens its own
  window.
- Then he asked to open any row and see the bids or the estimates behind it, by name. Each one is a link
  to that bid or estimate.
- He saw test estimates in those lists. Test estimates now stay out of the won rate, as test bids do.

### The supply house card

- He opens a supply house to see its invoices and to mark some of them paid.
- He refused a design that ticks several bills and marks them together. Each bill is marked paid by itself.
- So the invoices lead the card and the job accounts fold under them.
- Unpaid bills are grouped by the day they are due, with a count and a total for each day.
- A row leads with the job. *Mark paid* changes the row where it sits. The row stays listed for the visit,
  greyed, with *Mark unpaid*.

### Hours on a job with no percent

He asked that each job under the percent move say how many hours were worked on it, and by whom. A press
opens a window with each person's hours and days, then the work day by day. Its foot has *Set the percent*.

## The train

Step 0 is this card. The twelve PRs are one stack, and only the bottom PR is armed. PR 5 touches no Bridge
file, so it is cut from `main` beside the stack. Each PR claims its own version and ships its release note,
its fragment and its guide edit.

1. **Build, Bill and Collect on the shared window frame.** The three windows move to the frame Market and
   Sales use. The header gains the line *reads the last 8 weeks, since …*.
2. **What the Bridge leaves out.** The list, its reads, its picker, and the wiring into the page's figures.
   With it: a migration for the owner's role, and no real development's name in the code.
3. **Test estimates leave the won rate.** An estimate for a ZZ test customer is in no count, on the page
   and in the weekly email's reads.
4. **The Market window's breakouts.** Press an amount to see what makes it up. Open a row to see its bids or
   estimates by name.
5. **The supply house card.** Bills first, grouped by due day, each marked paid where it sits. Four summary
   numbers lead the card.
6. **Cash balance, accrual balance and runway.** The balances tile, the new order of the three tiles, and
   the red band folded into *Made last week*.
7. **The Bridge is a pulse.** The call comes off. That is the record press, the name chips, the note and
   *Pick another step*. Friday's question, the last call's tile and the scorecard go too, and so does the
   Needs you line. The card is named *What to do now*.
8. **What to do now names its things, as tables.** Each move is a heading with a table of its lines. A
   customer opens the Collect window on that customer. A project has *Set a pay date*. A job has *Set the
   percent*. A supply house opens on its due day.
9. **A check on every line.** The check, its window, and the to-do card written for one thing. The Add task
   window learns to carry *Done when…* lines and to ask for no photo.
10. **Hours on the jobs with no percent.** The hours line, the window behind it, and the Hours and Worked
    by cells in the table.
11. **The Monday email without the call, and the database tidied.** The call section leaves the weekly
    email. The two database functions behind the Needs you line are dropped. Only after PR 7 is live.
12. **The to-do's tag as its own column.** Optional, and last. A column on the to-do row holds the tag in
    place of a word in the card's first link.

## What never ships

The spike kept the old drawings beside the new ones so the owner could compare. None of that ships:

- The three comparison switches on the page's address: `?cash=band`, `?call=plain` and `?call=handover`.
- The code only those switches reach. That is the hand-over drawing with its name chips, *take off*, the
  record press and the note. It is also the old rows of prose under a move, which the table replaced.
- `callPress.ts` and `callUndo.ts`, with their tests. They renamed and undid a press that no longer exists.
- The earlier spike's hand-off notes in `to-dos/bridge-one-story/`. They stay out unless a PR needs them.
- The snapshot itself. It is never pushed, because one file in it names a real development.

## What the train owes outside the merges

A merge deploys the client and nothing else. These are owed by hand, each after its PR is on `main`.

### Three migrations

| With | What | When to push |
|---|---|---|
| PR 2 | The owner's role may save the settings row that holds the left-out list. The row is already in the live database. | Right after PR 2 merges. Until then only a dev can change the list. |
| PR 11 | Drop the two functions behind the Needs you line, `bridge_my_moves` and `bridge_mark_my_move_done`. | Only after PR 7 is live, since the client before PR 7 still calls them. |
| PR 12 | A column on `checklist_items` for the to-do's tag, filled from the tag in each card's first link. | Right after PR 12 merges, if PR 12 is built. |

Each one follows the migration rules in `CLAUDE.md`. It opens with the lock timeout and carries a claimed
filename. It has a page under `docs/migrations/`. It is applied with `supabase db push` from `main` alone.

### Function redeploys

Several Bridge kernels are copied to the edge functions. A PR that edits one runs `npm run gen:edge-kernels`
in the same PR. After its merge, `npm run check:edge-drift` names what to redeploy from `main`.

- **PR 2**: the left-out rule is a copied kernel.
- **PR 3**: `bridge-weekly-sheet`, whose reads now skip test estimates.
- **PR 4**: the two won-rate kernels now return which bids and estimates sit behind each count.
- **PR 7**: the kernel that names who holds a move loses half of itself.
- **PR 11**: `bridge-weekly-sheet` again, without its call section. Dry-run it and read the mail before the
  redeploy.

### The guide and the docs

- `src/content/help/the-bridge.md` changes with each PR that changes what a reader sees. The sections on
  the week's call come off with PR 7. The plain-words test holds every sentence.
- `GLOSSARY.md` and `PROJECT_DOCUMENTATION.md` lose the call and the Needs you line with PR 7. They gain
  *What to do now*, the check, the balances and the left-out list as each ships.
- `docs/EDGE_FUNCTIONS.md` follows the weekly email in PR 11.

## The defaults assumed

The owner was not asked about these. Each is the builder's reading. Say so if one is wrong.

- **The Monday email loses its call section.** With no call to record, the section would be empty every
  week. The rest of the email is as it was.
- **The calls table stays, empty.** Dropping it gains nothing, and the one test call on it was undone.
- **A to-do turns amber after three days.** When the card has a due day, amber starts the day after it.
- **A finished to-do stays named on its line for 14 days.** After that the line forgets it.
- **The accrual balance takes off the coming payroll as an estimate.** It is the same estimate the cash
  forecast spends.

## Where the work is

- The whole spike is one snapshot, held as a ref in the lead session's checkout on one computer. It is not
  on GitHub and must not be pushed.
- A builder reads a file from the snapshot and brings it onto a branch cut from `main`. The train's plan
  names the files of each PR.
- `main` has moved on since the snapshot. It merges clean except for five Needs you files, where `main`
  added sources beside the lines the spike removed. Redo the removal on `main`. Do not merge those by hand.
- Before a file from the snapshot is committed, read it for real names. The left-out list's default is the
  known one.

## How to verify

- **The tests**: `npx vitest run src/lib/bridge src/components/bridge`. Every sentence a kernel prints is
  held to the plain-words rules.
- **The checks each PR owes**: `npm run typecheck`, the theme check, and the press, batch, empty and error
  word checks. Run `npm run build` when a glob or an asset import changes.
- **The page**: start the dev server and sign in as a dev on live data. Read only. Press nothing that
  records.
- **The widths**: walk each PR at 375, 768 and 1400 px, in light and in dark.
- **The check's colours**: no real tagged to-do exists yet, so every check on the live page is grey. Picture
  the blue, amber and finished states by answering the to-do reads with made-up cards in a test browser.

## Gotchas

- **The repo is public.** Made-up names and figures only, in tests, notes, commits and PR text.
- **`Mark paid` writes to the live books.** No builder pressed it on the spike. The first real press is the
  office's.
- **The pay date window and the percent window write too.** Each was opened on the spike and nothing was
  saved.
- **Until PR 12, the check finds its to-do by a tag in the card's first link.** A person who deletes that
  link loses the check on that line.
- **Opening the to-do from a blue check was not walked.** It needs a real tagged card, and none exists yet.
- **Long job names are cut short in the table at narrow desk widths.** The full name is the cell's title.
- **Other trains are near PR 8.** The pay calendar, #323, and Bills sent, #327, touch pay days and bills.
  Run `npm run sessions` before building it.
- **Do not run a formatter on existing files.** They keep long lines, and a formatter rewrites whole files.

## Found while building, not built

Two faults turned up while PRs 2 and 3 were built, and two more on the final walk of the live site. Each is
bigger than a fix on the way or belongs to another part of the app, so each waits here.

- **A dev who shows ZZ test jobs loses some of them once the left-out list names anything.** Every read on
  the page takes one set of job ids. With no list, this dev's reads get no set, and every ZZ job stays. With
  a list, the set holds the left-out jobs, and each read takes any set to mean *leave the ZZ jobs out*. So
  ZZ jobs and bids leave the pipe, the step windows and the people tables. The won rates are already right.
  The fix gives each read two things in place of one: the ZZ switch, and the ids to leave out. It touches
  every loader the page has. A dev who hides ZZ jobs, the default, sees none of this. Nobody else does
  either.
- **ZZ test estimates still count in the asks and in the Market and Sales lists.** PR 3 took them out of the
  won rate alone, which was the ask. Market's count of asks and the two windows' own lists of estimates
  still count a test estimate for a viewer who hides tests. The bids follow the switch everywhere already.
  The rule PR 3 added would bring the estimates in line.
- **On a phone the page scrolls sideways once Money owed is open.** At 375 px wide the page grows to 404 px
  once the accrual balance's press opens Money owed behind the Money door. It did the same before the train,
  so it belongs to Money owed. A layout fix there would end it.
- **The pay date window does not close with Escape.** *Write down their word* closes by its own *Cancel*
  alone. The other windows on the Bridge close with Escape. It is the app's own window and is used beyond
  the Bridge, so the fix belongs to it.

## Where it stands

Asked, built on a spike and walked by the owner on 2026-11-12. He called it satisfactory and said to build
the whole train. On 2026-11-13 PRs 1 to 8 reached `main` and the live site. Each was walked there, read
only. PR 2's migration is pushed, and every function those PRs touched is current.

A final walk of the whole page on the live site followed, at 1400 px in light and dark and at 375 px. The
page matches what the owner approved on the spike, short of PRs 9 and 10. It found one fault of the train's
own, fixed in v2.7137: on a phone the name that leads each line was a press only 16 px tall. It found two
more that belong elsewhere, listed under *Found while building, not built*.

PRs 9 to 12 are built and open, each on the one before it. PR 9 waits for #7873, as the blocker above says.
PR 11's migration drops the two functions behind the old Needs you line. PR 12's adds the tag's column. Each
is pushed right after its merge, and PR 11's comes with a small PR that takes the two functions out of the
generated types.

Not walked on purpose, because each one records. The first of each is the owner's or the office's:

- The first save of the left-out list.
- The first *Mark paid* on a supply house's bill.
- The first pay date or percent saved from *What to do now*.
- The first to-do handed out from a grey check, once PR 9 is live.

Still open, and not the builder's to answer:

- **The five defaults above.** Each ships as written unless the owner says otherwise.
- **What *the scaling function* means.** It is the owner's aim behind the Bridge work, and it is still
  open on #321.
