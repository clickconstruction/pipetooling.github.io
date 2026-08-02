import { calendarYmdInAppTzFromIso, ymdAddDays } from '../utils/dateUtils'

/**
 * Stage-A extraction of the Overhead tab's 90-day KPI math (per
 * PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md): the trailing-window
 * `sumWindow` aggregation and the invoice → Chicago-calendar-day revenue
 * bucketing that used to live inline in the avg-cost effect.
 */

export type OverheadTrailingWindow = {
  /** Window length in calendar days (including zero-activity days). */
  days: number
  /** Sum of per-day overhead cost $ across the window. */
  costUsd: number
  /** Sum of per-day invoiced revenue $ across the window. */
  revenueUsd: number
  /** costUsd ÷ days — calendar-day average, zero-activity days included. */
  avgDailyCostUsd: number
  /** (costUsd ÷ revenueUsd) × 100 — $ of overhead per $100 of revenue; null when window revenue ≤ 0. */
  per100RevenueUsd: number | null
}

/**
 * Sums the trailing `days` calendar days ending at `endYmd` (inclusive).
 * Days absent from either map count as $0 — the divisor is always the fixed
 * window length, matching the KPI tooltip's "calendar-day average" wording.
 */
export function computeOverheadTrailingWindow(args: {
  totalsByDay: ReadonlyMap<string, number>
  revenueByDay: ReadonlyMap<string, number>
  endYmd: string
  days: number
}): OverheadTrailingWindow {
  const { totalsByDay, revenueByDay, endYmd, days } = args
  let costUsd = 0
  let revenueUsd = 0
  for (let i = 0; i < days; i++) {
    const ymd = ymdAddDays(endYmd, -i)
    costUsd += totalsByDay.get(ymd) ?? 0
    revenueUsd += revenueByDay.get(ymd) ?? 0
  }
  return {
    days,
    costUsd,
    revenueUsd,
    avgDailyCostUsd: costUsd / days,
    per100RevenueUsd: revenueUsd > 0 ? (costUsd / revenueUsd) * 100 : null,
  }
}

/** The Overhead tab's three KPI windows (7 / 30 / 90 trailing days ending `todayYmd`). */
export function computeOverheadTrailingAverages(args: {
  totalsByDay: ReadonlyMap<string, number>
  revenueByDay: ReadonlyMap<string, number>
  todayYmd: string
}): { w7: OverheadTrailingWindow; w30: OverheadTrailingWindow; w90: OverheadTrailingWindow } {
  const { totalsByDay, revenueByDay, todayYmd } = args
  const win = (days: number) =>
    computeOverheadTrailingWindow({ totalsByDay, revenueByDay, endYmd: todayYmd, days })
  return { w7: win(7), w30: win(30), w90: win(90) }
}

/**
 * Buckets invoice rows into per-Chicago-calendar-day revenue $, clamped to
 * `[startYmd, endYmd]`. Callers fetch a day wide on both sides of the window
 * (UTC bounds) and let this re-bucket each `sent_to_customer_at` into its
 * app-timezone wall date — the v2.1249 fix for the old UTC-bounded window
 * that pulled in the previous evening's invoices and dropped everything sent
 * after ~6pm on the last day.
 */
export function bucketInvoiceRevenueByAppTzDay(
  rows: ReadonlyArray<{ amount: number | string | null; sent_to_customer_at: string | null }>,
  startYmd: string,
  endYmd: string,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.sent_to_customer_at) continue
    const ymd = calendarYmdInAppTzFromIso(r.sent_to_customer_at)
    if (ymd < startYmd || ymd > endYmd) continue
    out.set(ymd, (out.get(ymd) ?? 0) + Number(r.amount ?? 0))
  }
  return out
}
