/**
 * Projects → Job History day-detail modal: pure cost aggregation.
 *
 * Given the same approved-closed clock sessions the modal already displays plus the raw Mercury
 * job allocations and supply-house invoice allocations for the job, this module computes the
 * three cost lines we show beneath "People & sessions":
 *
 *   1. **Team labor** — clock-based: `hours × hourly_wage` per session. Hours come from the
 *      session's own clock-in / clock-out (matches the "Man hours" summary above the costs
 *      panel). Wage is looked up by normalized `users.name` against `people_pay_config`, the
 *      same convention `overheadDailyLabor` / `bidBoardWeeklyEstimatorLaborCost` use.
 *   2. **Card charges (Mercury)** — sum of `Math.abs(amount)` on
 *      `mercury_transaction_job_allocations` rows whose underlying transaction's `posted_at`
 *      falls on the modal's Chicago `work_date`.
 *   3. **Supply invoices** — sum of `pct × invoice_amount / 100` on
 *      `supply_house_invoice_job_allocations` rows whose invoice's `invoice_date` equals the
 *      modal's `work_date`.
 *
 * The supply / Mercury patterns mirror `fetchOverheadOfficePartsByDay` and
 * `fetchJobMaterialsCostSnapshot`. We do **not** include `jobs_ledger_materials` (no business
 * day field), `jobs_tally_parts`, or sub labor here — those can be added later if needed.
 *
 * Pure: no Supabase, no React. The modal's loader queries the raw rows and passes them in.
 */

import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import {
  hourlyWageForUserName,
  payConfigLookupKey,
} from './bidBoardWeeklyEstimatorLaborCost'
import { approvedClosedSessionHours } from './overheadDailyLabor'

export type DayCostSessionInput = {
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
}

export type DayCostMercuryAllocationInput = {
  amount: number | string | null
  /** ISO instant from the joined `mercury_transactions.posted_at`. */
  posted_at: string | null
  /** Joined `mercury_transactions.counterparty_name`. Optional — used for detail rows only. */
  counterparty_name?: string | null
  /** Free-text note from the allocation row itself (optional, used for detail rows). */
  note?: string | null
}

export type DayCostSupplyAllocationInput = {
  /** Allocation percent (0-100). */
  pct: number | string | null
  /** `invoice_amount` from the joined `supply_house_invoices.amount`. */
  invoice_amount: number | string | null
  /** `YYYY-MM-DD` slice of `supply_house_invoices.invoice_date`. */
  invoice_date: string | null
  /** Joined `supply_house_invoices.invoice_number`. Optional — used for detail rows only. */
  invoice_number?: string | null
  /** Joined `supply_house_invoices.supply_houses.name`. Optional — used for detail rows only. */
  supply_house_name?: string | null
}

/** One row per person who clocked time on the day — the building block of "Team labor" details. */
export type DayLaborLine = {
  userId: string
  userName: string
  /** Total approved-closed clock hours for this user on the day (open sessions excluded). */
  hours: number
  /** `hourly_wage` from `people_pay_config`, or `null` when not configured for this user. */
  hourlyWage: number | null
  /** `hours × hourlyWage` (0 when `hourlyWage` is null). */
  usd: number
  /** True iff this user had at least one open session on the day. */
  hasOpenSession: boolean
}

/** One row per Mercury allocation posted on the day. */
export type DayMercuryLine = {
  counterpartyName: string | null
  postedAt: string | null
  amountUsd: number
  note: string | null
}

/** One row per supply-invoice allocation dated on the day. */
export type DaySupplyLine = {
  supplyHouseName: string | null
  invoiceNumber: string
  invoiceDate: string
  /** `invoice_amount × pct / 100`. */
  allocatedUsd: number
  invoiceTotalUsd: number
  /** Allocation share (0-100). */
  pct: number
}

export type DayCostBreakdown = {
  /** Sum of `hours × wage` across sessions for which we found a wage. */
  laborUsd: number
  /** Display names of users on this day who clocked time but have no `people_pay_config` row. */
  laborMissingWageNames: string[]
  /** True iff the labor figure could not be computed for at least one session on the day. */
  laborIncomplete: boolean
  /** Per-person labor detail rows (sorted alphabetically by `userName`). */
  laborLines: DayLaborLine[]
  /** Sum of `Math.abs(amount)` for Mercury job allocations posted on `workDateYmd`. */
  mercuryUsd: number
  /** Per-allocation Mercury detail rows for the day (sorted newest first by `postedAt`). */
  mercuryLines: DayMercuryLine[]
  /** Sum of `pct/100 × invoice_amount` for supply allocations whose invoice is dated `workDateYmd`. */
  supplyUsd: number
  /** Per-invoice supply detail rows for the day (sorted by `supplyHouseName` then `invoiceNumber`). */
  supplyLines: DaySupplyLine[]
  /** `laborUsd + mercuryUsd + supplyUsd`. */
  totalUsd: number
}

/**
 * Build the labor cost line. `userNamesById` maps `user_id → display name` (typically the
 * value already loaded for the modal's session cards). `wageByNormalizedName` is what you get
 * from `buildHourlyWageLookupByNormalizedName(people_pay_config_rows)`.
 *
 * Returns `{ usd, missingWageNames }` so the caller can warn the user when labor is partial.
 */
export function computeDayLaborCost(
  sessions: readonly DayCostSessionInput[],
  userNamesById: ReadonlyMap<string, string>,
  /**
   * Typed as the mutable `Map` (not `ReadonlyMap`) because
   * `hourlyWageForUserName` in `bidBoardWeeklyEstimatorLaborCost` takes a `Map`. The function
   * never mutates the value internally; the type widening is for compatibility only.
   */
  wageByNormalizedName: Map<string, number | null>,
): { usd: number; missingWageNames: string[]; incomplete: boolean } {
  let usd = 0
  const missing = new Set<string>()
  let incomplete = false

  for (const s of sessions) {
    const hours = approvedClosedSessionHours(s)
    if (hours == null) {
      // Open session — we can't compute its labor, but it shouldn't be flagged as "missing wage"
      // because the wage could still be set. Mark the total incomplete so the UI can show "≥".
      incomplete = true
      continue
    }
    const name = (userNamesById.get(s.user_id) ?? '').trim()
    if (!name) {
      incomplete = true
      continue
    }
    if (!wageByNormalizedName.has(payConfigLookupKey(name))) {
      missing.add(name)
      incomplete = true
      continue
    }
    const wage = hourlyWageForUserName(name, wageByNormalizedName)
    if (wage == null || !Number.isFinite(wage)) {
      missing.add(name)
      incomplete = true
      continue
    }
    usd += hours * wage
  }

  return {
    usd,
    missingWageNames: Array.from(missing).sort((a, b) => a.localeCompare(b)),
    incomplete,
  }
}

/**
 * Sum of Mercury allocation magnitudes whose underlying transaction was posted on
 * `workDateYmd` (Chicago calendar). Rows whose `posted_at` is missing or doesn't resolve to a
 * valid calendar day are skipped silently — matches `fetchOverheadOfficePartsByDay`.
 */
export function computeDayMercuryCost(
  allocations: readonly DayCostMercuryAllocationInput[],
  workDateYmd: string,
): number {
  let usd = 0
  for (const a of allocations) {
    if (!a.posted_at) continue
    const ymd = calendarYmdInAppTzFromIso(a.posted_at)
    if (ymd !== workDateYmd) continue
    const amt = Number(a.amount)
    if (!Number.isFinite(amt)) continue
    usd += Math.abs(amt)
  }
  return usd
}

/**
 * Sum of allocated supply-invoice dollars whose `invoice_date` matches `workDateYmd`.
 * The allocation share is `pct/100 × invoice_amount`, mirroring `fetchJobMaterialsCostSnapshot`.
 */
export function computeDaySupplyCost(
  allocations: readonly DayCostSupplyAllocationInput[],
  workDateYmd: string,
): number {
  let usd = 0
  for (const a of allocations) {
    const ymd = a.invoice_date ? String(a.invoice_date).slice(0, 10) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
    if (ymd !== workDateYmd) continue
    const pct = Number(a.pct)
    const invAmt = Number(a.invoice_amount)
    if (!Number.isFinite(pct) || !Number.isFinite(invAmt)) continue
    usd += (invAmt * pct) / 100
  }
  return usd
}

/**
 * Build per-person labor detail rows for the day. Sessions are grouped by `user_id`; hours sum
 * `approvedClosedSessionHours` across that user's sessions (open sessions contribute 0 but flip
 * `hasOpenSession`). Wage is looked up by normalized name. Sorted by display name.
 */
export function computeDayLaborLines(
  sessions: readonly DayCostSessionInput[],
  userNamesById: ReadonlyMap<string, string>,
  wageByNormalizedName: Map<string, number | null>,
): DayLaborLine[] {
  const byUser = new Map<
    string,
    { userName: string; hours: number; hasOpenSession: boolean }
  >()
  for (const s of sessions) {
    const userId = s.user_id
    const userName = (userNamesById.get(userId) ?? '').trim() || 'Unknown user'
    const existing = byUser.get(userId) ?? { userName, hours: 0, hasOpenSession: false }
    const h = approvedClosedSessionHours(s)
    if (h == null) {
      existing.hasOpenSession = true
    } else {
      existing.hours += h
    }
    byUser.set(userId, existing)
  }

  const lines: DayLaborLine[] = []
  for (const [userId, agg] of byUser) {
    const wageRaw = hourlyWageForUserName(agg.userName, wageByNormalizedName)
    const hourlyWage =
      wageRaw != null && Number.isFinite(wageRaw) ? Number(wageRaw) : null
    const usd = hourlyWage != null ? agg.hours * hourlyWage : 0
    lines.push({
      userId,
      userName: agg.userName,
      hours: agg.hours,
      hourlyWage,
      usd,
      hasOpenSession: agg.hasOpenSession,
    })
  }
  lines.sort((a, b) => a.userName.localeCompare(b.userName))
  return lines
}

/**
 * Build per-allocation Mercury detail rows for the day, sorted newest first by `posted_at`
 * (most-recently-posted transactions float to the top). Allocations posted outside the day
 * or with unparseable amounts are dropped.
 */
export function computeDayMercuryLines(
  allocations: readonly DayCostMercuryAllocationInput[],
  workDateYmd: string,
): DayMercuryLine[] {
  const lines: DayMercuryLine[] = []
  for (const a of allocations) {
    if (!a.posted_at) continue
    const ymd = calendarYmdInAppTzFromIso(a.posted_at)
    if (ymd !== workDateYmd) continue
    const amt = Number(a.amount)
    if (!Number.isFinite(amt)) continue
    lines.push({
      counterpartyName: a.counterparty_name ?? null,
      postedAt: a.posted_at,
      amountUsd: Math.abs(amt),
      note: a.note ?? null,
    })
  }
  lines.sort((a, b) => {
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0
    return tb - ta
  })
  return lines
}

/**
 * Build per-invoice supply detail rows for the day, sorted by supply-house name then
 * invoice number. Allocations whose `invoice_date` doesn't match `workDateYmd` or whose
 * numeric values are unparseable are dropped.
 */
export function computeDaySupplyLines(
  allocations: readonly DayCostSupplyAllocationInput[],
  workDateYmd: string,
): DaySupplyLine[] {
  const lines: DaySupplyLine[] = []
  for (const a of allocations) {
    const ymd = a.invoice_date ? String(a.invoice_date).slice(0, 10) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
    if (ymd !== workDateYmd) continue
    const pct = Number(a.pct)
    const invAmt = Number(a.invoice_amount)
    if (!Number.isFinite(pct) || !Number.isFinite(invAmt)) continue
    const allocated = (invAmt * pct) / 100
    lines.push({
      supplyHouseName: a.supply_house_name ?? null,
      invoiceNumber: a.invoice_number ?? '',
      invoiceDate: ymd,
      allocatedUsd: allocated,
      invoiceTotalUsd: invAmt,
      pct,
    })
  }
  lines.sort((a, b) => {
    const sh = (a.supplyHouseName ?? '').localeCompare(b.supplyHouseName ?? '')
    if (sh !== 0) return sh
    return a.invoiceNumber.localeCompare(b.invoiceNumber)
  })
  return lines
}

export function buildDayCostBreakdown(args: {
  sessions: readonly DayCostSessionInput[]
  userNamesById: ReadonlyMap<string, string>
  wageByNormalizedName: Map<string, number | null>
  mercuryAllocations: readonly DayCostMercuryAllocationInput[]
  supplyAllocations: readonly DayCostSupplyAllocationInput[]
  workDateYmd: string
}): DayCostBreakdown {
  const labor = computeDayLaborCost(args.sessions, args.userNamesById, args.wageByNormalizedName)
  const laborLines = computeDayLaborLines(
    args.sessions,
    args.userNamesById,
    args.wageByNormalizedName,
  )
  const mercuryLines = computeDayMercuryLines(args.mercuryAllocations, args.workDateYmd)
  const supplyLines = computeDaySupplyLines(args.supplyAllocations, args.workDateYmd)
  const mercuryUsd = mercuryLines.reduce((s, l) => s + l.amountUsd, 0)
  const supplyUsd = supplyLines.reduce((s, l) => s + l.allocatedUsd, 0)
  return {
    laborUsd: labor.usd,
    laborMissingWageNames: labor.missingWageNames,
    laborIncomplete: labor.incomplete,
    laborLines,
    mercuryUsd,
    mercuryLines,
    supplyUsd,
    supplyLines,
    totalUsd: labor.usd + mercuryUsd + supplyUsd,
  }
}

/** "$1,234.56" / "$0.00" — locale-formatted USD. */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '—'
  return usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
