---
name: "The Lien desk on a phone: one list of jobs with the money and the days, in place of a header that takes the screen"
number: 352
group: close
status: the owner picked A, the one list, 2026-11-13 · the whole train is built and walked · PR 0 to PR 3 are on main (v2.7196, v2.7200, v2.7217, v2.7222) · PR 4 to PR 7 are open and armed (#8069, #8070, #8072, #8075) · left: the owner's look on his own phone
summary: >
  The owner used the Lien desk on his phone, recorded the screen and called it terrible. The desk
  was laid out for a wide screen: a fixed header, and a list that scrolls in a window under it. On
  a phone the header takes that window. On To do the lien month's five cards fill what is left and
  the rows sit in a window 26 px tall that is off the screen, so the work cannot be reached at all.
  On By paper seven header rows stay pinned and the list shows through about a third of the
  screen. Most presses are 20 to 30 px tall. The mock-up draws three whole directions on the same
  three moments: one list of jobs soonest first, the same desk made to fit, and a today card first.
  The owner picked the one list.
next: The owner opens the desk on his phone once PR 4 to PR 7 have merged and says what still reads wrong. Then this card is retired.
size: L as a train of eight, all built; left: a look, and three small residues named under Where it stands
blocker: None. PR 4 to PR 7 each merge on their own; the tab-rename PR #8038 is ahead of them in the merge queue and each gets main merged in after it lands.
---

# The Lien desk on a phone

Mock-up: [`mockup.html`](./mockup.html). Every name, address, count and amount in it is made up.
The sizes on its first three phones were measured on the live desk.

The desk's three views are named here as the owner renamed them the same day: **To do**, **By date**
and **By paper**. On the day of the recording and the walk they read *Do now*, *Deadlines* and
*All filings*, and the release notes of PR 0 and PR 1 use those names.

## The ask

Todd, 2026-11-13, with a screen recording from his iPhone: *"take a look at how the lien desk shows
up on mobile, this is terrible and needs a lot of visual improvment. Help me come up with a solution
that"*. The message ended there. He was asked to finish the sentence twice and went on without
it: he picked a direction, then said to build the whole train.

## What the recording showed

Six and a half seconds, Safari on an iPhone, **By paper → Affidavits**. He scrolled the list of
affidavits that are ready to file, up and down, and did not open a row.

- The desk's own header stayed pinned the whole time, in seven rows: the way back, the title and
  Share; the three views and § Rules; the caller and the help key; the four kinds of paper; two pile
  chips; *An owner asked for records*; the search box.
- The list moved in a window under it, about a third of the screen, four rows at a time.
- The note above the list slid half hidden under the search box as he scrolled.
- When the Home Screen banner at the top closed, a grey band its height was left above the app's
  bottom bar.
- The row text is small, and the chips are too tight to press with a thumb.

He was not on **To do**, the view the desk opens on. The walk below says why that may be.

## What the walk measured

A read-only walk of the live desk on 2026-11-13, in a headless phone browser signed in as the dev,
at 320 × 520, 390 × 720 and 430 × 780. Every write was refused at the network. Nothing was pressed
that sends, prints, approves or files.

| How tall the working window is | 320 | 390 | 430 |
|---|---|---|---|
| To do, the rows | 0 | 0 | 0 |
| By date, the list | 126 px | 290 px | 350 px |
| By paper → Notices, the list | 72 px | 236 px | 296 px |
| By paper → Affidavits, the list | 79 px | 268 px | 328 px |
| One notice, the paper (4,943 px long) | | 153 px | |
| The run window, its body (5,574 px long) | | 266 px | |
| A job's Lien window, its body (4,607 px long) | | 119 px | |

- **The To do view cannot be worked on a phone.** The header is 181 px in six rows. The lien month is
  544 px in five stacked cards. The find box and sixteen step tiles follow. The first row of work
  is 1,526 px down, inside a list whose window is 26 px tall and below the bottom of the panel.
  Pressing a month card’s *Show … liens* narrows a list nobody can scroll to. The layout is a grid
  of `auto auto minmax(0, 1fr)` in `LienDesk.tsx`: the month takes its full height and the list
  gets what is left, which on a phone is nothing.
- **A To do row is about 225 px** once reached: a kind chip and a date, the job, four named step
  tiles, a line of words and a full-width button. It carries no amount. The affidavit list's rows
  do, and that is the list the recording went to.
- **Presses are small.** Of 26 presses on the first screen, 18 are under 44 px. The view tabs and
  the paper tabs are 20 px tall, the pile chips 22, the find box 24, *Record the mailing* and
  § Rules 25, the help key 26.
- **Words are small.** Most are 11 to 13 px. Pile heads are 9.9 px.
- **No page slides sideways** at any width. Three strips inside it do: the paper tabs at 390 and
  under (Timeline is cut off), the By date pills, and an open notice's pane, whose section heads
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

**My pick was A, and the owner picked A** (*"Build A, one list"*, 2026-11-13). The recording is a person looking for a list of jobs with the money and the days,
and A makes that the first screen. B is the safe half of A, and their first two PRs are the same, so
starting on A loses nothing if B turns out to be enough. C's headline is worth keeping, and A takes
it as the month line.

## The train for A

Each PR is behind the phone layout the desk already has (`layout: 'stacked'`), ships its guide
change, release note and fragment, and is walked at phone and computer width.

| PR | What | Size | Where |
|---|---|---|---|
| 0 | **The desk scrolls as one page on a phone.** The To do rows are in reach and the grey band is gone. The same in all three directions. | S | The panel grid and the To do grid in `LienDesk.tsx`; the height in `LienDeskPage.tsx` |
| 1 | **One header row and the More sheet.** § Rules, the caller, the help key, Share, *An owner asked for records* and *Put a GC on notice* move into it. | S | New kernel for which doors show and in what order; the title bar's phone branch |
| 2 | **The month as one line, the cards as a sheet.** The line says the day's headline. The step tiles sit in the sheet. | M | New kernel for the line's words over the month's zones; `LienMonthBar.tsx`, `LienDeskSteps.tsx` |
| 3 | **The phone row, grouped by the day it is due, with chips.** Two lines: the job and the amount, then four dots, the state and the GC, and the press. | M | New row kernel over the To do rows; `LienDeskNextUp.tsx` phone branch |
| 4 | **The job screen.** The due line, the four steps, the doors, and one pinned press that calls what the row's button calls today. | M | New component; no new write |
| 5 | **By date and By paper in the same rows.** The kinds of paper and the piles are chips. The notary's print box moves into More. | S | `LienDeskCalendarTab.tsx`, the list columns in `LienDesk.tsx` |
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
- The live desk at three phone sizes: To do, a pressed month zone, a pressed step and its brief,
  By date, By paper → Notices and one notice, Affidavits and one affidavit, the run window,
  § Rules, Share, and a job's Lien window on its three tabs. Reads only.
- The mock-up in light and in dark, at computer width and at 390 wide: no script errors, no
  sideways slide, no press in the new frames under 40 px.
- Not checked: To do on the owner's own phone. The recording does not show that view. The zero is
  a measurement in a headless browser at phone sizes, and the layout code agrees with it.

## Where it stands

The owner picked A on 2026-11-13 and later said to build the whole train. His cut-off sentence was never finished; he chose to go on without it.

Every PR was walked on the dev server against live data at 320, 390 and 430 wide, reads only, with every write refused at the network, and compared at 1,400 × 900 with the live desk box for box. No PR moved anything on a computer.

| PR | Version | State | What it did, measured at 390 × 720 |
|---|---|---|---|
| 0 | v2.7196 | On main | The first view scrolls as one page. The rows were out of reach; they are in reach. No grey band. |
| 1 | v2.7200 | On main | One header row with More. The header is 114 px on To do and By date (was 181) and 173 px on Notices and Affidavits (was 235 and 207). |
| 2 | v2.7217 | On main | The lien month is one line, its five cards a sheet; the step rails are one folded row. The first row of work is 408 px down (was 1,526 px and unreachable). |
| 3 | v2.7222 | On main | Rows grouped by the day they are due, with the money. A row is 112 px (was about 225) and says what its job owes. |
| 4 | v2.7234 | Open, #8069 | A tap on a row opens the job as its own screen: when the paper is due, the four steps, doors to the paper, the Lien window and the job, and the row's press pinned at the foot. The phone's Back closes it. |
| 5 | v2.7236 | Open, #8070 | The Notices list pins one pile title in place of five (room for rows 209 → 308 px; at 320 wide, none → 89). No row of tabs slides sideways. The find box is 44 px with 16 px words. |
| 6 | v2.7238 | Open, #8072 | An open notice, affidavit or retainage notice has the screen: a one-row header with the way back to its list, one pinned section title, no sideways slide, and a footer that folds. An open affidavit had no way back to its list at all. |
| 7 | v2.7242 | Open, #8075 | The Lien window and the run window fill the screen. The Lien window's header folds as the paper scrolls (168 → 491 px of paper). The run's six steps are one line (266 → 446 px of list), and its fields no longer zoom an iPhone. |

What the build did differently from the table above, each recorded in its fragment:

- **PR 2.** The step tiles are a folded row above the rows, not a button inside the month's sheet.
- **PR 3.** A row is three lines and 112 px, not two and 69, so the press keeps its exact words. The chips over the list were left out: the views stayed tabs.
- **PR 4.** *Add the filed copy* is not a door on the job's screen. It is a write, and the Lien window's door leads to it.
- **PR 5.** By date already had a phone layout of its own, and the three lists' rows already carry the job, the money and the state, so they were not rebuilt onto the first view's row. The kinds of paper are two-line tabs, not chips: chips that wrap made the pinned header taller.
- **PR 6.** The paper keeps its printed layout and slides inside its own frame. Section heads do not wrap; one pins in place of five.
- **PR 7.** The Lien window's header folds on a scroll, with a press of its own, in place of a fixed short header.

Three small things are left, none of them in the way of a look:

- **The notary's print box** on the Affidavits list is about 300 px at the top of the list on a phone. It scrolls away with the list. Folding it waits for the open PR that rewrites that bar (#8044).
- **Inside an open paper** many presses are 14 to 28 px: the gates, the months grid and the page's own edit marks are drawn for a computer.
- **The By job grid's own controls** (two pickers at 23 px, *Print the grid* at 25) belong to the PR that renames that view.

Three things the train taught:

- **A thumb-tall row makes a pinned header taller.** Whatever wraps goes into the list's own scroller. Measure the header after every change.
- **A stack of pinned titles is a table of contents on a computer and a wall on a phone.** The pile titles, the section titles and the footer each took the list's whole window on a small phone. One pins; the rest scroll.
- **The computer check that works** is to read the same boxes on the dev server and on the live desk at 1,400 × 900 and compare them. All eight PRs matched to the pixel.
