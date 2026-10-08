/**
 * GC mode design spike: a trade not ready to start, the Gantt's Phase 4 (G-77; the mock-up and the
 * plan are `to-dos/gc-mode/mockups/G-77.md`). A bar that has not started, on a trade whose papers
 * are not in, is held the way a bar waiting on a submittal is: the chart stripes it and says what it
 * waits on, and the opened activity lists each paper with its next step, so the office can act
 * from the bar.
 *
 * Ready is Get started's five steps (awarded, master agreement, insurance, W-9, statement of work),
 * read the way Get started reads them, with one difference: insurance is read on the day the work
 * starts, not on today. A certificate that runs out before then is a gap once the renewal ask is
 * due (`INSURANCE_ASK_DAYS`); further out, the usual renewal takes care of it.
 *
 * Its own file, out of the barrel: it reads Get started, the papers' next steps and the Gantt's
 * hold shape, and the Schedule tab adds its holds to the chart's.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { NotReadyBar, NotReadyBlock, NotReadyLine, UninsuredBar } from '../gc/schedule/notReady'
export { notReadyBars, notReadyBlock, notReadyWords, startGaps, uninsuredBars, uninsuredBlock, uninsuredNotes, withNotReady } from '../gc/schedule/notReady'

export type { StartGap, StartGapKind } from '../gc/schedule/notReady'
export { NOT_READY_LATE_DAYS, holdWordsInList, lapsedInsuranceWords } from '../gc/schedule/notReady'
