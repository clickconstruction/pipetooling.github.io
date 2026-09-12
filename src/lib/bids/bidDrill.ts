/**
 * Bar drill — what a slice of the History & forecast chart is made of
 * (v2.3357). Pure helpers behind `BidListModal`: the month walk (previous /
 * next month keeping the slice, the month's slices with counts and value,
 * the slice's share of what the month decided), the rollups that say who and
 * which GC a slice is made of, and the clipboard text.
 */
import type { CohortBucket, CohortMonth } from './bidForecast'
import { COHORT_BUCKET_LABELS } from './bidForecast'
import type { PursuitRow } from './bidPursuit'

export type DrillRollup = { key: string; label: string; n: number; usd: number }

/** Group rows by a key, most first. */
export function rollupBy(rows: ReadonlyArray<PursuitRow>, keyOf: (r: PursuitRow) => string, labelOf: (k: string) => string): DrillRollup[] {
  const m = new Map<string, DrillRollup>()
  for (const r of rows) {
    const key = keyOf(r)
    const cur = m.get(key) ?? { key, label: labelOf(key), n: 0, usd: 0 }
    cur.n++
    cur.usd += r.bidValue ?? 0
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => b.n - a.n || b.usd - a.usd || a.label.localeCompare(b.label))
}

export const rollupByEstimator = (rows: ReadonlyArray<PursuitRow>): DrillRollup[] => rollupBy(rows, (r) => r.estimatorName ?? '', (k) => k || 'No estimator')
export const rollupByGc = (rows: ReadonlyArray<PursuitRow>): DrillRollup[] => rollupBy(rows, (r) => r.gcName ?? '', (k) => k || 'No GC')

export type DrillSlice = { bucket: CohortBucket; label: string; n: number; usd: number }
export const DRILL_BUCKETS: ReadonlyArray<CohortBucket> = ['won', 'lost', 'open', 'openStale']

export type CohortDrill = {
  monthIndex: number
  month: string
  label: string
  bucket: CohortBucket
  rows: PursuitRow[]
  slices: DrillSlice[]
  monthCount: number
  monthUsd: number
  /** This slice's value over the month's decided value; null for open slices or a month with nothing decided. */
  shareOfDecided: number | null
  prevIndex: number | null
  nextIndex: number | null
  byEstimator: DrillRollup[]
  byGc: DrillRollup[]
}

export function cohortDrill(cohorts: ReadonlyArray<CohortMonth>, monthIndex: number, bucket: CohortBucket): CohortDrill | null {
  const c = cohorts[monthIndex]
  if (!c) return null
  const rows = c.bids[bucket]
  const slices: DrillSlice[] = DRILL_BUCKETS.map((b) => ({ bucket: b, label: COHORT_BUCKET_LABELS[b], n: c[b], usd: c[`${b}Usd`] }))
  const decidedUsd = c.wonUsd + c.lostUsd
  const sliceUsd = c[`${bucket}Usd`]
  return {
    monthIndex,
    month: c.month,
    label: c.label,
    bucket,
    rows,
    slices,
    monthCount: c.won + c.lost + c.open + c.openStale,
    monthUsd: c.wonUsd + c.lostUsd + c.openUsd + c.openStaleUsd,
    shareOfDecided: (bucket === 'won' || bucket === 'lost') && decidedUsd > 0 ? sliceUsd / decidedUsd : null,
    prevIndex: monthIndex > 0 ? monthIndex - 1 : null,
    nextIndex: monthIndex < cohorts.length - 1 ? monthIndex + 1 : null,
    byEstimator: rollupByEstimator(rows),
    byGc: rollupByGc(rows),
  }
}

/** "won · 2 · $146k" — the slice chip. */
export function sliceWords(s: DrillSlice, fmtUsd: (n: number) => string): string {
  return s.n === 0 ? `${s.label} · 0` : `${s.label} · ${s.n} · ${fmtUsd(s.usd)}`
}

/** The list as text for a message: one bid per line, largest first. */
export function bidListText(title: string, rows: ReadonlyArray<PursuitRow>, fmtUsd: (n: number) => string): string {
  const lines = [...rows]
    .sort((a, b) => (b.bidValue ?? 0) - (a.bidValue ?? 0))
    .map((r) => [r.label, r.gcName, r.estimatorName, r.sentYmd ? `sent ${r.sentYmd}` : null, r.bidValue != null ? fmtUsd(r.bidValue) : null].filter(Boolean).join(' · '))
  return [`${title} — ${rows.length} bid${rows.length === 1 ? '' : 's'}`, ...lines].join('\n')
}

/** Filter a drill's rows to one estimator or GC chip; '' matches the "No estimator" / "No GC" bucket. */
export function filterDrillRows(rows: ReadonlyArray<PursuitRow>, by: { estimator?: string | null; gc?: string | null }): PursuitRow[] {
  return rows.filter((r) => (by.estimator == null || (r.estimatorName ?? '') === by.estimator) && (by.gc == null || (r.gcName ?? '') === by.gc))
}
