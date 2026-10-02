/**
 * Order-only rows (2026-10-02): a fixture the office buys and the GC never sees. The row stays on
 * the revision and on the procurement log; the GC's room, the package, the cut sheet count and
 * every "rows still need…" line leave it out. `bid_submittal_items.order_only` is the one truth:
 * nothing here infers it from the row's parts, which keep their own picks underneath.
 */

import { shortDate } from './procurementLog'

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

/** What the procurement log already holds for one of a row's lines. */
export type LogOrderFact = { orderedOn: string | null; deliveredOn: string | null; poRef: string | null }

/** A line somebody has bought: an order date, a delivery or a PO typed on it. */
export function isBought(f: LogOrderFact): boolean {
  return !!f.orderedOn || !!f.deliveredOn || !!(f.poRef ?? '').trim()
}

/**
 * "Ordered 09/23, on site 09/29" · "On PO 4417" — why a row cannot be left out: leaving it out
 * takes its lines off the log, and the order would go with them. '' when nothing is bought.
 */
export function boughtWords(facts: ReadonlyArray<LogOrderFact>): string {
  const bought = facts.filter(isBought)
  if (bought.length === 0) return ''
  const ordered = bought.map((f) => f.orderedOn).filter((d): d is string => !!d).sort()[0] ?? null
  const delivered = bought.map((f) => f.deliveredOn).filter((d): d is string => !!d).sort().pop() ?? null
  const po = bought.map((f) => (f.poRef ?? '').trim()).find((p) => p !== '') ?? null
  const bits = [ordered ? `ordered ${shortDate(ordered)}` : '', delivered ? `on site ${shortDate(delivered)}` : '', !ordered && !delivered && po ? `on PO ${po}` : ''].filter(Boolean)
  const line = bits.join(', ')
  return line.charAt(0).toUpperCase() + line.slice(1)
}

/** "1 fixture · you buy it, the GC does not see it" — the Order only group's heading in step 3. */
export function orderOnlyGroupLine(n: number): string {
  return n === 1 ? '1 fixture · you buy it, the GC does not see it' : `${n} fixtures · you buy them, the GC does not see them`
}
