import { ymdAddDays } from '../utils/dateUtils'

/**
 * Overhead pool trend + composition kernel (v2.2673) for People → Overhead.
 *
 * Takes the SAME per-day maps the tab's 90-day KPI/three-lenses effect already
 * builds (`buildOverheadDailyLabor(...).byDay` rows for office/bid labor $ and
 * the office-parts $/day loader) and answers two owner questions the KPI trio
 * couldn't: is the pool trending up or down, and what is it made of.
 *
 * - `days` is the full calendar window, zero-filled (a day with no session
 *   and no part is a real $0 day, not a gap), each with a trailing 7-day
 *   average of the total so a chart can draw the smoothed line.
 * - `direction` compares the average daily pool over the most recent
 *   `compareDays` (default 30) against the `compareDays` before that. Inside
 *   ±`flatBandPct` (default 5%) it reads "flat" — day-to-day parts spikes
 *   would otherwise flip the arrow every load.
 *
 * Pure: no React, no Supabase. Same approval/pricing semantics as the inputs —
 * unapproved time is absent here too (the hygiene strip says so).
 */

export type OverheadPoolTrendDay = {
  ymd: string
  officeLaborUsd: number
  bidLaborUsd: number
  officePartsUsd: number
  totalUsd: number
  /** Mean of `totalUsd` over this day and the 6 before it (fewer at the window start). */
  trailing7AvgUsd: number
}

export type OverheadPoolTrendDirection = 'up' | 'down' | 'flat'

export type OverheadPoolTrend = {
  days: OverheadPoolTrendDay[]
  totals: { officeLaborUsd: number; bidLaborUsd: number; officePartsUsd: number; totalUsd: number }
  compareDays: number
  /** Avg $/calendar-day over the last `compareDays` days (inclusive of the window end). */
  recentAvgDailyUsd: number
  /** Avg $/calendar-day over the `compareDays` days before that. */
  priorAvgDailyUsd: number
  /** (recent − prior) ÷ prior; null when the prior span has no cost (nothing to compare against). */
  deltaPct: number | null
  direction: OverheadPoolTrendDirection
}

export type OverheadPoolTrendInput = {
  /** `buildOverheadDailyLabor(...).byDay` — one row per day that had office/bid sessions. */
  laborDays: ReadonlyArray<{ work_date: string; officeLaborUsd: number; bidLaborUsd: number }>
  partsUsdByDay: ReadonlyMap<string, number>
  startYmd: string
  endYmd: string
  compareDays?: number
  flatBandPct?: number
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function buildOverheadPoolTrend(input: OverheadPoolTrendInput): OverheadPoolTrend {
  const compareDays = Math.max(1, Math.floor(input.compareDays ?? 30))
  const flatBandPct = input.flatBandPct ?? 0.05

  const laborByDay = new Map(input.laborDays.map((r) => [r.work_date, r]))
  const days: OverheadPoolTrendDay[] = []
  const totals = { officeLaborUsd: 0, bidLaborUsd: 0, officePartsUsd: 0, totalUsd: 0 }
  if (input.startYmd <= input.endYmd) {
    for (let ymd = input.startYmd; ymd <= input.endYmd; ymd = ymdAddDays(ymd, 1)) {
      const labor = laborByDay.get(ymd)
      const officeLaborUsd = num(labor?.officeLaborUsd)
      const bidLaborUsd = num(labor?.bidLaborUsd)
      const officePartsUsd = num(input.partsUsdByDay.get(ymd))
      const totalUsd = officeLaborUsd + bidLaborUsd + officePartsUsd
      totals.officeLaborUsd += officeLaborUsd
      totals.bidLaborUsd += bidLaborUsd
      totals.officePartsUsd += officePartsUsd
      totals.totalUsd += totalUsd
      days.push({ ymd, officeLaborUsd, bidLaborUsd, officePartsUsd, totalUsd, trailing7AvgUsd: 0 })
    }
  }
  for (let i = 0; i < days.length; i++) {
    const from = Math.max(0, i - 6)
    let sum = 0
    for (let j = from; j <= i; j++) sum += (days[j] as OverheadPoolTrendDay).totalUsd
    ;(days[i] as OverheadPoolTrendDay).trailing7AvgUsd = sum / (i - from + 1)
  }

  const recent = days.slice(Math.max(0, days.length - compareDays))
  const prior = days.slice(Math.max(0, days.length - 2 * compareDays), Math.max(0, days.length - compareDays))
  const avg = (rows: OverheadPoolTrendDay[]): number =>
    rows.length ? rows.reduce((s, d) => s + d.totalUsd, 0) / rows.length : 0
  const recentAvgDailyUsd = avg(recent)
  const priorAvgDailyUsd = avg(prior)
  const deltaPct = prior.length > 0 && priorAvgDailyUsd > 0 ? (recentAvgDailyUsd - priorAvgDailyUsd) / priorAvgDailyUsd : null
  const direction: OverheadPoolTrendDirection =
    deltaPct == null || Math.abs(deltaPct) < flatBandPct ? 'flat' : deltaPct > 0 ? 'up' : 'down'

  return { days, totals, compareDays, recentAvgDailyUsd, priorAvgDailyUsd, deltaPct, direction }
}
