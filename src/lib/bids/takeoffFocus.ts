import type { TakeoffCoverageSummary } from './takeoffCoverage'

/**
 * New 1 — "One fixture at a time" (docs/TAKEOFFS_REFRESH_PLAN.md): the pure
 * parts of the guided pass — the rail's items and status dots, focus
 * movement, and the keyboard rule (Enter / arrows act only when nothing is
 * being typed into).
 */

export type FocusRailStatus = 'done' | 'todo' | 'zero'

export type FocusRailItem = {
  countRowId: string
  status: FocusRailStatus
  lineCount: number
  total: number
  /** The takeoff book has something for this fixture (shown as a "book" hint). */
  bookMatch: boolean
}

export function focusRailItems(
  countRows: ReadonlyArray<{ id: string }>,
  coverage: TakeoffCoverageSummary,
  bookMatchedIds: ReadonlySet<string>,
): FocusRailItem[] {
  return countRows.map((r) => {
    const f = coverage.perFixture.get(r.id)
    const lineCount = f?.lineCount ?? 0
    const status: FocusRailStatus = lineCount === 0 ? 'todo' : f?.hasZeroPriceLine ? 'zero' : 'done'
    return { countRowId: r.id, status, lineCount, total: f?.total ?? 0, bookMatch: bookMatchedIds.has(r.id) }
  })
}

/** ↑ / ↓ over the rail, clamped at the ends; null current → the first row. */
export function moveFocus(order: ReadonlyArray<string>, currentId: string | null, dir: -1 | 1): string | null {
  if (order.length === 0) return null
  const i = currentId ? order.indexOf(currentId) : -1
  if (i < 0) return order[0] ?? null
  const next = Math.max(0, Math.min(order.length - 1, i + dir))
  return order[next] ?? null
}

/** True when a key press belongs to a field, not to the view's shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (target as HTMLElement).isContentEditable === true
}

export type FocusShortcutKey = 'Enter' | 'ArrowUp' | 'ArrowDown'

const ACTIVATION_TARGET = 'button, a[href], [role="button"]'
const DIALOG = '[role="dialog"], [role="alertdialog"]'

/**
 * True when New 1 may act on a key press (v2.2988). Nothing applies while a
 * dialog owns the focus (the remove-line confirm says "press Enter to remove")
 * or when a field is being typed into; Enter also stays with a focused button
 * or link, which the browser activates on Enter — otherwise the shortcut would
 * cancel that activation and advance the fixture instead. Arrows still move
 * the rail from a focused rail item.
 */
export function focusShortcutApplies(target: EventTarget | null, key: FocusShortcutKey): boolean {
  if (isTypingTarget(target)) return false
  if (!target || !(target instanceof Element)) return true
  if (target.closest(DIALOG)) return false
  if (key === 'Enter' && target.closest(ACTIVATION_TARGET)) return false
  return true
}

/** The fixture New 1 opens on: the first uncosted row, else the first row. */
export function initialFocusId(countRows: ReadonlyArray<{ id: string }>, uncostedIds: ReadonlyArray<string>): string | null {
  const first = countRows.find((r) => uncostedIds.includes(r.id))
  return first?.id ?? countRows[0]?.id ?? null
}
