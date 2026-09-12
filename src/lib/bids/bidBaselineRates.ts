/**
 * The labor book's per-$1k fallback (v2.3367): every kept job baseline as
 * hours per $1,000 of price, read into one number a bid can use before anyone
 * costs it — "billed jobs like this ran 7.8 h per $1k · this bid's value → ≈ 960 h".
 * Pure. The median, not the mean: one odd job should not move the book.
 */
export type BaselineRate = {
  job_id: string
  bid_id: string | null
  kept_at: string
  kept_on: 'billed' | 'kept' | string
  price_usd: number | string | null
  team_hours: number | string | null
  hours_per_thousand: number | string | null
  people_count: number | null
  grade: 'per_thousand' | 'fixture' | string
}

export type BaselineReading = {
  /** Baselines with a usable rate. */
  n: number
  medianHoursPerThousand: number | null
  p25: number | null
  p75: number | null
  /** The bid's value × the median; null without a value or a rate. */
  impliedHours: number | null
  /** How many of the rates came from billed jobs (the rest were kept by hand mid-job). */
  billed: number
  /** 'similar' = jobs within a quarter to four times this bid's value; 'all' = every usable baseline (too few similar ones). */
  scope: 'similar' | 'all'
}

export const BASELINE_MIN_SAMPLE = 3
/** "Jobs like this": price within this factor of the bid's value either way. A $450 repair says nothing about a $120k build. */
export const BASELINE_SIZE_FACTOR = 4

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'number' ? v : v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : NaN
}
const quantile = (sorted: number[], q: number): number | null => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]! : null)
const median = (sorted: number[]): number | null => {
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Rates worth reading: a positive price and hours, and a job big enough that one visit is not the whole story (≥ 8 h). */
const usable = (r: BaselineRate): boolean => num(r.price_usd) > 0 && num(r.team_hours) >= 8 && num(r.hours_per_thousand) > 0
const similar = (r: BaselineRate, value: number): boolean => num(r.price_usd) >= value / BASELINE_SIZE_FACTOR && num(r.price_usd) <= value * BASELINE_SIZE_FACTOR

export function usableBaselineRates(rates: ReadonlyArray<BaselineRate>): number[] {
  return rates.filter(usable).map((r) => num(r.hours_per_thousand)).sort((a, b) => a - b)
}

export function baselineReading(rates: ReadonlyArray<BaselineRate>, bidValueUsd: number | null): BaselineReading {
  const all = rates.filter(usable)
  const near = bidValueUsd != null && bidValueUsd > 0 ? all.filter((r) => similar(r, bidValueUsd)) : []
  const scope: BaselineReading['scope'] = near.length >= BASELINE_MIN_SAMPLE ? 'similar' : 'all'
  const pick = scope === 'similar' ? near : all
  const xs = pick.map((r) => num(r.hours_per_thousand)).sort((a, b) => a - b)
  const med = median(xs)
  return {
    n: xs.length,
    medianHoursPerThousand: med,
    p25: quantile(xs, 0.25),
    p75: quantile(xs, 0.75),
    impliedHours: med != null && bidValueUsd != null && bidValueUsd > 0 ? (bidValueUsd / 1000) * med : null,
    billed: pick.filter((r) => r.kept_on === 'billed').length,
    scope,
  }
}

/** "7.8 h per $1k · 42 billed jobs · this bid ≈ 960 h" / "no baselines yet". */
export function baselineReadingWords(b: BaselineReading, fmtHours: (h: number) => string): string {
  if (b.n === 0) return 'no baselines yet — they are kept when jobs bill'
  if (b.n < BASELINE_MIN_SAMPLE) return `${b.n} baseline${b.n === 1 ? '' : 's'} so far · needs ${BASELINE_MIN_SAMPLE}`
  const spread = b.p25 != null && b.p75 != null ? ` (${b.p25.toFixed(1)}–${b.p75.toFixed(1)} middle half)` : ''
  return `${b.medianHoursPerThousand!.toFixed(1)} h per $1k${spread} · ${b.n} ${b.scope === 'similar' ? 'jobs of similar size' : 'jobs, all sizes'}${b.impliedHours != null ? ` · this bid ≈ ${fmtHours(b.impliedHours)}` : ''}`
}
