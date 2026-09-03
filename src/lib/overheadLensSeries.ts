import { ymdAddDays } from '../utils/dateUtils'

/**
 * Per-lens history + sensitivity kernel (v2.2674) behind the People →
 * Overhead lens modals. Built from the SAME per-day maps the tab's 90-day
 * KPI/three-lenses effect already assembles (pool $, field hours, field
 * labor $, invoiced revenue $ by Chicago day) — zero new fetches.
 *
 * - Weekly bins: 7-day buckets counted back from `endYmd`; the oldest bin
 *   may be short (a 90-day window is 12 full weeks + 6 days) and says so via
 *   `days`. Each bin's rate is that bin's pool ÷ that bin's denominator —
 *   noisy by design, the honest week-by-week reading.
 * - Rolling rate: for each day, pool ÷ denominator over the trailing
 *   `rollingDays` (default 28) — the smoothed line. Null until the trailing
 *   span has a positive denominator.
 * - Sensitivity: how much the headline rate moves per unit of numerator or
 *   denominator, from the two partial derivatives (pool ÷ d² for the
 *   denominator, 1 ÷ d for the pool) — the "what moves it" numbers.
 *
 * Pure: no React, no Supabase.
 */

export type OverheadLensKey = 'A' | 'B' | 'C'

export type OverheadLensWeekPoint = {
  startYmd: string
  endYmd: string
  /** Calendar days in the bin (7, or fewer for the oldest bin). */
  days: number
  poolUsd: number
  denominator: number
  /** poolUsd ÷ denominator; null when the denominator is not positive. */
  rate: number | null
}

export type OverheadLensRollingPoint = { ymd: string; rate: number | null }

export type OverheadLensSeries = {
  weeks: OverheadLensWeekPoint[]
  rolling: OverheadLensRollingPoint[]
  rollingDays: number
}

export type OverheadLensSeriesInput = {
  poolUsdByDay: ReadonlyMap<string, number>
  denominatorByDay: ReadonlyMap<string, number>
  startYmd: string
  endYmd: string
  rollingDays?: number
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function calendarDays(startYmd: string, endYmd: string): string[] {
  const out: string[] = []
  if (startYmd > endYmd) return out
  for (let ymd = startYmd; ymd <= endYmd; ymd = ymdAddDays(ymd, 1)) out.push(ymd)
  return out
}

export function buildOverheadLensSeries(input: OverheadLensSeriesInput): OverheadLensSeries {
  const rollingDays = Math.max(1, Math.floor(input.rollingDays ?? 28))
  const days = calendarDays(input.startYmd, input.endYmd)
  const pool = days.map((d) => num(input.poolUsdByDay.get(d)))
  const den = days.map((d) => num(input.denominatorByDay.get(d)))

  const weeks: OverheadLensWeekPoint[] = []
  for (let end = days.length - 1; end >= 0; end -= 7) {
    const start = Math.max(0, end - 6)
    let p = 0
    let q = 0
    for (let i = start; i <= end; i++) {
      p += pool[i] as number
      q += den[i] as number
    }
    weeks.unshift({
      startYmd: days[start] as string,
      endYmd: days[end] as string,
      days: end - start + 1,
      poolUsd: p,
      denominator: q,
      rate: q > 0 ? p / q : null,
    })
  }

  const rolling: OverheadLensRollingPoint[] = days.map((ymd, i) => {
    const from = Math.max(0, i - rollingDays + 1)
    let p = 0
    let q = 0
    for (let j = from; j <= i; j++) {
      p += pool[j] as number
      q += den[j] as number
    }
    return { ymd, rate: q > 0 ? p / q : null }
  })

  return { weeks, rolling, rollingDays }
}

export type OverheadLensSensitivity = {
  /** Rate change per +1 unit of denominator (negative: more hours / $ dilutes the pool). */
  perDenominatorUnit: number | null
  /** Rate change per +$1 of pool. */
  perPoolDollar: number | null
}

/** Partial derivatives of rate = pool ÷ denominator at the current point; null when the denominator is not positive. */
export function overheadLensSensitivity(poolUsd: number, denominator: number): OverheadLensSensitivity {
  if (!Number.isFinite(poolUsd) || !Number.isFinite(denominator) || denominator <= 0) {
    return { perDenominatorUnit: null, perPoolDollar: null }
  }
  return { perDenominatorUnit: -poolUsd / (denominator * denominator), perPoolDollar: 1 / denominator }
}

/** The rate if the denominator grew by `extra` (e.g. pending field hours approved, pool unchanged); null when not computable. */
export function overheadLensRateWithExtraDenominator(poolUsd: number, denominator: number, extra: number): number | null {
  const d = denominator + extra
  if (!Number.isFinite(poolUsd) || !Number.isFinite(d) || d <= 0) return null
  return poolUsd / d
}
