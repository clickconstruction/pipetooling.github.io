/**
 * GC mode, the real build, the schedule's PR 7a: the rows that change shape on a phone, and the
 * chart's two-line names. Moved word for word from the GC mode prototype (branch spike/gc-mode,
 * `gcBuildingCss.ts`); the plan is to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import type { CSSProperties } from 'react'

/** The schedule chart's name column: wide on a desk, narrow on a phone so the bars have room. */
export const SCHEDULE_LABEL_W = 260

/**
 * A line with a bar between its name and its numbers (Draws, Our own crew). On a phone the bar
 * takes its own line under them, full width, instead of shrinking to nothing.
 */
export const BUILDING_CSS = `
.gcBar-row { display: grid; grid-template-columns: minmax(8rem, 14rem) 1fr auto; gap: 0.6rem; align-items: center; font-size: 0.875rem; }
.gcSched-label { width: ${SCHEDULE_LABEL_W}px; min-width: ${SCHEDULE_LABEL_W}px; }
@media (max-width: 640px) {
  .gcBar-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 0.25rem; }
  .gcBar-row > .gcBar { grid-column: 1 / -1; grid-row: 2; }
  .gcSched-label { width: 9.5rem; min-width: 9.5rem; }
}
`

/**
 * A name that shares its line in the chart's 168px column on a phone (a trade's title, a crowded place): two
 * short lines, then "…". Two lines of 0.8rem are 28px, inside a trade's 30px row (the phone pass, round five).
 */
export function twoLines(fontSize: string): CSSProperties {
  return { whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'break-word', lineHeight: 1.1, fontSize }
}
