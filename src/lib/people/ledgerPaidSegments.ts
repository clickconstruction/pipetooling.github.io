/**
 * Pay reports table paid-status segments (v2.2238).
 *
 * The table's `Open | Paid | All` segmented filter replaces the old two-state
 * "Hide paid" button. "Open" (the default) means not fully paid — unpaid and
 * partially paid reports; "Paid" is fully paid only. Membership in `paidIds`
 * is decided by the caller with the same net-pay math the rows use.
 */

export type PaidSegment = 'open' | 'paid' | 'all'

export type PaidSegmentCounts = {
  open: number
  paid: number
  all: number
}

export function paidSegmentCounts<T extends { id: string }>(
  stubs: readonly T[],
  paidIds: ReadonlySet<string>,
): PaidSegmentCounts {
  let paid = 0
  for (const s of stubs) if (paidIds.has(s.id)) paid += 1
  return { open: stubs.length - paid, paid, all: stubs.length }
}

export function filterStubsByPaidSegment<T extends { id: string }>(
  stubs: readonly T[],
  paidIds: ReadonlySet<string>,
  segment: PaidSegment,
): T[] {
  if (segment === 'all') return [...stubs]
  if (segment === 'paid') return stubs.filter((s) => paidIds.has(s.id))
  return stubs.filter((s) => !paidIds.has(s.id))
}

/**
 * Rows the current segment is hiding, for the under-table reveal line —
 * the count plus what to call them ("paid" / "open"). Null on All (or when
 * nothing is hidden): no line to show.
 */
export function hiddenBySegment(
  counts: PaidSegmentCounts,
  segment: PaidSegment,
): { count: number; label: 'paid' | 'open' } | null {
  if (segment === 'open' && counts.paid > 0) return { count: counts.paid, label: 'paid' }
  if (segment === 'paid' && counts.open > 0) return { count: counts.open, label: 'open' }
  return null
}
