import { takeoffRowDomId } from './bidTabRowJump'

/**
 * Seamless hop between the Takeoffs views (v2.2998, docs/TAKEOFFS_REFRESH_PLAN.md):
 * switching Old / One at a time / Sheet keeps the fixture you are on. The
 * fixture is the last row you touched in any view — else, when nothing was
 * touched, the row nearest the top of the viewport at the moment you hop.
 */

const ROW_DOM_PREFIX = takeoffRowDomId('')

/** Px from the top of the viewport the sticky app chrome covers; rows above it count as scrolled past. */
export const TAKEOFF_HOP_HEADER_PX = 120

/**
 * The fixture a hop lands on: `touchedId` when it is still a row on the bid;
 * otherwise the first row whose top edge is at or below `headerBottom`, else
 * the last row above it (the one you scrolled partway past); null when the
 * bid has no rows or none is measured.
 */
export function pickHopRow(
  rows: ReadonlyArray<{ id: string; top: number | null }>,
  touchedId: string | null,
  headerBottom: number = TAKEOFF_HOP_HEADER_PX,
): string | null {
  if (touchedId && rows.some((r) => r.id === touchedId)) return touchedId
  const measured = rows.filter((r): r is { id: string; top: number } => r.top != null)
  if (measured.length === 0) return null
  const below = measured.find((r) => r.top >= headerBottom)
  if (below) return below.id
  return measured[measured.length - 1]?.id ?? null
}

/**
 * The count row a click or focus inside the shared line table belongs to.
 * Only a fixture's first `<tr>` carries the `takeoff-row-<id>` DOM id (the
 * sortable line rows below it do not), so walk up to the row, then back over
 * previous siblings to the nearest id-bearing row.
 */
export function rowIdFromTakeoffTableTarget(target: EventTarget | null): string | null {
  if (!target || !(target instanceof Element)) return null
  let tr: Element | null = target.closest('tr')
  while (tr && !tr.id.startsWith(ROW_DOM_PREFIX)) tr = tr.previousElementSibling
  if (!tr) return null
  const id = tr.id.slice(ROW_DOM_PREFIX.length)
  return id.length > 0 ? id : null
}
