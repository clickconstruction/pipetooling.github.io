---
name: "Quickfill Mark history: the trend, not five rows"
number: 156
group: gated
status: proposed 2026-10-24 · waiting on the owner's pick
summary: >
  A station's Mark history window is five rows for the last seven days and a fold. The owner
  wants to read the habit: how often the station is marked, by whom, how many items were open
  each time and whether that number is falling, the days with no mark, the time of day, and
  the last few weeks. Three redraws are drawn in the checklist History tab's own grammar. The
  pick, A: the ledger's three tiles, one cell a workday for eight weeks with the open count in
  the cell, who and when under it, the rows kept for the detail and the Note column only when
  a note exists. Nothing new on the server.
next: The owner picks A, B or C and answers the three calls under Decisions, then one build PR.
size: S
blocker: The owner's pick.
ver: proposed
opinion: build A — the ledger's tiles, a cell a workday with the open count in it, who and when under it, the rows kept; B is one stroke that is blank on half the stations, C draws the number twice
---

# Quickfill Mark history: the trend, not five rows (#156)

## The ask

The owner, 2026-10-24, with a screenshot of Quickfill's *Mark history — Office Arriving*
window: *"in quickfill I do not like this detail and do not think it is verbose enough to show
trends, perhaps it should look more like the checklist history in the app. Would you be able
to help me come up with an improvement?"*

What he wants to read, in his session's words: how often the station is marked, by whom, how
many items were open each time and whether that number is falling, the gaps (days with no
mark), the time of day it tends to be done, and the same for the last few weeks, not five rows
and a fold.

## Today

Every station on Quickfill has a **Mark … up to date** button. Each press writes the station's
latest mark to `quickfill_section_marks` (one row a station) and a history row to
`quickfill_section_mark_events`: when, who, how many items were open at that moment, and a
note on the three stations that ask for one. The window
([`QuickfillSectionMarkHistoryModal.tsx`](../../src/components/quickfill/QuickfillSectionMarkHistoryModal.tsx))
opens from the chart icon in the station's header on a desk and from *📈 history* on the
phone's round and the Roller. It reads the last seven days and draws them as a table, When ·
By · Open items · Note, with *Earlier (all time)* folded under it, the same four columns when
opened.

Read live as the dev on 2026-10-24: five rows for Office Arriving, one person, open items 0 ·
0 · 0 · 3 · 3, every note a dash. The grey *Last marked: Oct 23, 9:54 AM* in the header is not
a press.

## What the checklist history shows

Read before drawing, so the redraw borrows a grammar instead of inventing one.

- **The phone ledger**
  ([`ChecklistHistoryLedger.tsx`](../../src/components/checklist/ChecklistHistoryLedger.tsx) over
  [`checklistHistoryLedger.ts`](../../src/lib/checklistHistoryLedger.ts)): three tiles, *This
  week* (done over due, Sunday to today), *Streak* (all-done days walking back, an unfinished
  today never breaks it), *Missed*; then the days newest first, *Today, Oct 24* · *Yesterday* ·
  *Mon, Oct 19*, each row a task with a chip: green *✓ 9:41 AM*, amber *✓ by Dana*, red
  *✗ Missed*, grey *Open*. A tap opens the row's events and a note box.
- **The desk grid** (the History tab in `Checklist.tsx` over
  [`checklistHistorySplit.ts`](../../src/lib/checklistHistorySplit.ts)): one row a repeating
  task, one 24 px cell a day for 60 days, green ✓ done, amber ✓ done by someone else, red ✗
  missed, a dashed box when nothing was due, a blue left border where the task was born, a
  2 px rule at each month, a rate at the row's end, and the day's status on hover.
- **The activity panel**
  ([`ChecklistItemActivity.tsx`](../../src/components/checklist/ChecklistItemActivity.tsx) over
  [`checklistManageActivity.ts`](../../src/lib/checklistManageActivity.ts)): one flat timeline,
  oldest first, created → completed → reopened → notes, each line *who · what · when*.
- **Age** is read in days by the company calendar, never by the clock.

The grammar to borrow: tiles for the habit, a cell a day for the pattern, rows for the detail.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/quickfill-mark-history/mockup.html`. Every
name, time and count on it is made up: Dana and Marisol mark the stations, and the counts
follow the shape of a real station without being one. Hover a cell for its day, time, who and
count. A switch under the Billed Awaiting Payment window shows the third tint.

### A · the ledger, for one station (the pick)

The three tiles: *This week 5 of 5 workdays*, *Streak 15 workdays*, *Missed 3 of 40*. Under
them one row a week for eight weeks, one cell a workday, and in the cell the number of items
open at the mark: green when nothing was open, amber when something was, a green ✓ when the
station has no count, a dashed box on a workday with no mark, no box on a weekend or a day
still to come, a blue ring on today. Hover or tap a cell: *Tue, Oct 20 · 9:37 AM · Dana · 3
open*. Under the grid, the habit line: who marks it and how often, the usual time of day with
a small band of the hours, and one sentence on the count. Then the rows as today, *Last 7 days*
with When · By · Open, the Note column only when a note exists, *Earlier (all time)* folded.

- Straightforward: the tiles are the ledger's, the grid is the History tab's grid turned on its
  side with the count in the cell, the rows are today's table. One pure kernel shapes the events
  into weeks, tiles and the habit line; the window draws them.
- Is this the best we can do: see below.

### B · a line of the open count, the marks as points

The three tiles, then a line: the days along the bottom, the open count up the side, one dot a
mark coloured by who, the line broken at a workday with no mark, a dotted line at the
station's usual count. Then the rows.

- Straightforward: one SVG, sixty lines.
- Is this the best we can do: no. On Office Arriving the line lies on zero and jumps to 3 a few
  times, so the eye reads the jumps, not the habit. The gaps are breaks a few pixels wide. The
  weekday is gone, so *every Monday* cannot be seen. On a station with no count there is nothing
  to draw, and 313 of the 2,177 marks on file carry no count. Where B shines, a station like
  Billed Awaiting Payment whose count fell from the seventies to fifty, A's numbers already say
  it row by row.

### C · the grid and the line together

A's window with B's line under the grid, for stations with a count.

- Straightforward: A plus B.
- Is this the best we can do: no. The same number is drawn twice, in a cell and as a dot. The
  window grows by a screen on a phone before the rows start. Half the stations get a blank band.

### The doors

Today the desk opens the window from the chart icon only. The grey *Last marked: Oct 23,
9:54 AM* beside it becomes the press too. On the phone's round and the Roller the count line
*3 open · last look 22h ago · Dana* gets the same press on its *last look* words; the *📈
history* link beside it stays.

## Side by side

| | Today | A · the ledger | B · the line | C · both |
|---|---|---|---|---|
| How often it is marked | count the rows | the tiles, the filled cells | the dots, crowded | the tiles, the cells |
| The gaps | a missing date | a dashed box on its weekday | a break a few pixels wide | the dashed box |
| Who marks it | a column | hover a cell, the habit line | the dot's colour, the habit line | both |
| The time of day | a column | the habit line and its hour band | the same | the same |
| Open items, and the trend | a column, five rows | the number in the cell, row by row | one stroke | twice |
| A station with no count | dashes | a green ✓ a cell | nothing to draw | the grid, then a blank band |
| The last weeks | seven days, then the fold | eight weeks in view | eight weeks in view | eight weeks in view |
| The Note column | always, mostly dashes | only when a note exists | only when a note exists | only when a note exists |
| Height on a phone before the rows | none | about one screen | about half a screen | a screen and a half |
| New code | none | one kernel with tests, the window redrawn | one kernel, one SVG | both |

## Is A the best we can do? Are we being straightforward?

1. **It borrows the grammar the owner already reads.** The tiles are the ledger's, the cells are
   the History tab's, the rows are today's table. Nothing on the window is a second language.
2. **Every question is one glance.** How often: the filled cells. The gaps: the dashed boxes, on
   their weekday. Who and when: the habit line. The count and its trend: the numbers in the
   cells, row by row, and the habit line's sentence.
3. **The count rule is the simplest true one.** Green means nothing was open, amber means
   something was, and the number says how much. The third tint, red above the station's usual,
   is the owner's call (Decisions, 2). The checklist draws a missed day as a red ✗; here a
   missed look is a dashed box, because a station with a slow rhythm would otherwise be a row
   of red.
4. **The due days follow the station's own rhythm**, the rule the strip already colours by
   (`sectionRhythmDays`, v2.3892): every workday for a daily station, a day every N for a slower
   one, so *Missed* never scolds a weekly station for Tuesday. No station has ever been marked on
   a weekend, so weekends are never due.
5. **The events already hold it** (next section), and nothing new is written anywhere.
6. **Left out, on purpose:** the line (B); a per-person table (the habit line carries the two
   names the data has ever seen); a switch between four and eight weeks (eight fits a phone,
   the fold holds the rest); the ledger's note box (a mark's note is written at the mark).

## The data: does `quickfill_section_mark_events` hold enough?

Read on prod 2026-10-24 through the pooler, counts only.

- **2,177 events on 33 stations** from 2026-04-02; nearly every station from 2026-04-15. Six and
  a half months, so eight weeks is well inside it and the fold has the rest.
- **Office Arriving: 121 marks on 120 days**, two people (one of them 119), one a workday, never
  on a weekend (no station has a weekend mark at all). The middle half of the marks fall between
  9:40 AM and 1:30 PM over the whole span; in the last eight weeks they fall between 8:35 and
  11:52. Three workdays with no mark in the last eight weeks (Labor Day among them). The count
  at the mark is 0 or 3, and 3 is every box of its three-box list; the monthly average fell
  from 2.6 in July to 0.4 in September and 0.6 in October, the fall the owner wants to see.
- **Notes: 528 of 2,177 events carry one**, all of them on the three note-first stations and the
  two retired email stations, every event of theirs; every other station has none. The Note
  column rule, shown only when a note exists, is exact.
- **313 events carry no count** (the stations whose header reads —). They draw as ✓.
- **A day with two marks** is rare (once on Office Arriving); the cell takes the last mark of
  the day and the hover names both.
- **A backfill from `quickfill_section_marks` adds nothing.** That table holds one row a station,
  the latest mark, 33 rows, and every one of them already has its event row. Marks before
  2026-04-02 were overwritten in place and are gone. Nothing to copy, no migration.

## Decisions for the owner

1. **The pick: A, B or C.** Recommended: A.
2. **The third tint.** Two tints, green for nothing open and amber for something, with the
   number in the cell. Or three, red when more was open than the station's usual over the eight
   weeks. Recommended: two; the number carries the rest. The mock-up's switch shows both.
3. **The doors.** The *Last marked* words on the desk and the *last look* words on the round
   become presses. Recommended: yes, the icon and the link stay.
4. **The span.** Eight weeks, or four. Recommended: eight; it fits a phone.

## Where it plugs in

- **The window:**
  [`QuickfillSectionMarkHistoryModal.tsx`](../../src/components/quickfill/QuickfillSectionMarkHistoryModal.tsx).
  Today `loadRecent` reads seven days and `loadOlder` the rest when the fold opens. The redraw
  reads the last eight weeks in the first query (a station holds at most about 40 events in
  eight weeks, the 500 limit stays) and keeps the fold's query. The body becomes tiles · grid ·
  habit line · rows · fold; the row's Note column renders only when the kernel says a note
  exists.
- **A new pure kernel**, `src/lib/quickfill/markHistory.ts` with tests beside it, the way
  [`round.ts`](../../src/lib/quickfill/round.ts) shapes the round: `markHistoryWeeks(events,
  todayYmd, weeks)` → eight rows of seven cells, each `{ ymd, kind: marked | gap | off,
  count, who, at }`, the day by the company calendar (`calendarYmdInAppTzFromIso`,
  `APP_CALENDAR_TZ`, [`dateUtils.ts`](../../src/utils/dateUtils.ts)); `markHistoryTiles(events,
  todayYmd, rhythmDays)` → this week, streak, missed, the due days from `sectionRhythmDays` in
  `round.ts`; `markHistoryHabit(events)` → per-person counts, the median hour and the middle
  half of the hours; `markHistoryTint(count, usual, thirdTint)` → none · some · many;
  `markHistoryHasNotes(events)`.
- **The cells:** the History tab's cell (24 to 28 px, radius 6) in theme tokens,
  `--bg-green-100` / `--text-green-800` for none, `--bg-amber-100` / `--text-amber-800` for some,
  `--bg-red-100` / `--text-red-700` for many, a dashed `--border-400` box for a gap, a
  `--text-link` ring for today; the hover title as the grid writes it. No raw hexes (CI).
- **The tiles:** the ledger's `statTile` style, copied (three lines); lifting it to a shared
  piece touches `Checklist.tsx` and is a later cleanup.
- **The doors:** in [`Quickfill.tsx`](../../src/pages/Quickfill.tsx) the wrapper's *Last marked:*
  span becomes a button on `onOpenHistory`, the prop the icon already calls; the round screen's
  count line is a string built in the page and passed to
  [`QuickfillRoundScreen.tsx`](../../src/components/quickfill/QuickfillRoundScreen.tsx), which
  already takes `onHistory`, so the *last look* words become a press on it.
- **The words:** the guide *run the office day with Quickfill*
  ([`quickfill.md`](../../src/content/help/quickfill.md), the line *The history icon shows who
  marked it recently*) rewritten in plain words; the Glossary's *Quickfill (page)* entry and
  [`QUICKFILL_ARCHITECTURE.md`](../../docs/QUICKFILL_ARCHITECTURE.md) (the page-level modals row
  and the marks dossier) name the kernel; a release note and its fragment. No new page, so the
  app directory is untouched.
- **Tests:** the kernel's unit tests (weeks across a month edge, a weekend mark, a day with two
  marks, the rhythm's due days, the hour band, the note rule) and a render smoke for the window
  with `renderWithProviders`; the modal has none today.
- **Nothing on the server.** The same two tables, read only.

## The plan

1. **PR 1, this folder** (docs only).
2. **PR 2, the build** (one version): the kernel and its tests; the window redrawn; the two
   doors; the guide line; the release note and fragment; the Glossary and architecture lines;
   this README to *built*.

## How to verify

Quickfill as the dev. On Office Arriving press the chart icon, then *Last marked* (the same
window). Eight weeks of cells, this week at the bottom with today ringed; hover a cell and read
the day, the time, who and the count; the three tiles agree with the cells. Open the window on
Texts: the Note column is back, every row with its note. Open it on Schedule: every cell a ✓.
Open *Earlier (all time)* and the older rows load as today. The phone preset: the cells grow to
34 px and nothing scrolls sideways. Dark mode: tokens only. Nothing is written by any of it.

## Where it stands

Proposed 2026-10-24. The window and the data were read live as the dev before drawing; nothing
built. Waiting on the owner's pick and the three calls under Decisions.
