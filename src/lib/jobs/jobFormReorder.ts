/**
 * Pure reorder helper for the Edit/New Job "① Line Items" grid (v2.1067).
 *
 * The save engine already persists array position as
 * jobs_ledger_fixtures.sequence_order and the load path orders by it, so
 * moving a row in the in-memory array is all that's needed for the order to
 * stick. Generic over `{ id }` so the Multiple Segment Generator rows can
 * reuse it.
 */
export function moveRowById<T extends { id: string }>(
  rows: T[],
  id: string,
  direction: 'up' | 'down',
): T[] {
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return rows
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= rows.length) return rows
  const next = rows.slice()
  const row = next[idx]
  const other = next[target]
  if (!row || !other) return rows
  next[idx] = other
  next[target] = row
  return next
}
