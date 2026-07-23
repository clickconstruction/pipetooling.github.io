/**
 * Dispatch PO "Other" bucket kernel (v2.955): partitions the For / Supply
 * house picker options into the main list and the demoted Other list, based
 * on company-wide dispatch_po_other_items flags.
 */

export type DispatchPoOtherKind = 'for_person' | 'supply_house'

export type DispatchPoOtherRow = { id: string; kind: string; item_id: string }

/** Release-measured hold duration that counts as a long-press (matches Quick Assign). */
export const PO_LONG_PRESS_MS = 450

/** Drag ≥ this fraction of the swipe track to confirm a move. */
export const SWIPE_CONFIRM_THRESHOLD = 0.85

/** item_ids flagged Other for one picker. */
export function otherIdSet(rows: DispatchPoOtherRow[], kind: DispatchPoOtherKind): Set<string> {
  return new Set(rows.filter((r) => r.kind === kind).map((r) => r.item_id))
}

/**
 * Splits picker options into main and Other, preserving order. Items in
 * alwaysMainIds (e.g. today's crew on the selected job) stay in the main list
 * even when flagged — the crew-first pick must never cost extra taps.
 */
export function partitionByOther<T extends { id: string }>(
  items: T[],
  otherIds: Set<string>,
  alwaysMainIds?: Set<string>,
): { main: T[]; other: T[] } {
  const main: T[] = []
  const other: T[] = []
  for (const item of items) {
    if (otherIds.has(item.id) && !alwaysMainIds?.has(item.id)) other.push(item)
    else main.push(item)
  }
  return { main, other }
}
