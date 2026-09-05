import { jobSummaryCutKey, type JobSummaryCutBy, type JobSummaryCutContext, type JobSummaryEnrichedRow } from './jobSummaryLedgerView'
import { jobNumberLabel, median } from './jobSummaryCycle'

/**
 * The Scatter view kernel (v2.2826): every job with a known true margin as one
 * point — size on the x-axis (revenue as shown on the table), true margin on
 * the y-axis, bubble by field hours or days, color by service type / GC /
 * lead tech. Median lines cut it into quadrants; "big and thin" is the
 * bottom-right one. Pure.
 */
export type JobSummaryScatterColorBy = Extract<JobSummaryCutBy, 'trade' | 'gc' | 'tech'>
export type JobSummaryScatterSizeBy = 'hours' | 'days' | 'none'

export const JOB_SUMMARY_SCATTER_COLOR_OPTIONS: ReadonlyArray<{ key: JobSummaryScatterColorBy; label: string; title: string }> = [
  { key: 'trade', label: 'service type', title: 'One color per service type' },
  { key: 'gc', label: 'GC', title: 'One color per General Contractor (the six biggest; the rest read as Other)' },
  { key: 'tech', label: 'lead tech', title: 'One color per master technician' },
]
export const JOB_SUMMARY_SCATTER_SIZE_OPTIONS: ReadonlyArray<{ key: JobSummaryScatterSizeBy; label: string; title: string }> = [
  { key: 'hours', label: 'field hours', title: 'Bubble area by approved field hours in the window' },
  { key: 'days', label: 'days', title: 'Bubble area by days worked in the window' },
  { key: 'none', label: 'none', title: 'Same-size dots' },
]

/** Fixed hue order — assigned by rank, never cycled; a 7th key folds into Other. */
export const SCATTER_SERIES_COLORS = ['#2563eb', '#d97706', '#0891b2', '#7c3aed', '#15803d', '#be185d'] as const
export const SCATTER_OTHER_COLOR = '#6b7280'
export const SCATTER_MAX_SERIES = SCATTER_SERIES_COLORS.length

export type JobSummaryScatterPoint = {
  jobId: string
  number: string
  name: string
  revenueUsd: number
  trueMarginPct: number
  trueProfitUsd: number
  hours: number
  days: number
  seriesKey: string
  seriesLabel: string
}

export type JobSummaryScatterSeries = { key: string; label: string; color: string; count: number }

export type JobSummaryScatter = {
  points: JobSummaryScatterPoint[]
  series: JobSummaryScatterSeries[]
  medianRevenueUsd: number | null
  medianMarginPct: number | null
  /** Above median size, below median margin — sorted by how far under the median-margin line, in dollars. */
  bigThin: Array<JobSummaryScatterPoint & { shortfallUsd: number }>
  /** Rows left off: no true margin yet (ledger loading) or no revenue. */
  skipped: number
}

export function buildJobSummaryScatter(rows: readonly JobSummaryEnrichedRow[], colorBy: JobSummaryScatterColorBy, ctx: JobSummaryCutContext = {}): JobSummaryScatter {
  const raw: Array<Omit<JobSummaryScatterPoint, 'seriesLabel'> & { seriesLabel: string }> = []
  let skipped = 0
  for (const r of rows) {
    if (r.trueMarginPct == null || r.trueProfitUsd == null || !(r.revenueUsd > 0)) {
      skipped += 1
      continue
    }
    const { key, label } = jobSummaryCutKey(r.row.job, colorBy, ctx)
    raw.push({
      jobId: r.row.job.id,
      number: jobNumberLabel(r.row.job),
      name: (r.row.job.job_name ?? '').trim(),
      revenueUsd: r.revenueUsd,
      trueMarginPct: r.trueMarginPct,
      trueProfitUsd: r.trueProfitUsd,
      hours: r.hoursInWindow,
      days: r.daysInWindow,
      seriesKey: key,
      seriesLabel: label,
    })
  }
  // Series by count, fixed hue order by rank; beyond the palette → Other.
  const counts = new Map<string, { label: string; count: number }>()
  for (const p of raw) {
    const c = counts.get(p.seriesKey) ?? counts.set(p.seriesKey, { label: p.seriesLabel, count: 0 }).get(p.seriesKey)!
    c.count += 1
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label))
  const series: JobSummaryScatterSeries[] = ranked.slice(0, SCATTER_MAX_SERIES).map(([key, c], i) => ({ key, label: c.label, color: SCATTER_SERIES_COLORS[i]!, count: c.count }))
  const otherCount = ranked.slice(SCATTER_MAX_SERIES).reduce((a, [, c]) => a + c.count, 0)
  if (otherCount > 0) series.push({ key: '__other', label: 'Other', color: SCATTER_OTHER_COLOR, count: otherCount })
  const keep = new Set(series.map((s) => s.key))
  const points: JobSummaryScatterPoint[] = raw.map((p) => (keep.has(p.seriesKey) ? p : { ...p, seriesKey: '__other', seriesLabel: 'Other' }))
  const medianRevenueUsd = median(points.map((p) => p.revenueUsd))
  const medianMarginPct = median(points.map((p) => p.trueMarginPct))
  const bigThin =
    medianRevenueUsd == null || medianMarginPct == null
      ? []
      : points
          .filter((p) => p.revenueUsd > medianRevenueUsd && p.trueMarginPct < medianMarginPct)
          .map((p) => ({ ...p, shortfallUsd: (p.revenueUsd * (medianMarginPct - p.trueMarginPct)) / 100 }))
          .sort((a, b) => b.shortfallUsd - a.shortfallUsd)
  return { points, series, medianRevenueUsd, medianMarginPct, bigThin, skipped }
}
