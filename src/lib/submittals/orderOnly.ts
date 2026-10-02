/**
 * Order-only rows (2026-10-02): a fixture the office buys and the GC never sees. The row stays on
 * the revision and on the procurement log; the GC's room, the package, the cut sheet count and
 * every "rows still need…" line leave it out. `bid_submittal_items.order_only` is the one truth:
 * nothing here infers it from the row's parts, which keep their own picks underneath.
 */

/** Before the column's push a row reads without it; only a stored true counts. */
export function isOrderOnlyRow(item: { order_only?: boolean | null }): boolean {
  return item.order_only === true
}

/** The rows the GC sees: what every count, the package and the room are built from. */
export function gcRows<T extends { order_only?: boolean | null }>(items: ReadonlyArray<T>): T[] {
  return items.filter((it) => !isOrderOnlyRow(it))
}

/** The rows bought without the GC, in the revision's order. */
export function orderOnlyRows<T extends { order_only?: boolean | null }>(items: ReadonlyArray<T>): T[] {
  return items.filter(isOrderOnlyRow)
}

/**
 * The flag on an insert, written only when true: the client deploys before the column's push, and
 * an insert naming a column the table does not have yet is refused.
 */
export function orderOnlyInsert(item: { order_only?: boolean | null }): { order_only?: true } {
  return isOrderOnlyRow(item) ? { order_only: true } : {}
}
