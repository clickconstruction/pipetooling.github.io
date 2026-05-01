import type { BidBoardWeeklySentPivot } from './bidBoardWeeklySentStats'
import { companyWeekStartSundayContaining } from '../utils/dateUtils'

/** Mirrors `bidBoardWeeklySentStats` unassigned sentinel. */
export const BID_BOARD_ESTIMATOR_UNASSIGNED_KEY = '__unassigned__'

export type ClockSessionRowForLaborCost = {
  user_id: string
  work_date: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  rejected_at: string | null
  revoked_at: string | null
}

export type BidBoardWeeklyLaborCostCell = {
  costPerEstimateDollars: number | null
  laborCentsPerDollarSent: number | null
}

/** Case-insensitive key for joining `users.name` to `people_pay_config.person_name`. */
export function payConfigLookupKey(personName: string): string {
  return personName.trim().toLowerCase()
}

/** Map person_name rows to normalized lookup keys (later keys overwrite on collision). */
export function buildHourlyWageLookupByNormalizedName(
  configs: readonly { person_name: string; hourly_wage: number | null }[],
): Map<string, number | null> {
  const m = new Map<string, number | null>()
  for (const c of configs) {
    m.set(payConfigLookupKey(c.person_name), c.hourly_wage)
  }
  return m
}

export function hourlyWageForUserName(
  userDisplayName: string | null | undefined,
  wageByNormalizedName: Map<string, number | null>,
): number | null {
  const raw = userDisplayName?.trim() ?? ''
  if (!raw) return null
  if (!wageByNormalizedName.has(payConfigLookupKey(raw))) return null
  return wageByNormalizedName.get(payConfigLookupKey(raw)) ?? null
}

/**
 * Builds `Map<`${userId}:${weekStart}`, hours>` for pivot weeks (Chicago Sunday-start)
 * using session `work_date` — all clock time that week for that user, excluding rejected/revoked.
 */
export function aggregateClockHoursByUserAndWeek(
  sessions: readonly ClockSessionRowForLaborCost[],
  nowMs: number,
): Map<string, number> {
  const out = new Map<string, number>()

  for (const s of sessions) {
    if (s.rejected_at || s.revoked_at) continue
    const wd = s.work_date?.trim()
    if (!wd) continue

    const weekStart = companyWeekStartSundayContaining(wd)
    if (!weekStart) continue

    const t0 = new Date(s.clocked_in_at).getTime()
    const t1 = s.clocked_out_at != null ? new Date(s.clocked_out_at).getTime() : nowMs
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) continue

    const hours = (t1 - t0) / 3600000
    const key = `${s.user_id}:${weekStart}`
    out.set(key, (out.get(key) ?? 0) + hours)
  }

  return out
}

/**
 * Pure labor-cost metrics aligned with Weekly bids sent pivot cells.
 * Missing hourly wage configuration → both metrics null.
 * Zero sent count or zero sent dollars → divide-by-zero guarded (null).
 */
export function buildBidBoardWeeklyLaborCostMatrix(args: {
  pivot: BidBoardWeeklySentPivot
  hoursByUserWeek: Map<string, number>
  wageByUserId: Map<string, number | null>
}): Map<string, BidBoardWeeklyLaborCostCell> {
  const { pivot, hoursByUserWeek, wageByUserId } = args
  const out = new Map<string, BidBoardWeeklyLaborCostCell>()

  for (const row of pivot.rows) {
    if (row.estimatorKey === BID_BOARD_ESTIMATOR_UNASSIGNED_KEY) continue

    for (const w of pivot.weeks) {
      const cell = row.byWeek[w.weekStart] ?? { sentCount: 0, sentDollars: 0, bidIds: [] }
      const key = `${row.estimatorKey}::${w.weekStart}`
      const wage = wageByUserId.get(row.estimatorKey)

      let costPerEstimateDollars: number | null = null
      let laborCentsPerDollarSent: number | null = null

      if (wage !== undefined && wage !== null && Number.isFinite(wage)) {
        const hours = hoursByUserWeek.get(`${row.estimatorKey}:${w.weekStart}`) ?? 0
        const laborUsd = hours * wage
        if (cell.sentCount > 0) costPerEstimateDollars = laborUsd / cell.sentCount
        if (cell.sentDollars > 0) laborCentsPerDollarSent = (laborUsd / cell.sentDollars) * 100
      }

      out.set(key, { costPerEstimateDollars, laborCentsPerDollarSent })
    }
  }

  return out
}

export function formatLaborCentsPerDollarSent(centsPerDollar: number): string {
  if (!Number.isFinite(centsPerDollar)) return '—'
  const rounded = Math.round(centsPerDollar * 10) / 10
  return `${rounded}¢/$`
}
