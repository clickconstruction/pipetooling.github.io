---
name: "Quickfill Mark history: the trend, not five rows"
number: 156
group: close
status: built 2026-10-24 · the owner's yes, build it all · v2.5817 the kernel, v2.5819 the window with its boxes band, v2.5826 the doors on the Last marked and last look words
summary: >
  A station's Mark history window is five rows for the last seven days and a fold. The owner
  wants to read the habit: how often the station is marked, by whom, how many items were open
  each time and whether that number is falling, the days with no mark, the time of day, and
  the last few weeks. Three redraws are drawn in the checklist History tab's grammar on the
  two stations he sent, Office Arriving and Assistant Dailys. The pick, A: the ledger's three
  tiles, one cell a workday for eight weeks with the open count in the cell, who and when under
  it, on a station with boxes a band of the boxes' own ticks, the rows kept for the detail and
  the Note column only when a note exists. Nothing new on the server.
next: The doors land (PR #6106), then the owner's look at it live, then delete the folder.
size: S
blocker: none
ver: v2.5817, v2.5819
opinion: build A — the ledger's tiles, a cell a workday with the open count in it, who and when under it, the boxes' own ticks as a band, the rows kept; B is one stroke that is blank on half the stations, C draws the number twice
---

# Quickfill Mark history: the trend, not five rows (#156)

## The ask

The owner, 2026-10-24, with a screenshot of Quickfill's *Mark history — Office Arriving*
window: *"in quickfill I do not like this detail and do not think it is verbose enough to show
trends, perhaps it should look more like the checklist history in the app. Would you be able
to help me come up with an improvement?"* Then a second screenshot, the Roller on **Assistant
Dailys** with its five boxes and the history icon beside *5 open · last look 22h ago*: *"this
one too."* So the redraw is for the one window every station opens, and these two stations are
the worked examples.

What he wants to read, in his session's words: how often the station is marked, by whom, how
many items were open each time and whether that number is falling, the gaps (days with no
mark), the time of day it tends to be done, and the same for the last few weeks, not five rows
and a fold. On the two stations with boxes, a checked box records who did it and when, so the
trend can also show the boxes' own history: which boxes get ticked, by whom, at what hour,
which one is always left.

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

**Office Arriving** is three boxes (the shades, the lights, the mopping), cleared overnight by
the company calendar, with *Edit checklist* for a dev. **Assistant Dailys** is five boxes for
whoever is in, one shared set for the team, cleared overnight; *Checking a box records who did
it*, and the page shows the name beside a ticked box. Both stations report their open count as
the boxes not ticked today.

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

The grammar to borrow: tiles for the habit, a cell a day for the pattern, one row a task when
there are tasks, rows for the detail.

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
a small band of the hours, and one sentence on the count. On a station with boxes, one more
band, **The boxes**: one row a box, the last four weeks of workdays as cells, ticked of due,
the time and who on hover, and under the strip the boxes left unticked most days. Then the
rows as today, *Last 7 days* with When · By · Open, the Note column only when a note exists,
*Earlier (all time)* folded.

- Straightforward: the tiles are the ledger's, the grid is the History tab's grid turned on its
  side with the count in the cell, the boxes band is that grid the right way up, the rows are
  today's table. One pure kernel shapes the events and the ticks into weeks, tiles, the habit
  line and the band; the window draws them.
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
  it row by row. The boxes band fits under B as well, but a line cannot say which box.

### C · the grid and the line together

A's window with B's line under the grid, for stations with a count.

- Straightforward: A plus B.
- Is this the best we can do: no. The same number is drawn twice, in a cell and as a dot. The
  window grows by a screen on a phone before the rows start. Half the stations get a blank band.

### The doors

Today the desk opens the window from the chart icon only. The grey *Last marked: Oct 23,
9:54 AM* beside it becomes the press too. On the phone's round and the Roller the count line
*5 open · last look 22h ago · Dana* gets the same press on its *last look* words; the *📈
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
| The boxes, on a station that has them | not read | a band, one row a box | the band, under a line that cannot name a box | the band |
| The last weeks | seven days, then the fold | eight weeks in view | eight weeks in view | eight weeks in view |
| The Note column | always, mostly dashes | only when a note exists | only when a note exists | only when a note exists |
| Height on a phone before the rows | none | about one screen, more with boxes | about half a screen | a screen and a half |
| New code | none | one kernel with tests, the window redrawn | one kernel, one SVG | both |

## Is A the best we can do? Are we being straightforward?

1. **It borrows the grammar the owner already reads.** The tiles are the ledger's, the cells are
   the History tab's, the boxes band is the History tab's own one-row-a-task grid, the rows are
   today's table. Nothing on the window is a second language.
2. **Every question is one glance.** How often: the filled cells. The gaps: the dashed boxes, on
   their weekday. Who and when: the habit line. The count and its trend: the numbers in the
   cells, row by row, and the habit line's sentence. Which box is always left: the band.
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
6. **The boxes are read where they are**, and the band says plainly which of two facts each
   number is: the cell is what was open at the moment of the mark, the band is what was still
   ticked at the end of the day. On Office Arriving the two disagree on most days (next section),
   and a window that showed only one of them would mislead.
7. **Left out, on purpose:** the line (B); a per-person table (the habit line carries the two
   names the data has ever seen); a switch between four and eight weeks (eight fits a phone,
   the fold holds the rest); the ledger's note box (a mark's note is written at the mark); the
   boxes band on the phone's narrow width (the band is a desk band, the phone keeps the tiles,
   the grid and the rows, Decisions 5 says why).

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
- **Assistant Dailys: 42 marks on 41 days** since 2026-08-25, the station's first day, one
  person, one a workday; the count at the mark is 1 on 32 of the last 37 looks and 0 on the
  other five.
- **Notes: 528 of 2,177 events carry one**, all of them on the three note-first stations and the
  two retired email stations, every event of theirs; every other station has none. The Note
  column rule, shown only when a note exists, is exact.
- **313 events carry no count** (the stations whose header reads —). They draw as ✓.
- **A day with two marks** is rare (once on Office Arriving); the cell takes the last mark of
  the day and the hover names both.
- **A backfill from `quickfill_section_marks` adds nothing.** That table holds one row a station,
  the latest mark, 33 rows, and every one of them already has its event row. Marks before
  2026-04-02 were overwritten in place and are gone. Nothing to copy, no migration.

## The boxes' own history: where the ticks live, and whether the window should read them

**Where.** Not in the Checklist system. Each station with boxes has a table of its own, made
for it: `quickfill_office_arriving_daily_checks` (migration `20260510215603`) and
`quickfill_assistant_dailys_daily_checks` (`20260825153602`), both `(item_id, work_date,
checked_at, checked_by default auth.uid())`, one row a box a company day. A tick inserts the
row, an untick deletes it, and the page reads today's rows only. The box labels live in
`app_settings` as JSON (`quickfill_office_arriving_items`, `quickfill_assistant_dailys_items`,
id and label), edited by a dev under *Edit checklist*. *Difficult people* has the same shape
(`quickfill_difficult_people_daily_checks`, its items in a table). **Office Leaving has no
history at all**: its one box is a done map in `app_settings.quickfill_office_leaving_done`,
so its window shows the grid alone. The office roles that open Quickfill can already read
these tables (RLS SELECT for dev, master and assistant-like).

**What they hold.** Assistant Dailys: 170 ticks on 41 days since 2026-08-25, every one by one
person; four of the five boxes are ticked on every marked day within the same minute, a tenth
of a minute before the mark; the fifth box, the one that reads *when leaving* on a morning
list, is ticked on 6 of 41 days. So the *1 open* the count records on the other days is the
same box every time, and only the rows can say so. Office Arriving: 58 ticks on 56 days since
2026-05-11; one box 56 times, the other two once each, on 2026-10-23.

**The two facts disagree on Office Arriving, and the build found why.** On 53 marks the count
read 0 open while the rows hold one ticked box of three for that day; on 49 marks it read 3
with no row at all. The count was right. Removing a box from the list deletes every tick it
ever had (`onRemoveItem` deletes by `item_id` alone), and a box added again gets a new id, so
the lights and mopping boxes, first ticked on Oct 23, are the second versions of boxes whose
past was deleted. Nothing audits the list, so the day is inferred. The window counts each box
from its first tick on record, as the checklist grid starts a task at its birthday.

**Should the window read them?** Yes, for the three stations with a daily-checks table, as
the band drawn in A: one row a box, the last four weeks of workdays as 12 px cells, ticked of
due, the time and who on hover, and under the strip *Left unticked most days: …* naming the
boxes below half. Two more reads when the station has such a table (`work_date >= start`, with
the `users:checked_by(name)` join the Assistant Dailys page already uses) and the items JSON
for the labels. Nothing written, no new table.

## Decisions for the owner

1. **The pick: A, B or C.** Recommended: A.
2. **The third tint.** Two tints, green for nothing open and amber for something, with the
   number in the cell. Or three, red when more was open than the station's usual over the eight
   weeks. Recommended: two; the number carries the rest. The mock-up's switch shows both.
3. **The doors.** The *Last marked* words on the desk and the *last look* words on the round
   become presses. Recommended: yes, the icon and the link stay.
4. **The span.** Eight weeks, or four. Recommended: eight; it fits a phone.
5. **The boxes band.** Read the ticks for the three stations that keep them and draw the band,
   on the desk only (a 375 px phone holds the tiles, the grid and the rows; the band's twenty
   cells a row would push the rows two screens down). Or leave the boxes out and let the count
   stand. Recommended: read them; the band names the box the count only counts.

## Where it plugs in

- **The window:**
  [`QuickfillSectionMarkHistoryModal.tsx`](../../src/components/quickfill/QuickfillSectionMarkHistoryModal.tsx).
  Today `loadRecent` reads seven days and `loadOlder` the rest when the fold opens. The redraw
  reads the last eight weeks in the first query (a station holds at most about 40 events in
  eight weeks, the 500 limit stays) and keeps the fold's query. The body becomes tiles · grid ·
  habit line · the boxes band when the station has one · rows · fold; the row's Note column
  renders only when the kernel says a note exists.
- **A new pure kernel**, `src/lib/quickfill/markHistory.ts` with tests beside it, the way
  [`round.ts`](../../src/lib/quickfill/round.ts) shapes the round: `markHistoryWeeks(events,
  todayYmd, weeks)` → eight rows of seven cells, each `{ ymd, kind: marked | gap | off,
  count, who, at }`, the day by the company calendar (`calendarYmdInAppTzFromIso`,
  `APP_CALENDAR_TZ`, [`dateUtils.ts`](../../src/utils/dateUtils.ts)); `markHistoryTiles(events,
  todayYmd, rhythmDays)` → this week, streak, missed, the due days from `sectionRhythmDays` in
  `round.ts`; `markHistoryHabit(events)` → per-person counts, the median hour and the middle
  half of the hours; `markHistoryTint(count, usual, thirdTint)` → none · some · many;
  `markHistoryHasNotes(events)`; `markHistoryBoxes(items, ticks, workdays)` → one row a box
  with its cells, its rate and the *left unticked* list.
- **The boxes' reads:** a small map in the window from station id to its daily-checks table
  and its items key (`office-arriving`, `assistant-dailys`, `difficult-people`); no station
  outside the map asks. The ticks' `work_date` is written with `denverCalendarDayKey` by the
  two pages, a day key of its own, so the band keys its cells on `work_date` as stored and
  never recomputes the day from `checked_at`.
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
  marks, the rhythm's due days, the hour band, the note rule, a box ticked on some days and a
  box never ticked) and a render smoke for the window with `renderWithProviders`; the modal has
  none today.
- **Nothing on the server.** Four tables, read only.

## The plan

1. **PR 1, this folder** (docs only).
2. **PR 2, the build** (one version): the kernel and its tests; the window redrawn with the
   band; the two doors; the guide line; the release note and fragment; the Glossary and
   architecture lines; this README to *built*. One look at Office Arriving's count against its
   boxes with the page open, and a line in the fragment saying what was found.

## How to verify

Quickfill as the dev. On Office Arriving press the chart icon, then *Last marked* (the same
window). Eight weeks of cells, this week at the bottom with today ringed; hover a cell and read
the day, the time, who and the count; the three tiles agree with the cells; the boxes band
shows three rows, two of them nearly empty, and names them under the strip. Open the window on
Assistant Dailys: five rows in the band, four full and one nearly empty, the *1 open* cells
above it. Open it on Texts: the Note column is back, every row with its note. Open it on
Schedule: every cell a ✓, no band. Open it on Office Leaving: the grid, no band. Open *Earlier
(all time)* and the older rows load as today. The phone preset: the cells grow to 34 px, no
band, nothing scrolls sideways. Dark mode: tokens only. Nothing is written by any of it.

## Where it stands

Proposed 2026-10-24; the owner's yes the same day, *"build it all"*, A as drawn with the
recommended calls (two tints, the doors, eight weeks, the band on the desk). Built: v2.5817
the kernel with its tests; v2.5819 the window (the tiles, the grid, the tap line, the habit
line, the boxes band on the desk with each box counted from its first tick, the rows with the
Note rule). The band was planned as a PR of its own and folded into the window's before either
was pushed, since stacked on the window it would have needed a hand merge after the window's
squash. Left: the doors on the *Last marked* and *last look* words, PR #6106, cut from main on
its own; then the owner's look at it live and the folder deleted. Found on the way, not
changed here: removing a box from a station's list deletes its whole tick history.
