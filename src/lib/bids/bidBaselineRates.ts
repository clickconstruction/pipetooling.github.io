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
  /**
   * 'similar' = jobs within a quarter to four times this bid's value; 'band' = too few of those, so the window widened
   * to the bid's whole size band (the owner's call of 2026-11-09, in place of every size). A band still under the sample
   * reads as 'band' with `n` under `BASELINE_MIN_SAMPLE`: the book says nothing here.
   */
  scope: 'similar' | 'band'
  /** The bid's size band, "$10k–$100k"; '' with no value. */
  band: string
  /** Every usable baseline in the book, whatever its size, so the words can tell an empty book from an empty band. */
  total: number
}

export const BASELINE_MIN_SAMPLE = 3
/** "Jobs like this": price within this factor of the bid's value either way. A $450 repair says nothing about a $120k build. */
export const BASELINE_SIZE_FACTOR = 4
/**
 * The size bands the book falls back to when fewer than three similar jobs exist (the owner's call of 2026-11-09): under
 * $10k, $10k to $100k, $100k to $1M, over $1M. The fallback is the window widened to the whole band, never every size — a
 * $350 repair never prices a $500k build. Punch list #234 names them.
 */
export const BASELINE_SIZE_BANDS: ReadonlyArray<{ minUsd: number; maxUsd: number | null; label: string }> = [
  { minUsd: 0, maxUsd: 10_000, label: 'under $10k' },
  { minUsd: 10_000, maxUsd: 100_000, label: '$10k–$100k' },
  { minUsd: 100_000, maxUsd: 1_000_000, label: '$100k–$1M' },
  { minUsd: 1_000_000, maxUsd: null, label: 'over $1M' },
]

/** The band a price falls in; the top band has no ceiling. */
export function baselineSizeBandOf(priceUsd: number): { minUsd: number; maxUsd: number | null; label: string } {
  return BASELINE_SIZE_BANDS.find((b) => priceUsd >= b.minUsd && (b.maxUsd == null || priceUsd < b.maxUsd)) ?? BASELINE_SIZE_BANDS[BASELINE_SIZE_BANDS.length - 1]!
}

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

/**
 * The reading at a value: the jobs within a quarter to four times it when three or more exist, else the window widened to
 * the value's whole size band (the owner's call of 2026-11-09). A band with fewer than three reads as that band, under the
 * sample, and says so; every size is never read. With no value, every usable baseline, so the Labor tab can still show
 * the book's spread before a bid is priced.
 */
export function baselineReading(rates: ReadonlyArray<BaselineRate>, bidValueUsd: number | null): BaselineReading {
  const all = rates.filter(usable)
  const value = bidValueUsd != null && bidValueUsd > 0 ? bidValueUsd : null
  const band = value != null ? baselineSizeBandOf(value) : null
  const near = value != null ? all.filter((r) => similar(r, value)) : all
  const inBand = band ? all.filter((r) => similar(r, value!) || (num(r.price_usd) >= band.minUsd && (band.maxUsd == null || num(r.price_usd) < band.maxUsd))) : near
  const scope: BaselineReading['scope'] = near.length >= BASELINE_MIN_SAMPLE || band == null ? 'similar' : 'band'
  const pick = scope === 'similar' ? near : inBand
  const xs = pick.map((r) => num(r.hours_per_thousand)).sort((a, b) => a - b)
  const med = median(xs)
  return {
    n: xs.length,
    medianHoursPerThousand: med,
    p25: quantile(xs, 0.25),
    p75: quantile(xs, 0.75),
    impliedHours: med != null && value != null ? (value / 1000) * med : null,
    billed: pick.filter((r) => r.kept_on === 'billed').length,
    scope,
    band: band?.label ?? '',
    total: all.length,
  }
}

/** "7 jobs of similar size" / "7 jobs in the $10k–$100k band" — the sample's words after its count. */
export function baselineScopeWords(b: Pick<BaselineReading, 'scope' | 'band'>, noun = 'jobs'): string {
  return b.scope === 'band' && b.band ? `${noun} in the ${b.band} band` : `${noun} of similar size`
}

/** "7.8 h per $1k · 42 billed jobs · this bid ≈ 960 h" / "no baselines yet" / "1 baseline in the $100k–$1M band so far · needs 3". */
export function baselineReadingWords(b: BaselineReading, fmtHours: (h: number) => string): string {
  if (b.total === 0) return 'no baselines yet — they are kept when jobs bill'
  if (b.n < BASELINE_MIN_SAMPLE) return `${b.n} baseline${b.n === 1 ? '' : 's'}${b.scope === 'band' && b.band ? ` in the ${b.band} band` : ''} so far · needs ${BASELINE_MIN_SAMPLE}${b.scope === 'band' && b.total > b.n ? ` · ${b.total} in the book, none read across sizes` : ''}`
  const spread = b.p25 != null && b.p75 != null ? ` (${b.p25.toFixed(1)}–${b.p75.toFixed(1)} middle half)` : ''
  return `${b.medianHoursPerThousand!.toFixed(1)} h per $1k${spread} · ${b.n} ${baselineScopeWords(b)}${b.impliedHours != null ? ` · this bid ≈ ${fmtHours(b.impliedHours)}` : ''}`
}
