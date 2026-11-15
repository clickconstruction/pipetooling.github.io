/**
 * Where the Lien desk's footer strip sits (the owner's ask of 2026-11-15).
 *
 * On a computer the paper views are two columns, the job list and the picked job's pane. The strip — the
 * amber "notice still due" line, the state line, the presses — used to run under both, so the list lost its
 * bottom to a bar about one job. Now the strip is the pane's own bottom bar: the pane column holds the pane,
 * which scrolls, over the footer, which is pinned, and the list runs to the desk's bottom edge beside them.
 *
 * On a phone (one column) nothing moves: the strip stays the desk's, under the fold bar that folds it away
 * (punch list #352, PR 6), whose sibling rule needs the footer right after it.
 */
import type { CSSProperties } from 'react'

export type LienDeskFooterHome = {
  /** Under the pane alone, or across the desk's whole width. */
  in: 'pane' | 'desk'
  /** The style of the column that holds the pane over its footer. Null when the pane stands alone in the grid. */
  column: CSSProperties | null
}

const PANE: LienDeskFooterHome = {
  in: 'pane',
  column: { display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', minHeight: 0, minWidth: 0, overflow: 'hidden' },
}

const DESK: LienDeskFooterHome = { in: 'desk', column: null }

/** `oneColumn` is the desk drawn in one column: a phone, or the stacked layout. */
export function lienDeskFooterHome(oneColumn: boolean): LienDeskFooterHome {
  return oneColumn ? DESK : PANE
}
