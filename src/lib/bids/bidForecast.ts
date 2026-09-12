/**
 * History & forecast — the fourth lens on Bids → Bid Costs (v2.3355). Pure.
 *
 * Reads the pursuit ledger's rows (`bidPursuit.ts`) for every SENT bid and
 * answers three questions the owner asked on 2026-09-11:
 *
 *   history   Bids sent each month, by what they became (won / lost / still
 *             open), with the win rate of the decided ones by count and by
 *             value. Months younger than FORECAST_MATURITY_DAYS are "still
 *             deciding" — drawn, but not trusted for the odds.
 *   decision  Days from sent to decided, from `bids.outcome_at` (v2.3354).
 *             Empty until enough decisions carry a date.
 *   forecast  What the open bids should bring in. Each open bid sent within
 *             the last FORECAST_MATURITY_DAYS is counted at the odds bids of
 *             its SIZE have actually won (small bids win ~40 %, big ones have
 *             not) — one blended rate would hand the biggest bid the average
 *             odds and the forecast would be that one bid. Older opens are
 *             stale (probably lost, unmarked) and left out, and named.
 *
 * Per person: a person with FORECAST_MIN_DECIDED_FOR_OWN_RATE mature decided
 * bids uses their own odds per band (a band with fewer than
 * FORECAST_MIN_BAND_DECIDED falls back to everyone's); fewer than that uses
 * everyone's. Nothing here is a wage, so every role that opens the tab reads it.
 */
import type { PursuitOutcome, PursuitRow } from './bidPursuit'

export const FORECAST_MATURITY_DAYS = 120
export const FORECAST_MIN_DECIDED_FOR_OWN_RATE = 10
export const FORECAST_MIN_BAND_DECIDED = 5
export const DECISION_TIMES_MIN_SAMPLE = 5

export type SizeBand = 'small' | 'mid' | 'large'
export const FORECAST_SIZE_BANDS: ReadonlyArray<{ key: SizeBand; label: string; max: number | null }> = [
  { key: 'small', label: 'Under $50k', max: 50_000 },
  { key: 'mid', label: '$50k – $500k', max: 500_000 },
  { key: 'large', label: 'Over $500k', max: null },
]

const ymdToDays = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map((s) => Number(s))
  return Math.round(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 86_400_000)
}
export const daysBetween = (fromYmd: string, toYmd: string): number => ymdToDays(toYmd) - ymdToDays(fromYmd)

/** The bids the lens reads: sent (never "unsent"), dated, robots folded unless asked, one person when asked ('' = no estimator). */
export function forecastRows(rows: ReadonlyArray<PursuitRow>, opts: { showRobots: boolean; estimator: string | null }): PursuitRow[] {
  return rows.filter((r) => r.outcome !== 'unsent' && r.dateYmd != null && (opts.showRobots || !r.robot) && (opts.estimator == null || (r.estimatorName ?? '') === opts.estimator))
}

export const ageDays = (r: Pick<PursuitRow, 'dateYmd'>, todayYmd: string): number | null => (r.dateYmd ? daysBetween(r.dateYmd, todayYmd) : null)
export const isMature = (r: Pick<PursuitRow, 'dateYmd'>, todayYmd: string): boolean => (ageDays(r, todayYmd) ?? 0) >= FORECAST_MATURITY_DAYS
export const isStaleOpen = (r: Pick<PursuitRow, 'dateYmd' | 'outcome'>, todayYmd: string): boolean => r.outcome === 'open' && isMature(r, todayYmd)

/** A bid with no value reads as small — the bids that carry no number are small jobs, not big ones. */
export function sizeBandOf(value: number | null): SizeBand {
  const v = value ?? 0
  for (const b of FORECAST_SIZE_BANDS) if (b.max == null || v < b.max) return b.key
  return 'large'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Sep ’26" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ’${(y ?? '').slice(2)}`
}
const nextMonth = (month: string): string => {
  const [y, m] = month.split('-').map((s) => Number(s))
  return m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, '0')}`
}

export type CohortBucket = 'won' | 'lost' | 'open' | 'openStale'
export const COHORT_BUCKET_LABELS: Record<CohortBucket, string> = { won: 'Won', lost: 'Lost', open: 'Still open', openStale: 'Open, sent 120+ days ago' }

export type CohortMonth = {
  month: string
  label: string
  won: number
  lost: number
  open: number
  openStale: number
  wonUsd: number
  lostUsd: number
  openUsd: number
  openStaleUsd: number
  /** won ÷ decided by count; null with nothing decided. */
  rateByCount: number | null
  rateByValue: number | null
  /** Sent within FORECAST_MATURITY_DAYS — read the rate lightly. */
  deciding: boolean
  bids: Record<CohortBucket, PursuitRow[]>
}

/** One entry per calendar month from the first sent bid to today's month, empty months included. Bids dated before 2020 are data errors and skipped. */
export function cohortsByMonth(rows: ReadonlyArray<PursuitRow>, todayYmd: string): CohortMonth[] {
  const byMonth = new Map<string, CohortMonth>()
  const mk = (month: string): CohortMonth => ({ month, label: monthLabel(month), won: 0, lost: 0, open: 0, openStale: 0, wonUsd: 0, lostUsd: 0, openUsd: 0, openStaleUsd: 0, rateByCount: null, rateByValue: null, deciding: false, bids: { won: [], lost: [], open: [], openStale: [] } })
  let first: string | null = null
  for (const r of rows) {
    if (!r.dateYmd || r.dateYmd < '2020-01-01') continue
    const month = r.dateYmd.slice(0, 7)
    if (first == null || month < first) first = month
    const c = byMonth.get(month) ?? mk(month)
    const bucket: CohortBucket = r.outcome === 'won' ? 'won' : r.outcome === 'lost' ? 'lost' : isStaleOpen(r, todayYmd) ? 'openStale' : 'open'
    c[bucket]++
    c[`${bucket}Usd`] += r.bidValue ?? 0
    c.bids[bucket].push(r)
    byMonth.set(month, c)
  }
  if (first == null) return []
  const out: CohortMonth[] = []
  const last = todayYmd.slice(0, 7)
  const matureBefore = todayYmd // a month is "deciding" when its last day is inside the maturity window
  for (let m = first; m <= last; m = nextMonth(m)) {
    const c = byMonth.get(m) ?? mk(m)
    const decided = c.won + c.lost
    c.rateByCount = decided > 0 ? c.won / decided : null
    const decidedUsd = c.wonUsd + c.lostUsd
    c.rateByValue = decidedUsd > 0 ? c.wonUsd / decidedUsd : null
    // deciding: the month's first day is younger than the maturity window
    c.deciding = daysBetween(`${m}-01`, matureBefore) < FORECAST_MATURITY_DAYS
    out.push(c)
  }
  return out
}

export type BandOdds = { band: SizeBand; label: string; won: number; lost: number; byCount: number | null; byValue: number | null; bids: PursuitRow[] }
export type Odds = { bands: Record<SizeBand, BandOdds>; won: number; lost: number; byCount: number | null; byValue: number | null }

const rateOf = (won: number, lost: number): number | null => (won + lost > 0 ? won / (won + lost) : null)

/** Win odds by size over the mature decided bids in `rows`. */
export function oddsBySize(rows: ReadonlyArray<PursuitRow>, todayYmd: string): Odds {
  const bands = Object.fromEntries(FORECAST_SIZE_BANDS.map((b) => [b.key, { band: b.key, label: b.label, won: 0, lost: 0, byCount: null, byValue: null, bids: [] as PursuitRow[] }])) as Record<SizeBand, BandOdds>
  const usd: Record<SizeBand, { won: number; lost: number }> = { small: { won: 0, lost: 0 }, mid: { won: 0, lost: 0 }, large: { won: 0, lost: 0 } }
  let won = 0, lost = 0, wonUsd = 0, lostUsd = 0
  for (const r of rows) {
    if (r.outcome !== 'won' && r.outcome !== 'lost') continue
    if (!isMature(r, todayYmd)) continue
    const b = bands[sizeBandOf(r.bidValue)]
    b.bids.push(r)
    if (r.outcome === 'won') { b.won++; won++; usd[b.band].won += r.bidValue ?? 0; wonUsd += r.bidValue ?? 0 }
    else { b.lost++; lost++; usd[b.band].lost += r.bidValue ?? 0; lostUsd += r.bidValue ?? 0 }
  }
  for (const b of Object.values(bands)) {
    b.byCount = rateOf(b.won, b.lost)
    const u = usd[b.band]
    b.byValue = u.won + u.lost > 0 ? u.won / (u.won + u.lost) : null
  }
  return { bands, won, lost, byCount: rateOf(won, lost), byValue: wonUsd + lostUsd > 0 ? wonUsd / (wonUsd + lostUsd) : null }
}

export type PersonOdds = { odds: Odds; own: boolean; decided: number; /** per band: true when the person's own band rate was used */ ownBand: Record<SizeBand, boolean> }

/** A person's odds: their own when they have enough decided bids, everyone's otherwise, band by band. */
export function oddsForPerson(personRows: ReadonlyArray<PursuitRow>, everyone: Odds, todayYmd: string): PersonOdds {
  const mine = oddsBySize(personRows, todayYmd)
  const decided = mine.won + mine.lost
  const own = decided >= FORECAST_MIN_DECIDED_FOR_OWN_RATE
  const ownBand: Record<SizeBand, boolean> = { small: false, mid: false, large: false }
  if (!own) return { odds: everyone, own: false, decided, ownBand }
  const bands = { ...mine.bands }
  for (const key of ['small', 'mid', 'large'] as const) {
    const b = mine.bands[key]
    if (b.won + b.lost >= FORECAST_MIN_BAND_DECIDED) ownBand[key] = true
    else bands[key] = everyone.bands[key]
  }
  return { odds: { ...mine, bands }, own: true, decided, ownBand }
}

export type Forecast = {
  /** Fresh open bids (sent within the maturity window). */
  n: number
  usd: number
  expCount: number
  expUsd: number
  /** One standard deviation of the expected value (each bid a coin at its odds). */
  sd: number
  lowUsd: number
  highUsd: number
  largest: { row: PursuitRow; share: number; p: number } | null
  stale: { n: number; usd: number; bids: PursuitRow[] }
  fresh: PursuitRow[]
}

const oddsOf = (odds: Odds, r: PursuitRow): number => odds.bands[sizeBandOf(r.bidValue)].byCount ?? odds.byCount ?? 0

export function forecastOpen(rows: ReadonlyArray<PursuitRow>, odds: Odds, todayYmd: string): Forecast {
  const fresh: PursuitRow[] = [], staleBids: PursuitRow[] = []
  for (const r of rows) {
    if (r.outcome !== 'open') continue
    if (isStaleOpen(r, todayYmd)) staleBids.push(r)
    else fresh.push(r)
  }
  let usd = 0, expCount = 0, expUsd = 0, variance = 0
  let largest: PursuitRow | null = null
  for (const r of fresh) {
    const v = r.bidValue ?? 0
    const p = oddsOf(odds, r)
    usd += v
    expCount += p
    expUsd += p * v
    variance += p * (1 - p) * v * v
    if (!largest || v > (largest.bidValue ?? 0)) largest = r
  }
  const sd = Math.sqrt(variance)
  return {
    n: fresh.length,
    usd,
    expCount,
    expUsd,
    sd,
    lowUsd: Math.max(0, expUsd - sd),
    highUsd: expUsd + sd,
    largest: largest && usd > 0 ? { row: largest, share: (largest.bidValue ?? 0) / usd, p: oddsOf(odds, largest) } : null,
    stale: { n: staleBids.length, usd: staleBids.reduce((s, r) => s + (r.bidValue ?? 0), 0), bids: staleBids },
    fresh,
  }
}

export type ForecastPersonRow = {
  key: string
  label: string
  sent: number
  matureDecided: number
  byCount: number | null
  byValue: number | null
  ownRate: boolean
  open: number
  openUsd: number
  fresh: number
  freshUsd: number
  expCount: number
  expUsd: number
  freshBids: PursuitRow[]
}

/** One row per estimator (sent bids), most sent first, plus the Everyone footer. */
export function forecastByEstimator(rows: ReadonlyArray<PursuitRow>, todayYmd: string): { people: ForecastPersonRow[]; everyone: ForecastPersonRow } {
  const everyoneOdds = oddsBySize(rows, todayYmd)
  const groups = new Map<string, PursuitRow[]>()
  for (const r of rows) {
    const k = r.estimatorName ?? ''
    const g = groups.get(k) ?? []
    g.push(r)
    groups.set(k, g)
  }
  const build = (key: string, label: string, g: ReadonlyArray<PursuitRow>, odds: Odds, ownRate: boolean, mature: Odds): ForecastPersonRow => {
    const f = forecastOpen(g, odds, todayYmd)
    return { key, label, sent: g.length, matureDecided: mature.won + mature.lost, byCount: mature.byCount, byValue: mature.byValue, ownRate, open: g.filter((r) => r.outcome === 'open').length, openUsd: g.filter((r) => r.outcome === 'open').reduce((s, r) => s + (r.bidValue ?? 0), 0), fresh: f.n, freshUsd: f.usd, expCount: f.expCount, expUsd: f.expUsd, freshBids: f.fresh }
  }
  const people = [...groups.entries()].map(([k, g]) => {
    const po = oddsForPerson(g, everyoneOdds, todayYmd)
    return build(k, k || 'No estimator', g, po.odds, po.own, oddsBySize(g, todayYmd))
  }).sort((a, b) => b.sent - a.sent || a.label.localeCompare(b.label))
  return { people, everyone: build('*', 'Everyone', rows, everyoneOdds, true, everyoneOdds) }
}

export type DecisionTimes = {
  n: number
  medianDays: number | null
  p10Days: number | null
  p90Days: number | null
  /** By the month the decision landed. */
  byMonth: Array<{ month: string; label: string; n: number; medianDays: number }>
  sample: Array<{ row: PursuitRow; days: number }>
  enough: boolean
}

const quantile = (sorted: number[], q: number): number | null => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]! : null)

/** Days from sent to decided, for the bids that carry both dates. */
export function decisionTimes(rows: ReadonlyArray<PursuitRow>): DecisionTimes {
  const sample: Array<{ row: PursuitRow; days: number }> = []
  for (const r of rows) {
    if (!r.sentYmd || !r.outcomeAtYmd || (r.outcome !== 'won' && r.outcome !== 'lost')) continue
    const days = daysBetween(r.sentYmd, r.outcomeAtYmd)
    if (days >= 0) sample.push({ row: r, days })
  }
  const sorted = sample.map((s) => s.days).sort((a, b) => a - b)
  const perMonth = new Map<string, number[]>()
  for (const s of sample) {
    const m = s.row.outcomeAtYmd!.slice(0, 7)
    perMonth.set(m, [...(perMonth.get(m) ?? []), s.days])
  }
  const byMonth = [...perMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, ds]) => ({ month, label: monthLabel(month), n: ds.length, medianDays: quantile([...ds].sort((a, b) => a - b), 0.5)! }))
  return { n: sample.length, medianDays: quantile(sorted, 0.5), p10Days: quantile(sorted, 0.1), p90Days: quantile(sorted, 0.9), byMonth, sample, enough: sample.length >= DECISION_TIMES_MIN_SAMPLE }
}

export type AgeBucket = { key: string; label: string; n: number; usd: number; stale: boolean; bids: PursuitRow[] }

/** Open bids by how long they have waited. */
export function openAgeBuckets(rows: ReadonlyArray<PursuitRow>, todayYmd: string): AgeBucket[] {
  const defs: Array<{ key: string; label: string; max: number | null; stale: boolean }> = [
    { key: '0-30', label: '0–30 days', max: 30, stale: false },
    { key: '31-90', label: '31–90 days', max: 90, stale: false },
    { key: '91-180', label: '91–180 days', max: 180, stale: true },
    { key: '181+', label: 'over 180 days', max: null, stale: true },
  ]
  const out = defs.map((d) => ({ key: d.key, label: d.label, n: 0, usd: 0, stale: d.stale, bids: [] as PursuitRow[] }))
  for (const r of rows) {
    if (r.outcome !== 'open') continue
    const a = ageDays(r, todayYmd) ?? 0
    const i = defs.findIndex((d) => d.max == null || a <= d.max)
    const b = out[i < 0 ? out.length - 1 : i]!
    b.n++
    b.usd += r.bidValue ?? 0
    b.bids.push(r)
  }
  return out
}

/** The odds words on a person row: "own rate" or "everyone's (7 decided)". */
export function oddsWords(p: Pick<ForecastPersonRow, 'ownRate' | 'matureDecided'>): string {
  return p.ownRate ? 'own odds' : `everyone's odds · ${p.matureDecided} decided`
}

export const OUTCOME_OF_BUCKET: Record<CohortBucket, PursuitOutcome> = { won: 'won', lost: 'lost', open: 'open', openStale: 'open' }
