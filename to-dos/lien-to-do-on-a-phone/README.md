---
name: "The Lien desk's To do on a phone: the flow on one screen with a way back, and one press at the right of every row"
number: 428
group: ready
status: asked by the owner 2026-11-23, first *show me that on mobile and let me know if we should improve it*, then the flow as a new priority · looked at live by hand at 430 px the same day, read in the code and drawn twice · the owner picked the flow's shape, *One screen, pinned line*, and gave the go for all of it the same day, *Awesome, I like it, let's do it. Please build everything we talked about today* · the rows and the tiles built in v2.8341, proved by render tests and not yet seen on a phone · the flow is not built yet
summary: >
  The Board ›, the Dashboard's door to the Lien desk, lands on To do. On a phone that screen opens
  cleanly: four tiles, the bins folded, one list by the day each paper is due. The rows are where it
  is uneven. A phone sizes each press to its words, so the press is a different width on every row,
  it has a line to itself under the words, and on a row with two presses the main one jumps to the
  left. A computer's rows already keep one press column. The mock-up gives a phone the same: words
  at the left, one press at the right, every press one size, the second way out as a quiet line, and
  No day set said once.
next: The flow's first PR: the counts drawing and the switch between **By day** and **The flow**. Before it, one look by hand at the rows on a phone.
size: M as a train of three for the flow (M · M · S), not built; the rows and the tiles, built (S); left: the flow
blocker: none
ver: v2.8341
opinion: build the flow — the owner named it a priority, picked its shape and gave the go, it changes no act and no data, and two of its pieces exist already
---

# The Lien desk's To do on a phone (#428)

The mock-up is [`mockup.html`](mockup.html). Every job, name, count, date and amount on it is made up.
The repo is public, so nothing below or on the mock-up is copied from the live app.

## The ask, in the owner's words

2026-11-23, after picking the Dashboard's Lien desk card (punch list #423):

> When a user clicks on open board, they are brought to the to-do list. Can you show me that on mobile
> and let me know if we should improve it by showing me mockups?

The same day, about the Needs you rows, the rule this card borrows:

> On a phone, I think that these buttons should be much more uniform and we should move them all to the
> right hand side because people will read from left to right. So that way on the left they'll see what
> they need to do and on the right they'll know what to click.

## In three lines

1. **What it does well.** It opens cleanly: four tiles, the bins folded away, and one list by the day each paper is due, with the money on every day.
2. **What I would change.** The rows. One press at the right of every row, one size. The second way out under the words. *No day set* said once.
3. **What is picked.** All of it, on the owner's go of 2026-11-23. The rows and the tiles are built in v2.8341, with the three shorter presses as drawn. The flow's shape is picked, one screen with a pinned line as the way back, and is the next thing to build.

## What the look found

Looked at by hand on the worktree's dev server as the dev: `/lien-desk` at 430 by 932 in dark, twice,
and once at 375 by 812 in light, each load more than 15 seconds after the last, the tab closed after.
No figure or name from those looks is written here. The list held about thirty rows in five groups and
ran a little over four screens under the Board.

**Good as it stands.**

- No sideways scroll. The header and the four tabs stay pinned, and one day heading at a time.
- The Board is 315 px: four tiles two by two, one wide print press, the bins folded.
- The list is by day, soonest first, each heading with its count, the time left and the money
  (`lienPhoneGroups`, `src/lib/jobs/lienPhoneRows.ts`, punch list #352).

**What is uneven.** The numbers match the pins on the mock-up.

| # | What | Where |
|---|---|---|
| 1 | The press is a different width on every row, 69 to 241 px | `PHONE_PRESS` in `LienDeskNextUp.tsx:71`: *as wide as their words*, `whiteSpace: 'nowrap'` |
| 2 | The press has a line to itself, with the paper's chip and the dots. A row is 111 to 171 px | the phone row's last line |
| 3 | On a row with two presses the main one jumps to the left. *Not lienable…* takes the right side and the main press wraps to a line of its own | `secondary(r)` draws a second button with the same `PHONE_PRESS`, `LienDeskNextUp.tsx:266` |
| 4 | Row presses are 40 px tall, not 44 | `minHeight: 40` in `PHONE_PRESS` and in `lienPaperDoorStyle`, `:58` |
| 5 | *No day set* is a heading twice | `lienPhoneGroups` draws two pools one after the other, and each pool ends with its rows that have no day |
| 6 | The first tile's words leave one word alone on a line, and the two **Show them ›** doors sit in different corners | `Tile` in `LienBoard.tsx:287`, `:293` and `:311` |
| 7 | The same row many times, one for each filed lien, with the same words and the same press | the owner's run, punch list #362. Not redrawn here |

**A computer already has the answer.** Its rows keep one column for the press, 172 px wide whatever the
press says, with longer words wrapping inside it (`ROW_PRESS_PX`, `LienDeskNextUp.tsx:65`), and the
quieter button follows the question it answers so the last column keeps one button. The phone was
given presses as wide as their words in punch list #352, PR 3.

## The After

- **One press column.** 116 px wide and 44 px tall on every row, 100 px wide at 320 px. Words wrap
  inside it.
- **The second way out is a quiet line under the words.** *Not lienable…* and *Take back…* become a
  link 32 px tall at the left. The main press never moves.
- **The money moves to the row's last line, at the right.** The amounts then stand in a column beside
  the presses. The chip and the dots share that line. The chip still opens its paper.
- ***No day set* once, last.**
- **The tiles.** The day on one line and its parts on the next. Each **Show them ›** ends the line it
  acts on.
- **Three presses take shorter words on a phone, as drawn.** *Answer the homestead question* becomes
  *Answer it*, *Open the property record* becomes *Open the record*, *Fix the property record* becomes
  *Fix the record*. The line above each already says which question or which record, and the press
  keeps its whole words as its name.

Measured on the mock-up's thirteen rows: the list is about 1,880 px before and about 1,680 px after. A
row with a long sentence gets taller, since its words have less room. The gain is the press in one
place, not the height.

## The flow on a phone, out and back in

The owner, later on 2026-11-23:

> What has become a priority to me, which was not previously a priority, is showing the flowchart in
> Liens To Do and giving the user the ability to jump out of the flow chart and jump back in if they
> need to. How could I offer this on mobile? It seems like a difficult quandary for me.

The second mock-up is [`flow.html`](flow.html). Made-up counts and jobs, as above.

**Why it is hard.** The flow is a wide picture: two columns of eight bins, arrows down each and one
across from *Sent* to *Waiting on its notice* (`lienBoardArrows`, `src/lib/jobs/lienBoard.ts`). On a
phone the bins stack into one column of about 2,050 px behind **Show the bins**, with chips 22 px tall.
A bin's rows are in the list under all of it, so a person who presses a bin's name scrolls two screens
down to the work and two back up to the flow.

**The recommendation, three parts.**

1. **The flow as counts.** Each stage is one press 44 px tall with its name and its count, no chips. Both
   columns then stand side by side with the arrow across, about 450 px tall. A job's number is no use as
   a chip on a phone, where the card that names the job needs a pointer.
2. **A switch of its own.** **By day** and **The flow** share the place of **Show the bins**. In the
   flow's view the four tiles stand down, since three of them are stages of the flow already, and the day
   with its red line stays as one line over it. The whole flow is then on one screen: it ends about
   830 px down a 932 px phone on the mock-up.
3. **Out, and back in.** A press on a stage makes its papers the screen, and the flow shrinks to one
   pinned line: **‹ The flow**, the stage's name, and eight squares for that column's eight stages with
   the one you are in lit. A press on another square moves along the flow without going back. A press on
   a row opens the job as it does today, with the line still pinned in its short form. **‹ The flow**, or
   the phone's own Back, returns one step at a time, and the flow opens with the stage still lit.

What exists already: a pick that narrows the list to one bin, with the words *Showing 6 rows in … Show
every row* (`lienBoardPickWords`), and a job's own screen on a phone with Back (punch list #352). What
is new: the counts drawing, the switch, the pinned line, and keeping the place.

**The other idea, drawn.** The flow as a strip of stages pinned over the list by day, sliding sideways.
You never leave the list, so there is nothing to come back to. It gives up the picture: about three
stages show at a time, and the two columns and the arrow are gone.

**Not drawn.** The flow as a fifth tab. Five tabs do not fit a phone's width at a thumb's size.

**The pick.** The owner, 2026-11-23: *One screen, pinned line.* The strip is set aside.

**Three smaller calls, with the default the build takes until he says otherwise.**

| Call | Default |
|---|---|
| Whether To do opens on the flow or on the list by day | The list by day the first time, as today. After that the phone opens on the view last used |
| Whether a computer changes | No. A computer keeps the Board with its bins and chips |
| Whether the tiles stand down in the flow's view | Yes, as drawn. They are on **By day** |

**The flow's train, three PRs.** Each claims its version when it starts.

1. **The counts drawing and the switch (M).** A phone's Board draws its two columns as stages with
   counts, side by side, with the arrow across, in the place of the folded bins. **By day** and **The
   flow** switch between it and the list. `LienBoard.tsx` and the desk's phone branch, with a kernel
   for a stage's count and tone and its tests. The guide `read-the-board-on-the-lien-desk` gets its
   section on a phone.
2. **The pinned line (M).** A press on a stage narrows the list to it through the pick that exists,
   scrolls the list to its top and pins the line: the way back, the stage's name and the column's eight
   squares. A press on a square moves the pick.
3. **The place kept (S).** The line stays, short, on a job's own screen. Back walks job, stage, flow,
   and the flow opens with the stage lit.

The rows' redraw above is built (v2.8341), so the flow's second screen has the rows the mock-up draws.

## What it does not touch

- What any press does, and anything on a computer.
- The repeated rows of row 7. They are the run of punch list #362.
- The open bins: about 2,050 px in one column, with chips 22 px tall. Named in punch list #423's card.
  A card of its own if the owner wants it.
- The header, the tabs, the fold, the find box and the day headings.

## Where it stands

**Built, v2.8341 (one PR): the rows and the tiles.** A phone's row is two columns with one press 116 px
wide and 44 px tall at the right, 100 px wide at 360 px and under (`lienPhonePress.ts`, mirrored by
`.lienPhoneRow` in `index.css`). The second way out is a quiet line under the words. The amount is on the
words' last line. *No day set* is one group, last (`lienPhoneRows.ts`). The three long presses take their
short form on a phone. On a phone the day tile's label is two lines and a tile's door ends its line
(`lienBoardPhoneTile.ts`). A computer is as it was.

Two things differ from the mock-up. A run's list of jobs is the row's last line across both columns,
not between its words, so an open list has the row's whole width. The paper's chip is still 40 px tall
with its fill, where the mock-up draws it smaller.

**Proved by** the kernels' tests and the render tests. **Not yet seen on a phone.**

**Not built:** the flow, three PRs, under *The flow on a phone* above.

## How to verify

- The render tests, then one look by hand at 430, 375 and 320 px, dark and light: every row's press is
  one width and 44 px tall, no row has a press at the left, and `innerWidth` equals `scrollWidth`.
- At a desk, the same rows read as they did before v2.8341.

## Not looked at

- The list as a leader sees it. The look was as the dev.
- The other three views of the desk, and the job screen a row opens.
- 320 px on the live page.
