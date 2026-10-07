---
name: "The phone-width pass: every surface the four rounds touched, at 375px"
rows: round five's last piece (the lead's list of surfaces)
branch: spike/phone-pass (from origin/spike/gc-mode at 629022510)
status: built 2026-10-06 on spike/phone-pass (Helper 1) and merged into spike/gc-mode at aa4359814. Five defects found and fixed, each measured before and after in the browser. Pinned by GcPhonePass.render.test.tsx (8 tests, 14 pins broken on purpose). No words changed. The lead's three calls sit where each question does, under A desk, Left out and the last section.
---

# The phone-width pass

## How I measured

- **The phone.** The dev server on my port (5301), and the browser pane's phone preset: 375×812, touch,
  a phone's user agent. Every GC component asks `(max-width: 640px)`, which is true at 375.
- **Four numbers on each surface**, from a script in the page:
  - **doc**: the document's scroll width. It must stay 375.
  - **out**: anything past the screen's edges with no scrolling box around it.
  - **cut**: any text that ends in "…" or is clipped by its box (its scroll size past its client size).
  - **presses**: any button, link or field off the screen.
- **The chart draws only the rows in view**, so for the chart the script scrolls it from top to bottom with
  every trade open, and gathers every row.
- **Before and after use the same state and the same script.** I put the files back to the branch's head,
  measured, then restored mine and checked them byte for byte against a saved copy.

## The walk

Clean means doc 375, nothing out, nothing cut, and every press on the screen.

| Surface | What I did | At 375 |
|---|---|---|
| The Schedule tab, List | Fair Oaks, with Show spare days, Show people on site, Hide the links and Open all, each on | clean |
| The Schedule tab, Chart | the same toggles, every trade open, places kept | **D1**, **D2**, **D4** |
| The opened bar and the split window | opened Lighting, then Split into parts and Split it | clean, then **D3** once split |
| By company's call list and the Follow up sheet | | clean |
| Print the chart and Export | | clean |
| What if | the line, one move tried, the Keep the what-if window | clean |
| Where the work is and its window | the Places card, its window, Keep these places | clean (the chart's lane is **D4**) |
| Days back and the late-finish lines | Fair Oaks made late: $500 a day for a late finish, Trim moved 7 days for the customer, Test and balance 9 days for weather. The late finish, Ask for the days, Days back and what they are worth, the finish outlook, the Get days back window, and the Bill tab's Finish date card | clean |
| The Milestones card and Bring in their dates | the card, and the window with the sample file's 6 dates | clean |
| The Templates card | | clean |
| The Daily log tab | the morning list. Helotes's log against the chart (a draft from Oct 5, started anyway, then a log on Oct 2 with 3 of the plumber's people), in the Daily log card and under the chart | clean |
| Bill the customer's forecast and the Money tab's six weeks | What we expect to bill, and The next 6 weeks | clean |
| Bill the customer, what the customer sees | Your schedule | **D5** |
| The rough on Boerne | before and after Draw a rough schedule | clean, and again with the final code |
| Helotes's Bring in their schedule | the window with the sample (13 activities), then its chart | clean. The chart cuts 1 name (below) |
| The trade's portal | Summit: the home, the job page, Tell Click your crew count (People a day), and We will be late. Brightline's start reminder (its Electrical starts Fri Oct 9, in 7 days) on the home, in Their messages and in Spanish | clean |

## The defects

### D1. The chart's name column cut most names

- **Surface:** the Schedule tab's Chart, on a phone.
- **What was wrong:** the name column is 168px on a phone. A name shared its one line with its status
  pill, and the pill never shrank, so the name got what was left: "The transformer" 7px, "Part 2" 23px,
  "Rough-in inspection" 27px. A trade's title beside its percent was cut the same way ("Structural st…").
- **Fix:**
  - On a phone a name's cell stacks. The name has its own line, and a smaller pill (0.65rem) sits under
    it, each with the whole column.
  - A split bar's caret spans both lines.
  - Rows keep their heights, 32px and a part's 26px. Both lines fit.
  - A trade's title may take two lines.
- **Measured (Fair Oaks, every trade open, Lighting split, places kept):**
  - Names cut: 21 of 43 before, 3 of 43 after.
  - Pills cut: 0 of 35 before, 0 of 35 after.
  - Every stacked cell inside its row, 35 of 35. The tightest is a part at 24.3 of 25px, and a bar is
    28.9 of 31px.
  - "Structural steel" went from cut to two lines, 28.1 of 29px.
  - Helotes's first draft: 0 of 25 names cut, 0 of 19 pills. Helotes's imported sample: 1 of 26 names, 0 of 20 pills.
  - The three still cut are wider than the whole column on one line: "Utilities to 5 ft of the building",
    "Sheet metal and flashing" and "Electrical service inspection" (and Helotes's "Above-ceiling inspection").
- **Tried first and dropped:** letting the pill shrink and end in "…". It cut 14 of 35 pills ("ordered
  Sep 1" became "ord…"), which only moved the cut from the name to the pill.

### D2. A bar's port painted over the name column

- **Surface:** the chart, scrolled so a bar ends under the name column. On a phone at today, that is most
  finished bars.
- **What was wrong:** the port (G-34, *Pull a line to another bar*) and the name column were both
  z-index 3. The port comes later in the page, so its circle sat on the name and the pill: over
  Sidewalks and curbs, Joists and deck, and Service and gear.
- **Fix:** the name column is z-index 4. That is above the ports (3) and the links and today line (2), and
  under the header row (5). A port still sits above its bar and the links.
- **Measured:** anything from the bars painting inside a name cell, over the whole chart: 3 before, 0
  after. All 26 ports are still drawn.

### D3. Splitting a bar widened the page to 506px

- **Surface:** the opened bar's parts card, after splitting Lighting into two parts.
- **What was wrong:** a part's row is four grid columns with minimums of 8rem, 8rem, 6rem and 5rem. With
  the gaps that is a 490px track, so the document grew from 375 to 506.
- **Fix:** on a phone a part's four cells take two columns.
- **Measured:** doc 506 before, 375 after. The card is 343 wide with nothing past it (its scroll width 341
  equals its client width 341). Its columns are 150.5px each.

### D4. A typed place was cut in the crowded lane

- **Surface:** the chart once places are kept (Where the work is, then Keep these places), in the lane
  *Crowded · Inside*.
- **What was wrong:** the seeds' "Inside" fits. But a place the office types gets only the 84px beside
  "Crowded", so "Building D, second floor" showed 84 of its 150px.
- **Fix:** on a phone the place may take two lines, like a trade's title.
- **Measured:** "Building D, second floor" went from cut to whole on two lines (28.1px of a 32px row).
  "Second floor" and "Inside" stay on one line. A place at the 40-character limit with no spaces still
  ends in "…" after two lines.

### D5. The customer's dates to meet ran off their schedule

- **Surface:** Bill the customer, then what the customer sees, in Your schedule. The same picture shows in
  the customer's window under Their portal.
- **What was wrong:** each date's words sat beside its diamond on one line, placed by the date. Near the
  right edge they ran past the paper, and dates close together lay on top of each other. This happened on a
  desk too, in the 23rem pane beside the office's side.
- **Fix:**
  - The diamonds stay on their line with no words beside them. Each keeps its words as a title.
  - The words go in a list under them that wraps.
  - No word changed.
- **Measured:**
  - At 375 (paper 343): 4 of 4 dates past the edge before, the worst by 147px. After, 0, the widest 184px, and the 4 diamonds inside.
  - At 1280, in the 23rem pane (paper 337): 4 of 4 past before, the worst by 163px, with 6 pairs on top of each other. After, 0 past and 0 on top.
  - In the customer's window (paper 434), after: 0 past, 0 on top, and nothing cut.

## Near misses, left as they are

- **What the work waits on**, the waits' header on a phone, is 149px of text in a 148px box. It runs 1.1px
  into its own 9.6px padding and stops 8.5px short of the column's edge. Letting it wrap put "on" alone on
  a second line, which reads worse than the spill, so it stays on one line.
- **The stage-health strip** scrolls sideways inside its own box at 375. That is its design.

## A desk

- **The chart is the same on a desk.** Every chart change sits behind the phone check except the z-index.
  At 1024 the chart measured the same at head and after: 3 of 30 names cut, 0 of 28 pills cut, and every
  name's and pill's width equal.
- **D5 is not behind the phone check.** The list is the same on a desk, where the 23rem pane was broken too (above).
- **Seen on a desk, not touched:** at 1024 the chart cuts 3 names. Two are waits with their company
  ("Rooftop units · Cool Breeze Mechanical's supplier", "the restroom tile · Cibolo Creek Partners"), and
  one is the trade title "Structural steel" beside its dates. They are not this pass's. **The lead keeps them**
  (2026-10-06): a 1024 pane is a laptop's narrow window. Each wait's cut company is in its hover. The trade
  title's hover is *Fold into one bar*, but the same words name its first bar, just under it.

## Pinned

`GcPhonePass.render.test.tsx`, 8 tests. jsdom has no layout, so they pin the styles the browser measured:

1. A bar's name stacks over a smaller pill, each with the whole column, and the pill is never cut.
2. A wait's name stacks over its pill, a split bar's parts stack, and its caret spans both lines.
3. A trade's title may take two lines.
4. The names sit over the bars' ports.
5. A desk keeps the name and pill side by side, the pill its own size.
6. The crowded lane gives a place two lines on a phone and one on a desk.
7. The parts card puts a part in two columns on a phone and four on a desk.
8. The customer's dates read whole, each in a list under its diamond, and the diamonds carry no words.

Each pin, broken on purpose, failed its test and was restored byte for byte:

| Pin | Broken | Result |
|---|---|---|
| P1 | the bar row not stacked | 2 failed |
| P2 | a small pill keeps its size | 2 failed |
| P3 | the bar's pill not small | 1 failed |
| P4 | the names back under the ports (z-index 3) | 2 failed |
| P5 | the wait row not stacked | 1 failed |
| P6 | the part row not stacked | 1 failed |
| P7 | the caret on one line | 1 failed |
| P8 | a part's name at full size | 1 failed |
| P9 | a trade's title on one line | 1 failed |
| P10 | the crowded place on one line | 1 failed |
| P11 | the parts card in four columns on a phone | 1 failed |
| P12 | the dates list kept on one row | 1 failed |
| P13 | the dates list gone | 1 failed |
| P14 | a date loses its ", met" | 1 failed |

## Files

- `src/components/gc/gcUi.tsx`: the Chip's `small` (an addition).
- `src/components/gc/gcBuildingCss.ts`: `twoLines` (an addition), beside the lane's other phone layout.
- `src/components/gc/GcGantt.tsx`: the stacked name cells, the trade title's two lines, and the name column at z-index 4.
- `src/components/gc/GcPlaces.tsx`: the crowded place's two lines on a phone.
- `src/components/gc/GcSplitBars.tsx`: a part's two columns on a phone.
- `src/components/gc/GcCustomerSchedule.tsx`: the dates to meet as a list under the diamonds.
- `src/components/gc/GcPhonePass.render.test.tsx`: new.

No words changed. The golden test does not move.

## Left out, and why

- **The longest names stay cut on a phone's chart** (D1): the three on Fair Oaks and Helotes's
  "Above-ceiling inspection". Each is wider than the whole column on one line. They read whole in List,
  which a phone opens on, and in the opened bar. The lead keeps the column at 168 (the last section).
- **For later: a phone's larger text setting.** This pass did not test it. The chart's name column is 168px
  in pixels while its text is in rem, so larger text is the one setting that would cut more there. To check
  it, raise the root font size to 115% and 130% at the phone preset, and count the chart's cut names and
  pills as in D1. The lead's call (2026-10-06): a row for later.

## Is this the best we can do?

For the chart's names, the main defect:

1. **The pill shrinks and ends in "…".** Built first, and measured: it cut 14 of 35 pills. It moved the
   fault instead of fixing it. **Dropped.**
2. **The name stacks over a smaller pill.** Built: names cut went from 21 of 43 to 3, and pills stayed at 0
   of 35. The rows keep their heights, so nothing else in the chart moves. **I pick it.**
3. **A wider name column on a phone**, 200px instead of 168, stacked as in 2. It would leave 1 name cut on
   Fair Oaks instead of 3. But the bars would lose 32px of the 175px they get, a fifth of the window, and
   the chart narrows the column on a phone so a few weeks of bars still show. **Not now, by the lead's call**
   (2026-10-06): the column stays at 168. A name wider than it reads whole in List and in the opened bar,
   the right trade for a phone.
