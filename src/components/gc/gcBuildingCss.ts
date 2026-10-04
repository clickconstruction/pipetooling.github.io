/**
 * GC mode design spike: the Building lane's layout for a phone (REMAINING, Building 2). Inline
 * styles cannot hold a media query, so the rows that change shape on a phone carry these classes.
 */

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
