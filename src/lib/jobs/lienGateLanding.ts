/**
 * A press on a Lien affidavits list row lands on the row's open gate (v2.8472, punch list #364). Pure.
 *
 * The list row wears the pane's five gates as marks (v2.7335) and the pane's gate rows are presses (v2.7313), so a
 * row that reads a hold is one press from the record that clears it, once the gate is on the screen. On a phone
 * the pane opens at its top and the gates sit under the job's path, a scroll away. This is the rule for where the
 * press lands: the first gate not clear, in the pane's own order, which is the order of the row's marks.
 *
 * Two answers, both from numbers the pane reads off the page: which gate, and how far the pane scrolls. A gate
 * already on the screen moves nothing.
 */

/** One row of the pane's gate list, as the landing reads it. */
export type LienGateLandingRow = {
  key: string
  ok: boolean
  /** The row has a door, so it is a live press and can take the keyboard. A row with none is a disabled button. */
  pressable: boolean
}

export type LienGateLanding = {
  /** The gate's key, the pane row's `data-lien-gate-row`. */
  key: string
  /** Whether the keyboard goes to the row, so the next press opens its record. A row with no door is only brought into view. */
  focus: boolean
}

/** The gate a row press lands on: the first not clear, in the order given, which is the pane's. Null when every gate is clear. */
export function lienGateLanding(rows: ReadonlyArray<LienGateLandingRow>): LienGateLanding | null {
  const first = rows.find((r) => !r.ok)
  return first ? { key: first.key, focus: first.pressable } : null
}

/** The room left over a landed row, so it does not sit hard against the head. */
export const LIEN_GATE_LANDING_BREATH_PX = 8

export type LienGateLandingView = {
  /** The gate row's top inside the pane's scrolled content, and its height. */
  rowTop: number
  rowHeight: number
  /** Where the pane is scrolled now, and how tall its window is. */
  scrollTop: number
  viewHeight: number
  /** The heads pinned over the gates section at the pane's top, and the heads to come pinned at its bottom. */
  topInset: number
  bottomInset: number
  /** The scroll that lands the gates section under its own head (`lienPaneSectionScrollTop`). */
  sectionTop: number
}

/**
 * Where the pane scrolls so the gate row is on the screen, or null to stay put. A row already clear of the pinned
 * heads moves nothing, which is the usual case beside the list on a computer. Otherwise the gates section lands
 * under its own head, as a press on the head lands it, so the row reads with its neighbours. A section too tall
 * for the window lands the row itself under the head.
 */
export function lienGateLandingScrollTop(v: LienGateLandingView): number | null {
  // A page with no layout (a test's, a pane not drawn yet) has nothing to scroll to.
  if (!(v.viewHeight > 0)) return null
  const shows = (top: number) => v.rowTop >= top + v.topInset && v.rowTop + v.rowHeight <= top + v.viewHeight - v.bottomInset
  if (shows(v.scrollTop)) return null
  if (shows(v.sectionTop)) return Math.max(0, v.sectionTop)
  return Math.max(0, v.rowTop - v.topInset - LIEN_GATE_LANDING_BREATH_PX)
}
