/**
 * The dial's mark labels, laid into rows so that none overlaps another. Each label hangs at its point on the
 * track (`p`, a percentage), whole to the right near the left end, whole to the left near the right end and
 * centred between, so two labels near each other collide unless one drops a row. The component measures the
 * track and every label and hands the widths here; the rule itself is pure. On a desk the four marks fit in two
 * rows; on a phone the same labels need three or four, where the old rule (a label within 16 points of the one
 * before it drops a row) stacked them on top of each other.
 */

export type MarkAnchor = 'start' | 'centre' | 'end'

/** How a label hangs from its point: whole to the right near the left end, whole to the left near the right end, centred between. */
export const markAnchor = (p: number): MarkAnchor => (p < 8 ? 'start' : p > 92 ? 'end' : 'centre')

/** The box a label covers on the track, in track pixels. */
export function markSpan(p: number, widthPx: number, trackPx: number): { left: number; right: number } {
  const x = (p / 100) * trackPx
  const anchor = markAnchor(p)
  const left = anchor === 'start' ? x : anchor === 'end' ? x - widthPx : x - widthPx / 2
  return { left, right: left + widthPx }
}

export type MarkBox = { p: number; widthPx: number }

/**
 * A row for each mark, in the marks' order: the lowest row where the label clears the one before it on that row by
 * `gapPx`, read left to right. An unmeasured track (0 px) puts everything on the first row.
 */
export function layMarkRows(marks: readonly MarkBox[], trackPx: number, gapPx = 6): number[] {
  if (trackPx <= 0) return marks.map(() => 0)
  const boxes = marks.map((m, i) => ({ i, ...markSpan(m.p, m.widthPx, trackPx) })).sort((a, b) => a.left - b.left || a.i - b.i)
  const rowRight: number[] = []
  const rows: number[] = marks.map(() => 0)
  for (const b of boxes) {
    let row = rowRight.findIndex((right) => right + gapPx <= b.left)
    if (row === -1) {
      row = rowRight.length
      rowRight.push(b.right)
    } else {
      rowRight[row] = b.right
    }
    rows[b.i] = row
  }
  return rows
}

/** How many rows the laid marks take, one at least. */
export const markRowCount = (rows: readonly number[]): number => rows.reduce((n, r) => Math.max(n, r + 1), 1)
