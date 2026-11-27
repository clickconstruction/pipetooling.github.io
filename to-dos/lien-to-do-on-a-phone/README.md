---
name: "The Lien desk's To do on a phone: the flow on one screen with a way back, and one press at the right of every row"
number: 428
group: close
status: asked by the owner 2026-11-23, first *show me that on mobile and let me know if we should improve it*, then the flow as a new priority · looked at live by hand at 430 px the same day, read in the code and drawn twice · the owner picked the flow's shape, *One screen, pinned line*, and gave the go for all of it the same day, *Awesome, I like it, let's do it. Please build everything we talked about today* · the rows and the tiles built in v2.8341 and looked at by hand at 430 px · the flow built in v2.8346, the switch, the counts, the pinned line and the phone's Back · both live 2026-11-23, and both looked at by hand at 430 px in dark on a dev server · walked in an iPhone simulator 2026-11-25: the rows hold, and two things added since stand in the way of the flow, written under *Walked in a simulator* · the three calls the walk left were answered 2026-11-25 (UTC) in the managing session, so the phone mend is ready to build · the phone mend is built 2026-11-25: Payoffs and the pinned line in v2.8575, the Add Task line in its own pull request 9829 · not walked yet
summary: >
  The Board ›, the Dashboard's door to the Lien desk, lands on To do. On a phone that screen opens
  cleanly: four tiles, the bins folded, one list by the day each paper is due. The rows are where it
  is uneven. A phone sizes each press to its words, so the press is a different width on every row,
  it has a line to itself under the words, and on a row with two presses the main one jumps to the
  left. A computer's rows already keep one press column. The mock-up gives a phone the same: words
  at the left, one press at the right, every press one size, the second way out as a quiet line, and
  No day set said once.
next: A simulator walks the phone mend once it is live, at 402 by 874 points: count the stages a column on one screen with **The flow** pressed, press a stage and read its first rows under the pinned line, scroll and watch Payoffs leave with the list, open the desk from `?payoffs=1`, and look at 1280 px that nothing moved. Then Todd opens the Lien desk on his phone, tries the flow and the way back, and says what reads wrong. Then this card is retired.
size: M, built: the rows and the tiles (S) and the flow (M, one PR in place of the three planned); the phone mend (S), built in two PRs; left: a walk of the mend in a simulator (XS) and a look on a phone (XS)
blocker: none. The look on a real phone was taken off on Taunya's words of 2026-11-27 (*looks that only a real phone can give, we can skip them*).
ver: v2.8341, v2.8346, v2.8575
opinion: close — built and live; what is left is seeing the flow under a thumb
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

**Built in one PR, v2.8346, in place of the three planned.** The three steps did not stand apart: a flow
with no way out of it is no use, and the way back is the history entry. What is built:

1. **The counts drawing and the switch.** A phone's Board draws its two columns as stages with counts,
   side by side, with the arrow across, in the place of the folded bins. **By day** and **The flow**
   switch between it and the tiles (`lienBoardFlow.ts`, `LienBoardPhoneFlow.tsx`, `LienBoard.tsx`).
2. **The pinned line.** A press on a stage narrows the list through the pick that existed, brings the
   page to its top and pins the line: the way back, where the stage stands, the column's cells and the
   bin's own press. A press on a cell moves the pick. The list's day headings stick under the line.
3. **The place kept.** The page keeps the stage in the history entry beside the open row. Back walks
   job, stage, flow, and the flow opens with the stage lit.

Four things differ from the mock-up. The switch stands at the top of the Board in both views, so it does
not move when pressed. The line's small words use a comma, *Monthly notices, stage 4 of 8*. The pinned
line is not drawn on a job's own screen: Back from the job returns to the stage with the line pinned.
And a tile's pick keeps the line under the tiles it always had.

## What it does not touch

- What any press does, and anything on a computer.
- The repeated rows of row 7. They are the run of punch list #362.
- A job's own screen. The pinned line is not drawn on it.
- The header, the tabs and the find box.

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

**Proved by** the kernels' tests and the render tests, then looked at by hand on a dev server as the dev at
430 by 932 in dark: every row's press 116 by 44 px at one right edge, the quiet lines 32 px tall, one *No day
set* group, the three short words, and the tiles' doors on their lines. Not on a real phone.

**Built, v2.8346 (one PR): the flow.** Under *The flow on a phone* above. **Proved by** the kernel's
tests and the render tests, the page's history among them. Then looked at by hand on a dev server as the
dev, one page load at 430 by 932 in dark:

- The switch, both presses 44 px tall.
- The flow: 16 stages, each 44 px, the two columns side by side with the arrow across, its foot 793 px down
  a 932 px screen, no sideways scroll.
- A stage pressed: the pinned line with its eight squares, 45 by 44 px, and that stage's own press, and the
  history one entry longer.
- The line held its place while the list scrolled, with the day heading stuck under it.
- A square moved to its stage with no new history entry.
- **‹ The flow** returned to the flow with the stage lit.
- A job opened from a stage, then Back twice: first to the stage's papers under the line, then to the flow
  with the stage lit.

Not on a real phone.

## How to verify

- The render tests, then one look by hand at 430, 375 and 320 px, dark and light: every row's press is
  one width and 44 px tall, no row has a press at the left, and `innerWidth` equals `scrollWidth`.
- At a desk, the same rows read as they did before v2.8341.
- The flow, by hand at 430 and 375 px: **The flow** shows both columns with no sideways scroll, a pressed
  stage pins the line with its rows right under it, the day headings stop under the line, a cell moves
  the stage, **‹ The flow** and the phone's Back return to the flow with the stage lit, and Back from a
  job opened from a stage returns to that stage.

## Not looked at

- The list as a leader sees it. The look was as the dev.
- The other three views of the desk, and the job screen a row opens.
- 320 px on the live page.

## Walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, as the dev, on the live site. It is a simulator and not a real phone, so the owner's look on his own phone still stands. Nothing was pressed that saves.

**Holds.** On some thirty rows the words are at the left and one press is at the right, at one width and one right edge. The second way out is a quiet line. Another square moves the pick with no new step in Back. A job opened from a stage, then Back twice: first the stage's papers under the line, then the flow with the stage lit.

**Two faults found, read in the code the same day. Neither is built. Each turned on a call, and all three calls were answered on 2026-11-25 (UTC) in the managing session.** Each answer is quoted from that session's record of the user's answers.

1. **The flow no longer stands on one screen.** This card measured both columns of stages on one screen. The walk saw 5 of 8 stages a column, with the list in a window of about 355 of 874 points.
   - Two things stand above the desk's own header. The orange banner about the Add Task icon, about 56 points, is older than this card and shows in Safari until it is dismissed (`AddTaskShortcutBanner`). The **Payoffs** strip with **Someone paid ›**, about 85 points, came the day after this card's measure (v2.8504, punch list #435). It is the first row of the desk's page and never scrolls (`LienDeskPage.tsx`), and it shows whenever any filed lien exists.
   - The call: on a phone, does Payoffs stay pinned on every view of the desk, scroll away with the list, or shrink to a chip? And should the banner show anywhere but the Dashboard? Each mend is the client alone, XS to S.
   - **Answered 2026-11-25.** Asked *Where should the Payoffs strip stand on a phone?*, the answer was "It scrolls away with the list (Recommended)". The other ways were a chip in the desk's header row, and pinned as today.
   - **Answered 2026-11-25.** Asked *On a phone without the new layout switched on, where should the orange Add Task banner show?*, the answer was "On the Dashboard alone (Recommended)", as the new phone layout already has it. That line is the app's shell and not the Lien desk, so it changes every page on such a phone. Card #398's walk met the same banner.
2. **A pressed stage's rows are not right under its line.** The pinned line is right. Under it come the find box, then the *This run* line with **Get it right ›**, then the rows (`LienDesk.tsx`). *This run* came the day after this card's measure too (v2.8474). So one row's first line shows at the foot of the screen.
   - The call: while a stage is picked on a phone, do the find box and *This run* stay, move under the rows, or go? The mend is the client alone, XS to S.
   - **Answered 2026-11-25.** Asked *While a stage is picked on a phone, what should stand between the pinned line and its rows?*, the answer was "Nothing (Recommended)". The find box and *This run* come back when the stage is let go.

**What the three answers free.** One PR, the client alone, size S by the fix brief's estimate, with no migration and no function. It cites this card, the newer of the two, and edits #352 too. Done looks like: at 402 by 874 points with **The flow** pressed both columns of stages stand on one screen, or the PR says how many do and why. A pressed stage's first rows stand right under its pinned line. A desk at 1280 px is unchanged. **What they leave open:** nothing of the three. The look on a real phone still stands.

**Built 2026-11-25, in two PRs, the client alone.** Neither is walked yet.

- **Payoffs scrolls away with the list** (v2.8575). On a phone the strip is the first thing inside whichever list is on the screen: To do, By date, By job and the three By paper lists. A computer keeps it in its own row over the desk.
- **Nothing under the pinned line** (v2.8575). With a stage picked the find box and *This run* are not drawn. They come back when the stage is let go.
- **The Add Task line on the Dashboard alone** (pull request 9829). On a phone with the new layout off, the line stands above the header on the Dashboard and on no other page. A wider screen keeps it on every page.

Where the build went past the answers, each said in its fragment:

- A find box that holds words stays while a stage is picked. Those words still narrow the rows, so a person must see them.
- Payoffs is not drawn while a stage is picked. A picked stage brings the page to its top, and a strip there would push the rows down again.
- Payoffs is not drawn over an open paper or a job's own screen, where no list is up. It is at the top of the list on the way back.
- On the three By paper lists the find box stays pinned over the list, and the strip is the first thing under it.

**Not measured:** how many stages a column stand on one screen at 402 by 874 points. The strip's 85 points now leave with the first scroll and the Add Task line's 56 are gone from the desk. The walk counts them.

**Seen, and it is as built.** Under a Monthly notices stage the list also held an affidavit's row with **Enter mail numbers**. A picked stage narrows the list to its jobs, and every row of a picked job is in (`lienBoard.ts`). The affidavit's job has a notice in that stage.

**For the three calls of this card:** To do opened on the list by day the first time, and on **The flow** once the flow had been used.
