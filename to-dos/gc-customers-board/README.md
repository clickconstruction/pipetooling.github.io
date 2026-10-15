---
name: "GC projects: Customers and Trade partners By step as bands"
number: 109
group: close
status: the owner said "Build D, don't fold empty steps, borrow the Project Board colours" 2026-10-15; built as v2.5555 the same day; two calls stay open at the foot
summary: >
  The owner's screenshot of Customers → By step: the down arrows abutting the sides of the
  pickers, the first column scrunched, the text sizes all over the place, and the page not as
  intuitive as it could be. The mock-up draws it today, then four shapes (tidy the table, phase
  bands with the steps inside, columns by step, and the refined cut D with its late case) and
  the critique weighs them. D is built: one line that says who needs a hand today, then one band
  per part of the flow in the Project Board's colours, every step a row inside.
next: Use the board for a week from 2026-10-15, then decide the two calls at the foot (bigger dots on a heavy board; an "every step" switch to fold the empty rows).
size: S (one PR, v2.5555)
blocker: Nothing. The two calls at the foot are the owner's, after a week of use.
opinion: built as D with every step shown; leave the folds and the dots alone until the board holds twenty customers.
mockup: to-dos/gc-customers-board/mockup.html
---

# GC projects: Customers and Trade partners By step as bands

## The ask

The owner, 2026-10-15, with a screenshot of Customers → By step: "this page does not look as
good and intuitive as it could, the down arrows are abutting the sides and the text in the
first column looks scrunched in some areas and the text size varies so much it looks hard to
read. Can you help me come up with better mockups of how this could look and flow and then ask
yourself is this the best we can do and is this the most intuitive?"

## What was wrong, cause by cause

1. **Two structures said one thing.** Tiles by phase on top (`GcBoardTiles.tsx`), then rows by
   lane underneath (`GcBoardByStep.tsx`, the Once and Per job headings). The reader had to map
   one onto the other, and a tile's press jumped to a row.
2. **Most rows were about nobody.** Five of the eight rows were "lands here" placeholders, folded
   runs of empty steps joined with dots.
3. **One customer counted three times.** The tiles read 1, 1, 1 for one customer, because a
   customer sits in every phase at once through their jobs.
4. **The head column wrapped.** "Said yes · Contract signed · Start date · On site" took three
   lines in 180 px.
5. **Seven text sizes.** Bold tiny job names next to large pills; the tiles' numbers at 1.35 rem.
6. **The selects were native.** The chevron sat on the edge, and the job picker was as wide as its
   longest option.
7. **The action button drifted** with the chips instead of holding a column.

## The shapes

The mock-up (`mockup.html`, exported from the canvas
https://claude.ai/artifact/BxLEo4GEddKweiwXZfEwDd in the dark theme) draws today's board, then:

- **A, tidy the table.** The same structure with the seven faults fixed. The least change, and
  still two structures.
- **B, phase bands.** The Jobs pipeline idiom the owner likes: Setting up, Bidding, Building as
  tinted bands with the steps inside. Empty steps folded to one line per band.
- **C, columns by step.** Drawn to show why it loses: eleven steps make narrow columns, and it
  fails on a phone.
- **D, the refined cut.** B plus the critique: band counts read "1 customer · 2 jobs", each job
  on its own line, whose move it is under the step name, four text sizes, dropdown pills with the
  chevron inside, a fixed action column, and a one-line today strip in place of the Off the flow
  and Need a hand tiles. D2 shows that strip as an amber banner with a red chip and a blue
  "Remind the 1 late".

## The critique

Is D the best we can do? Three doubts were put to the owner. Folding empty steps hides the whole
flow from a first-timer. The band dots are smaller than the tiles' were, which matters once the
board holds thirty customers. And the band colours should be the Project Board's own stage
colours so colour means one thing across the page.

## The owner's calls (2026-10-15)

"Build D, don't fold empty steps, borrow the Project Board colours." So every step keeps its row
(a step nobody is on says what lands there), and the bands wear Buying out's blue for the papers
phase, Bidding's amber for pricing and Building's green.

## Where it plugs in

- `src/lib/flows/board.ts`: `boardBands` (one band per phase, every step a row), `stepSubParts`,
  `bandCountWords`, `bandLaneWords`, `todayWords`; `boardSummary` builds its tiles from the bands
  and carries `handLines`.
- `src/components/gc/flows/GcBoardByStep.tsx`: the today line, the bands on `.stagesSectionBand`
  with `STAGE_COLORS` (exported from `GcBoardStages.tsx`), the rows, the Off the flow band, and
  `BoardPickers`; `GcFlowBoard.tsx` holds the filter and draws the pickers in its views row.
- Guide `see-where-every-company-stands-and-who-is-late`.

## Open calls, after a week of use

1. Bigger dots on a heavy board, or the company names on the band head.
2. An "every step" switch that folds the empty rows for the office once the flow is familiar.
