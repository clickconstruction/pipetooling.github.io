/**
 * Dispatch inbox ordering + aging kernels (journey-map Tier-2 #40 / C60,
 * J19-F3): open requests used to sort NEWEST first, so the request a tech
 * filed 46 days ago sat at the bottom of the list under this morning's — and
 * rendered in the same gray. Open rows now sort oldest-first; closed rows keep
 * newest-closed-first (the archive reads like a log). The Needs-You card gets a
 * min-age count in the `HOURS_APPROVALS_MIN_AGE_DAYS` shape.
 */
import { ageDays, compareOldestFirst } from './ageState'
import { compareCustomerWaitingFirst } from './requestPriority'

export type DispatchAgingRow = {
  status: 'open' | 'closed' | string | null
  created_at: string | null
  closed_at?: string | null
  /** v2.3247: 'high' open rows (a customer waiting) lead the open tier. */
  priority?: 'normal' | 'high' | string | null
}

/**
 * Customer waiting (open + high) first, then open, then closed; open tiers
 * oldest-first; closed newest-closed-first.
 */
export function compareDispatchInboxRows(a: DispatchAgingRow, b: DispatchAgingRow): number {
  const byWaiting = compareCustomerWaitingFirst(a, b)
  if (byWaiting !== 0) return byWaiting
  const aOpen = a.status === 'open'
  const bOpen = b.status === 'open'
  if (aOpen !== bOpen) return aOpen ? -1 : 1
  if (aOpen) return compareOldestFirst(a.created_at, b.created_at)
  const aDate = a.closed_at ?? a.created_at ?? ''
  const bDate = b.closed_at ?? b.created_at ?? ''
  return bDate.localeCompare(aDate)
}

export function sortDispatchInboxRows<T extends DispatchAgingRow>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort(compareDispatchInboxRows)
}

export type DispatchAgingSummary = {
  /** Open requests at least `minAgeDays` old. */
  count: number
  /** Every open request, aged or not — the card's "of N open" context. */
  total: number
  /** Whole days since the oldest open request was filed. */
  oldestAgeDays: number
}

/**
 * The Needs-You input: null when nothing open has reached `minAgeDays`, so a
 * same-day queue never nags — what it catches is the stall.
 */
export function summarizeOpenDispatchAging(
  rows: ReadonlyArray<DispatchAgingRow>,
  minAgeDays: number,
  now: Date | number = Date.now(),
): DispatchAgingSummary | null {
  let count = 0
  let total = 0
  let oldest = 0
  for (const r of rows) {
    if (r.status !== 'open') continue
    total++
    const d = ageDays(r.created_at, now)
    if (d == null) continue
    if (d > oldest) oldest = d
    if (d >= minAgeDays) count++
  }
  if (count === 0) return null
  return { count, total, oldestAgeDays: oldest }
}
