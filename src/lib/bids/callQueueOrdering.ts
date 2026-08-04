import { compareCustomersByLastContact } from './customerLastContact'

/**
 * Call-queue ordering with promised follow-up dates (v2.1389).
 *
 * Oldest-first stops meaning "who waited longest" alone once call sessions
 * promise dates. Three bands, in order:
 *   1. OVERDUE promises (next_followup_at <= now) — most overdue first.
 *      "We said we'd call — do it."
 *   2. No promise — the classic staleness order (last contact asc,
 *      never-contacted last).
 *   3. FUTURE promises — due-date asc. Parked below the fold on purpose:
 *      you told them a date, calling earlier annoys.
 * Newest-first ignores promises entirely (it's a lookup order, not a queue).
 */

export function compareCustomersForCallQueue(
  a: { id: string; name: string },
  b: { id: string; name: string },
  lastContactMap: Map<string, string>,
  nextFollowupByCustomer: Record<string, string>,
  nowMs: number,
): number {
  const band = (c: { id: string }): number => {
    const promise = nextFollowupByCustomer[c.id]
    if (!promise) return 1
    const ms = new Date(promise).getTime()
    if (!Number.isFinite(ms)) return 1
    return ms <= nowMs ? 0 : 2
  }
  const bandA = band(a)
  const bandB = band(b)
  if (bandA !== bandB) return bandA - bandB
  if (bandA === 1) return compareCustomersByLastContact(a, b, lastContactMap, 'oldest-first')
  const diff = new Date(nextFollowupByCustomer[a.id] ?? 0).getTime() - new Date(nextFollowupByCustomer[b.id] ?? 0).getTime()
  if (diff !== 0) return diff
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export type NextFollowupBadge = { label: string; overdue: boolean }

/** "follow-up due 8/11" badge for the card header; overdue drives the red styling. */
export function nextFollowupBadge(iso: string | undefined, nowMs: number): NextFollowupBadge | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  const d = new Date(iso)
  return { label: `follow-up due ${d.getMonth() + 1}/${d.getDate()}`, overdue: ms <= nowMs }
}
