/**
 * GC mode design spike: one line as several bars, the Gantt's G-39 (`to-dos/gc-mode/mockups/G-39.md`).
 * A line of a statement of work is one bar, but in the field it is often two jobs: the sales floor,
 * then the back of house. Split, each part has a name, its own dates and its own percent. The line
 * stays the line: its dates are its parts' span, and its percent is their percents weighted by
 * their share, stored on the line as today. So the pay application, the list, the paper, the
 * forecast, the export, the portals and the customer read it exactly as before.
 *
 * A part's days are counted from the line's start, so every move of the line carries its parts with
 * no change: a drag, a push, a pull, days got back, Undo, a what-if. The part that ends last ends
 * with the line. Each part's share of the work is set from its days at the split and then kept: a
 * slip does not make the work bigger, so it must not move the line's percent, and with it the bill,
 * without a report.
 *
 * Its own file, out of the barrel: the reducer, the chart, the portal and the walk read it.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { PartSpan } from '../gc/schedule/splitBars'
export { PART_BEHIND_POINTS, draftShares, lineLabel, linePctOf, movedParts, partFacts, partMoveOf, partMoveSpans, partPcts, partSpans, partStanding, partsSummary, splitActivityOf, splitDrafts, splitParts, withPartDays, withPartReport } from '../gc/schedule/splitBars'

