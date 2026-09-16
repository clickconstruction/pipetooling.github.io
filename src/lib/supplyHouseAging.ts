/**
 * Supply-house AP aging: bucket unpaid invoices by days past due (from due_date) into the
 * classic aging map — Current (not yet due), 1–30, 30–60, 60–90, 90+ days past due — plus a
 * "No due date" column for unpaid invoices that never got one. Pure; the tab fetches rows.
 */

export type AgingBucketKey = 'current' | 'past1_30' | 'past30_60' | 'past60_90' | 'past90plus' | 'noDueDate'

export const AGING_BUCKETS: Array<{ key: AgingBucketKey; label: string }> = [
  { key: 'current', label: 'Current' },
  { key: 'past1_30', label: '1–30' },
  { key: 'past30_60', label: '30–60' },
  { key: 'past60_90', label: '60–90' },
  { key: 'past90plus', label: '90+' },
  { key: 'noDueDate', label: 'No due date' },
]

const EPSILON = 0.005
const MS_PER_DAY = 86_400_000

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1)
}

/** Whole days today is past the due date; 0 = due today (not past due), negative = not yet due. */
export function daysPastDue(dueDateYmd: string, todayYmd: string): number {
  return Math.round((ymdToUtcMs(todayYmd) - ymdToUtcMs(dueDateYmd)) / MS_PER_DAY)
}

export function agingBucketFor(dueDateYmd: string | null, todayYmd: string): AgingBucketKey {
  if (!dueDateYmd) return 'noDueDate'
  const days = daysPastDue(dueDateYmd, todayYmd)
  if (days <= 0) return 'current'
  if (days < 30) return 'past1_30'
  if (days < 60) return 'past30_60'
  if (days < 90) return 'past60_90'
  return 'past90plus'
}

export type SupplyHouseAgingRow = {
  supplyHouseId: string
  name: string
  /** Invoices only. A credit never enters a bucket — it has a size but not an age. */
  buckets: Record<AgingBucketKey, number>
  /** Owed across the buckets. Invoices only, so it is never negative. */
  total: number
  /** Open credit memos on this house, stored negative (v2.3500). */
  creditsOpen: number
  /** `total + creditsOpen` — what the balance with this house actually nets to. */
  net: number
}

export type SupplyHouseAgingMatrix = {
  /** Houses holding either kind of paper, owed desc. */
  rows: SupplyHouseAgingRow[]
  totals: Record<AgingBucketKey, number>
  grandTotal: number
  /** Open credits across every house, stored negative. */
  creditsTotal: number
  /** `grandTotal + creditsTotal`. */
  netTotal: number
  /** Unpaid INVOICES with no due_date — surfaced as a data-entry nudge. A credit memo has no
   *  due date because nobody owes it on a day, so it must never be counted here. */
  missingDueDateCount: number
}

function emptyBuckets(): Record<AgingBucketKey, number> {
  return { current: 0, past1_30: 0, past30_60: 0, past60_90: 0, past90plus: 0, noDueDate: 0 }
}

export function buildSupplyHouseAgingMatrix(
  houses: Array<{ id: string; name: string }>,
  unpaidInvoices: Array<{ supply_house_id: string; amount: number | null; due_date: string | null }>,
  todayYmd: string,
): SupplyHouseAgingMatrix {
  const byHouse = new Map<string, SupplyHouseAgingRow>()
  for (const h of houses) {
    byHouse.set(h.id, {
      supplyHouseId: h.id,
      name: h.name,
      buckets: emptyBuckets(),
      total: 0,
      creditsOpen: 0,
      net: 0,
    })
  }
  const totals = emptyBuckets()
  let grandTotal = 0
  let creditsTotal = 0
  let missingDueDateCount = 0
  for (const inv of unpaidInvoices) {
    const row = byHouse.get(inv.supply_house_id)
    if (!row) continue
    const amount = Number(inv.amount ?? 0)
    // A credit memo (v2.3500) is money the house owes us, not a debt with an age. It stays out of
    // every bucket, out of `total`, and out of the missing-due-date nudge, and rides alongside.
    if (amount < 0) {
      row.creditsOpen += amount
      creditsTotal += amount
      continue
    }
    const bucket = agingBucketFor(inv.due_date, todayYmd)
    if (bucket === 'noDueDate') missingDueDateCount++
    row.buckets[bucket] += amount
    row.total += amount
    totals[bucket] += amount
    grandTotal += amount
  }
  // A house stays listed while it holds either kind of paper. Before v2.3500 the filter was
  // `total > EPSILON` against a total that credits could drag to zero, which took the house's
  // genuinely past-due invoices off the table with it.
  const rows = [...byHouse.values()]
    .filter((r) => r.total > EPSILON || r.creditsOpen < -EPSILON)
    .sort((a, b) => b.total - a.total)
  for (const r of rows) r.net = r.total + r.creditsOpen
  return { rows, totals, grandTotal, creditsTotal, netTotal: grandTotal + creditsTotal, missingDueDateCount }
}

/**
 * Next occurrence of a monthly payment day strictly after `fromYmd` — prefill for a new
 * invoice's due date on houses with `monthly_payment_day`. Day is clamped to the target
 * month's length (e.g. 31 in a 30-day month → the 30th).
 */
export function nextMonthlyPaymentDueYmd(monthlyPaymentDay: number, fromYmd: string): string {
  const [y, m, d] = fromYmd.split('-').map(Number)
  const day = Math.max(1, Math.min(31, Math.round(monthlyPaymentDay)))
  let year = y!
  let month = m! // 1-based
  if (d! >= day) {
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clamped = Math.min(day, daysInMonth)
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

/** Houses with anything 60+ days past due — the Quickfill section's "N open" (v2.2191). */
export function countSupplyHousesPastDue60(matrix: SupplyHouseAgingMatrix): number {
  return matrix.rows.filter((r) => r.buckets.past60_90 + r.buckets.past90plus > EPSILON).length
}

/**
 * One-line phone note for a house row (v2.2191): the worst news first — the 90+
 * dollars when there are any, else where most of the balance sits.
 */
export function supplyHouseAgingPhoneNote(row: SupplyHouseAgingRow): string {
  const b = row.buckets
  const overdue = b.past1_30 + b.past30_60 + b.past60_90 + b.past90plus
  if (overdue <= EPSILON && b.noDueDate <= EPSILON) return 'all current'
  const parts: string[] = []
  let largestKey: AgingBucketKey = 'current'
  let largest = b.current
  for (const k of ['past1_30', 'past30_60', 'past60_90', 'past90plus', 'noDueDate'] as AgingBucketKey[]) {
    if (b[k] > largest) {
      largest = b[k]
      largestKey = k
    }
  }
  const labels: Record<AgingBucketKey, string> = {
    current: 'current',
    past1_30: '1–30',
    past30_60: '30–60',
    past60_90: '60–90',
    past90plus: '90+',
    noDueDate: 'no due date',
  }
  if (largestKey !== 'past90plus') parts.push(`most in ${labels[largestKey]}`)
  if (b.past90plus > EPSILON) parts.push(`$${Math.round(b.past90plus).toLocaleString('en-US')} at 90+`)
  return parts.join(' · ') || 'all current'
}
