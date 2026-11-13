---
name: "The Lien desk on a phone: one list of jobs with the money and the days, in place of a header that takes the screen"
number: 352
group: waiting
status: drawn 2026-11-13 · three directions in the mock-up · nothing built · waits on the owner's pick
summary: >
  The owner used the Lien desk on his phone, recorded the screen and called it terrible. The desk
  was laid out for a wide screen: a fixed header, and a list that scrolls in a window under it. On
  a phone the header takes that window. On Do now the lien month's five cards fill what is left and
  the rows sit in a window 26 px tall that is off the screen, so the work cannot be reached at all.
  On All filings seven header rows stay pinned and the list shows through about a third of the
  screen. Most presses are 20 to 30 px tall. The mock-up draws three whole directions on the same
  three moments: one list of jobs soonest first, the same desk made to fit, and a today card first.
  The pick is the one list.
next: The owner picks a direction on the mock-up. PR 0, the page scrolls as one page, is the same in all three and can go first.
size: L as a train of eight (S · S · M · M · M · S · S · S)
blocker: The owner's pick.
opinion: build — direction A; PR 0 is a plain fix and should not wait
---

# The Lien desk on a phone

Mock-up: [`mockup.html`](./mockup.html). Every name, address, count and amount in it is made up.
The sizes on its first three phones were measured on the live desk.

## The ask

Todd, 2026-11-13, with a screen recording from his iPhone: *"take a look at how the lien desk shows
up on mobile, this is terrible and needs a lot of visual improvment. Help me come up with a solution
that"*. The message ended there. He has been asked to finish the sentence. His answer goes here when
it comes.

## What the recording showed

Six and a half seconds, Safari on an iPhone, **All filings → Affidavits**. He scrolled the list of
affidavits that are ready to file, up and down, and did not open a row.

- The desk's own header stayed pinned the whole time, in seven rows: the way back, the title and
  Share; the three views and § Rules; the caller and the help key; the four kinds of paper; two pile
  chips; *An owner asked for records*; the search box.
- The list moved in a window under it, about a third of the screen, four rows at a time.
- The note above the list slid half hidden under the search box as he scrolled.
- When the Home Screen banner at the top closed, a grey band its height was left above the app's
  bottom bar.
- The row text is small, and the chips are too tight to press with a thumb.

He was not on **Do now**, the view the desk opens on. The walk below says why that may be.

## What the walk measured

A read-only walk of the live desk on 2026-11-13, in a headless phone browser signed in as the dev,
at 320 × 520, 390 × 720 and 430 × 780. Every write was refused at the network. Nothing was pressed
that sends, prints, approves or files.

| How tall the working window is | 320 | 390 | 430 |
|---|---|---|---|
| Do now, the rows | 0 | 0 | 0 |
| Deadlines, the list | 126 px | 290 px | 350 px |
| All filings → Notices, the list | 72 px | 236 px | 296 px |
| All filings → Affidavits, the list | 79 px | 268 px | 328 px |
| One notice, the paper (4,943 px long) | | 153 px | |
| The run window, its body (5,574 px long) | | 266 px | |
| A job's Lien window, its body (4,607 px long) | | 119 px | |

- **Do now cannot be worked on a phone.** The header is 181 px in six rows. The lien month is
  544 px in five stacked cards. The find box and sixteen step tiles follow. The first row of work
  is 1,526 px down, inside a list whose window is 26 px tall and below the bottom of the panel.
  Pressing a month card’s *Show … liens* narrows a list nobody can scroll to. The layout is a grid
  of `auto auto minmax(0, 1fr)` in `LienDesk.tsx`: the month takes its full height and the list
  gets what is left, which on a phone is nothing.
- **A Do now row is about 225 px** once reached: a kind chip and a date, the job, four named step
  tiles, a line of words and a full-width button. It carries no amount. The affidavit list's rows
  do, and that is the list the recording went to.
- **Presses are small.** Of 26 presses on the first screen, 18 are under 44 px. The view tabs and
  the paper tabs are 20 px tall, the pile chips 22, the find box 24, *Record the mailing* and
  § Rules 25, the help key 26.
- **Words are small.** Most are 11 to 13 px. Pile heads are 9.9 px.
- **No page slides sideways** at any width. Three strips inside it do: the paper tabs at 390 and
  under (Timeline is cut off), the Deadlines pills, and an open notice's pane, whose section heads
  are 539 px wide in 374 px so the fact at the right end is cut.
- **The grey band** is the page's height, worked out once from the top of the desk
  (`LienDeskPage.tsx`). It is not worked out again when the banner above closes.
- **At 320 the app's own top bar wraps to two rows**, which costs every page 46 px. That is the
  app's, not the desk's, and is not in this card.

## The diagnosis

A person on a phone wants three things from this desk: to see what is due, by when and for how
much; to open one job; and to record one thing on it. Drafting a notice, reading a paper and
printing a run are computer work. The recording fits that: a man scanning jobs with their money and
their days.

The phone desk today is the computer desk with its columns stacked. It keeps a fixed header and an
inner list because a wide screen needs them. It spends the first screen on orientation (the month,
the steps, the tools) and gives the work what is left. The fix is not smaller chips. It is to let
the page scroll, to keep one header row, and to make the first screen the jobs.

## The directions

All three share a floor: the page scrolls as one page; one header row with the way back, the title
and **More**; every press 44 px or taller and job names at 16 px; the amount on every row; and no
change at computer width.

| | A · One list | B · Made to fit | C · Today first |
|---|---|---|---|
| The idea | The views and the kinds of paper become chips over one list, soonest first. The month is one line that opens as a sheet. A job opens as its own screen with one big press. | The desk keeps its three views, its month and its rows. The header drops to two rows, the month to one strip, the steps to one fold. | A card names today's pile and what rides on it. One press starts it, and the jobs come one at a time. The lists sit behind a door. |
| First screen | Five jobs with money and days | The month strip and two jobs | One headline and one press |
| Gives up | The month as a picture always in view. The three views as places. | Nothing, and so it still has three views, four papers and the piles on a small screen. | Seeing the whole desk first. It trusts the desk to pick the pile. |
| Cost | L, eight small PRs. One row kernel, one job screen, the rest layout. | M, five small PRs. Layout only. | XL. A kernel that picks the day's pile, a stack with skip and back, and A behind the door. |
| Risk | Low. Every press opens what it opens today. | Lowest | Highest. A wrong headline hides real work. |

**The pick is A.** The recording is a person looking for a list of jobs with the money and the days,
and A makes that the first screen. B is the safe half of A, and their first two PRs are the same, so
starting on A loses nothing if B turns out to be enough. C's headline is worth keeping, and A takes
it as the month line.

## The train for A

Each PR is behind the phone layout the desk already has (`layout: 'stacked'`), ships its guide
change, release note and fragment, and is walked at phone and computer width.

| PR | What | Size | Where |
|---|---|---|---|
| 0 | **The desk scrolls as one page on a phone.** The Do now rows are in reach and the grey band is gone. The same in all three directions. | S | The panel grid and the Do now grid in `LienDesk.tsx`; the height in `LienDeskPage.tsx` |
| 1 | **One header row and the More sheet.** § Rules, the caller, the help key, Share, *An owner asked for records* and *Put a GC on notice* move into it. | S | New kernel for which doors show and in what order; the title bar's phone branch |
| 2 | **The month as one line, the cards as a sheet.** The line says the day's headline. The step tiles sit in the sheet. | M | New kernel for the line's words over the month's zones; `LienMonthBar.tsx`, `LienDeskSteps.tsx` |
| 3 | **The phone row, grouped by the day it is due, with chips.** Two lines: the job and the amount, then four dots, the state and the GC, and the press. | M | New row kernel over the Do now rows; `LienDeskNextUp.tsx` phone branch |
| 4 | **The job screen.** The due line, the four steps, the doors, and one pinned press that calls what the row's button calls today. | M | New component; no new write |
| 5 | **Deadlines and All filings in the same rows.** The kinds of paper and the piles are chips. The notary's print box moves into More. | S | `LienDeskCalendarTab.tsx`, the list columns in `LienDesk.tsx` |
| 6 | **An open notice or affidavit.** Section heads wrap, the paper fits the width, the act bar is pinned. | S | The pane in `LienDesk.tsx`, `LienDeskAffidavitPane.tsx` |
| 7 | **The Lien window and the run window.** The header folds on a phone so the body has the room. | S | `LienInstrumentsModal.tsx`, the run window |

Papers keep counsel's words. No PR changes what a paper says, what a press writes or who may press
it.

Open PRs on these files on 2026-11-13, to check again before each PR: #8000 (`LienDesk.tsx`, the
affidavit pane), #7999, #8004 and #8010 (`LienInstrumentsModal.tsx`, `LienFilingTabs.tsx`, and
#8010 also `LienDeskPage.tsx`). PR 0 waits for #8000 and #8010 or rebases on them. PR 7 waits for
the three on the Lien window.

## What was checked

- The recording, frame by frame.
- The live desk at three phone sizes: Do now, a pressed month zone, a pressed step and its brief,
  Deadlines, All filings → Notices and one notice, Affidavits and one affidavit, the run window,
  § Rules, Share, and a job's Lien window on its three tabs. Reads only.
- The mock-up in light and in dark, at computer width and at 390 wide: no script errors, no
  sideways slide, no press in the new frames under 40 px.
- Not checked: Do now on the owner's own phone. The recording does not show that view. The zero is
  a measurement in a headless browser at phone sizes, and the layout code agrees with it.

## Where it stands

Drawn, not built. The owner picks A, B or C on the mock-up, or says what to change. His cut-off
sentence may change the pick, so it is asked for first.
