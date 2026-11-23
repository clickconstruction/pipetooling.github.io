/**
 * A Board tile on a phone (the owner's go of 2026-11-23).
 *
 * Two things read wrong at a phone's width. The first tile's label is the day and its parts in one run,
 * *by Dec 15 · 9 to file · 8 to send*, which wrapped with one word alone on its last line. And the two doors that say
 * *Show them ›* stood in different corners: the first tile's at the foot, after its red line, and the second tile's at
 * the top right. On a phone the label is two lines, the day and then its parts, and a tile's door ends the line it
 * acts on, as the red line's own door always did.
 *
 * Words and places only: what a tile counts and what its press opens are `lienBoard.ts`'s. A computer's tile is as it was.
 * Pure.
 */

/** The mark between a label's day and its parts, as `lienBoard.ts` writes it. */
const BETWEEN = ' · '

/** The first tile's label as a phone draws it: the day on one line, its parts on the next; `parts` is '' when the label names no parts. */
export function lienBoardDayLabelParts(label: string): { day: string; parts: string } {
  const at = label.indexOf(BETWEEN)
  if (at < 0) return { day: label, parts: '' }
  return { day: label.slice(0, at), parts: label.slice(at + BETWEEN.length) }
}

/** Whether a tile's label is split on a phone: the day's tile alone, and only when the label names parts. */
export function lienBoardTileLabelSplits(tile: { key: string; label: string }, isMobile: boolean): boolean {
  return isMobile && tile.key === 'by_day' && lienBoardDayLabelParts(tile.label).parts !== ''
}
