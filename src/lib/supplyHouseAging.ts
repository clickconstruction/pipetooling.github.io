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

/** A cell of the aging map: one bucket, the Owed column, or the Credits open column. */
export type AgingCellKey = AgingBucketKey | 'owed' | 'credits'

/** The cell's name as the modal titles it ("60–90 days past due", "every unpaid invoice"). */
export function agingCellTitle(cell: AgingCellKey): string {
  if (cell === 'owed') return 'every unpaid invoice'
  if (cell === 'credits') return 'credits open'
  if (cell === 'current') return 'current (not yet due)'
  if (cell === 'noDueDate') return 'no due date recorded'
  const label = AGING_BUCKETS.find((b) => b.key === cell)?.label ?? cell
  return `${label} days past due`
}

/**
 * The invoices behind one cell of the aging map (v2.5673) — the same routing
 * `buildSupplyHouseAgingMatrix` uses, so the modal's rows always sum to the cell. `houseId`
 * null reads the footer row (every house). A credit (stored negative, v2.3500) appears only
 * under 'credits'; 'owed' is the Owed column, invoices only. Sorted oldest due first, the
 * no-due-date rows last.
 */
export function invoicesForAgingCell<T extends { supply_house_id: string; amount: number | null; due_date: string | null }>(
  unpaidInvoices: readonly T[],
  houseId: string | null,
  cell: AgingCellKey,
  todayYmd: string,
): T[] {
  return unpaidInvoices
    .filter((inv) => houseId == null || inv.supply_house_id === houseId)
    .filter((inv) => {
      const amount = Number(inv.amount ?? 0)
      if (cell === 'credits') return amount < 0
      if (amount < 0) return false
      if (cell === 'owed') return true
      return agingBucketFor(inv.due_date, todayYmd) === cell
    })
    .sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'))
}

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
  /**
   * Of each bucket, the dollars on the house's JOB ACCOUNT (`on_job_account`, v2.3423) — the
   * owner's debt to collect on, not Click's. Always ≤ the bucket; the cell keeps the house's
   * total and the tab draws this as the "of which on a job account" line (B, decided 2026-09-17).
   */
  jobAccount: Record<AgingBucketKey, number>
  /** Σ jobAccount across the buckets; ≤ `total`. */
  jobAccountTotal: number
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
  /** Per bucket, the dollars on a job account across every house. */
  jobAccountTotals: Record<AgingBucketKey, number>
  /** Σ jobAccountTotals; ≤ `grandTotal`. */
  jobAccountGrandTotal: number
  /** Unpaid invoices flagged on a job account (credits never count). */
  jobAccountInvoiceCount: number
}

function emptyBuckets(): Record<AgingBucketKey, number> {
  return { current: 0, past1_30: 0, past30_60: 0, past60_90: 0, past90plus: 0, noDueDate: 0 }
}

export function buildSupplyHouseAgingMatrix(
  houses: Array<{ id: string; name: string }>,
  unpaidInvoices: Array<{ supply_house_id: string; amount: number | null; due_date: string | null; on_job_account?: boolean | null }>,
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
      jobAccount: emptyBuckets(),
      jobAccountTotal: 0,
    })
  }
  const totals = emptyBuckets()
  const jobAccountTotals = emptyBuckets()
  let grandTotal = 0
  let creditsTotal = 0
  let missingDueDateCount = 0
  let jobAccountGrandTotal = 0
  let jobAccountInvoiceCount = 0
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
    if (inv.on_job_account === true) {
      row.jobAccount[bucket] += amount
      row.jobAccountTotal += amount
      jobAccountTotals[bucket] += amount
      jobAccountGrandTotal += amount
      jobAccountInvoiceCount++
    }
  }
  // A house stays listed while it holds either kind of paper. Before v2.3500 the filter was
  // `total > EPSILON` against a total that credits could drag to zero, which took the house's
  // genuinely past-due invoices off the table with it.
  const rows = [...byHouse.values()]
    .filter((r) => r.total > EPSILON || r.creditsOpen < -EPSILON)
    .sort((a, b) => b.total - a.total)
  for (const r of rows) r.net = r.total + r.creditsOpen
  return {
    rows,
    totals,
    grandTotal,
    creditsTotal,
    netTotal: grandTotal + creditsTotal,
    missingDueDateCount,
    jobAccountTotals,
    jobAccountGrandTotal,
    jobAccountInvoiceCount,
  }
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

/**
 * The move window (punch list #132 PR 3): a supply house moves a charge onto the job
 * account only while the invoice is CURRENT — once past due, the window is closed.
 * Candidates are read before the allocations are known; movable needs exactly one job.
 */
export function movableCandidates<T extends { amount: number | null; due_date: string | null; on_job_account?: boolean | null }>(
  unpaidInvoices: readonly T[],
  todayYmd: string,
): T[] {
  return unpaidInvoices.filter(
    (inv) =>
      Number(inv.amount ?? 0) > 0 &&
      inv.on_job_account !== true &&
      inv.due_date != null &&
      daysPastDue(inv.due_date, todayYmd) <= 0,
  )
}

/**
 * A candidate with exactly one job is movable; null allocation count = not known yet. Since
 * v2.6086 (punch list #178) a job whose account at the house is on record as not needed takes
 * its charges out of the window — the house would not move them — so the caller passes the
 * pair's account status when it has it (`count_supply_house_move_window()` reads the same rule).
 */
export function isMovableAgingInvoice(
  inv: { amount: number | null; due_date: string | null; on_job_account?: boolean | null },
  allocationCount: number | null,
  todayYmd: string,
  accountStatus: string | null | undefined = null,
): boolean {
  return movableCandidates([inv], todayYmd).length === 1 && allocationCount === 1 && accountStatus !== 'not_needed'
}

export type MoveStripSummary = { count: number; dollars: number; askedCount: number; soonestDueYmd: string | null }

/** The teal strip's numbers over the movable rows: the money, the asks out, the soonest window to close. */
export function moveStripSummary<T extends { id: string; amount: number | null; due_date: string | null }>(
  movable: readonly T[],
  askedInvoiceIds: ReadonlySet<string>,
): MoveStripSummary {
  let dollars = 0
  let askedCount = 0
  let soonest: string | null = null
  for (const r of movable) {
    dollars += Number(r.amount ?? 0)
    if (askedInvoiceIds.has(r.id)) askedCount++
    if (r.due_date && (soonest == null || r.due_date < soonest)) soonest = r.due_date
  }
  return { count: movable.length, dollars, askedCount, soonestDueYmd: soonest }
}

/**
 * The doors out of a cell's row (punch list #132 PR 4). Every row opens its invoice through
 * the house's own form, so that door is not a decision. These two are: a charge with no due
 * date offers **Add a due date ›** and a charge on no job offers **Pick a job ›** — both land
 * on the same form, on that field, never on a form of the modal's own. A credit offers
 * neither: it has a size, not an age (v2.3500), and its pairing line is its job. A null
 * allocation count means the jobs are not read yet, so no Pick a job until they are.
 */
export type AgingCellRowDoors = { addDueDate: boolean; pickJob: boolean }

export function agingCellRowDoors(inv: { amount: number | null; due_date: string | null }, allocationCount: number | null): AgingCellRowDoors {
  const credit = Number(inv.amount ?? 0) < 0
  return {
    addDueDate: !credit && inv.due_date == null,
    pickJob: !credit && allocationCount === 0,
  }
}

/**
 * The modal's own footer doors. A house-scoped modal opens the house and makes a payment
 * through the house's existing Apply Payment door; the footer row's modal and the worked
 * list span every house, so there is no one house to open or pay. The credits cell holds
 * credit memos, which are applied against invoices, not paid, so it offers no payment.
 */
export type AgingCellModalDoors = { openHouse: boolean; makePayment: boolean }

export function agingCellModalDoors(houseId: string | null, cell: AgingCellKey | 'movable'): AgingCellModalDoors {
  const oneHouse = houseId != null && cell !== 'movable'
  return { openHouse: oneHouse, makePayment: oneHouse && cell !== 'credits' }
}
