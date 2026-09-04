import type { JobDayLedger, JobDayLedgerJobLabel } from './jobDayLedger'

/**
 * The Timeline view kernel (v2.2711): how many jobs are RUNNING at once, over
 * time. Every job in the window becomes one or more spans; the count of spans
 * crossing a day is the running count, split into bands.
 *
 * Two definitions of "running":
 *  - worked (default): from the job's first approved field day to its last,
 *    with a GAP RULE — a stretch of more than `gapDays` idle days splits the
 *    run, so a paused job isn't counted while nobody is on it. A job that is
 *    still open (not billed/paid) and was touched within the gap extends to
 *    today.
 *  - status: from the job's Working status move to its Billed (or Paid) move,
 *    from `job_status_events` — the office's "open on the board" view.
 *
 * Three colorings (v2.2745), all over the same counts:
 *  - status: by where the job stands TODAY (working / billed / paid).
 *  - stateOnDay: by where the job stood ON THAT DAY — blue until its Billed
 *    move, orange until its Paid move, green after.
 *  - runLength: by how long the job ran — 1 day, 2–5 days, 6+ days — so the
 *    carry and the churn read as different colors without leaving the chart.
 *
 * Pure. Day arithmetic works on YYYY-MM-DD strings via UTC epoch days.
 */

export type JobRunDefinition = 'worked' | 'status'
export type JobRunBucket = 'working' | 'billed' | 'paid'
export type JobRunSegment = { startYmd: string; endYmd: string }

export type JobRunRow = {
  jobId: string
  label: JobDayLedgerJobLabel
  /** Where the job stands today. */
  bucket: JobRunBucket
  segments: JobRunSegment[]
  startYmd: string
  endYmd: string
  /** Calendar days covered by the segments. */
  runDays: number
  /** Still open today (bucket working and the last segment reaches today). */
  open: boolean
  /** First Billed / Paid status moves, when the status history has them. */
  billedYmd: string | null
  paidYmd: string | null
}

export const JOB_RUN_DEFINITIONS: ReadonlyArray<{ key: JobRunDefinition; label: string; title: string }> = [
  { key: 'worked', label: 'first → last work', title: 'A job runs from its first approved field day to its last (to today while still open); long idle stretches split the run' },
  { key: 'status', label: 'Working → Billed', title: 'A job runs from its Working status move to its Billed or Paid move — open on the board, touched or not' },
]

export const JOB_RUN_GAP_OPTIONS: ReadonlyArray<{ key: number; label: string; title: string }> = [
  { key: 0, label: 'none', title: 'Only days with approved hours count as running' },
  { key: 7, label: '7d', title: 'Up to 7 idle days inside a job still count as running; a longer pause splits the run' },
  { key: 14, label: '14d', title: 'Up to 14 idle days inside a job still count as running' },
]

export type JobRunColorBy = 'status' | 'stateOnDay' | 'runLength'
export type JobRunBand = JobRunBucket | 'd1' | 'd2_5' | 'd6p'

export const JOB_RUN_COLOR_BY_OPTIONS: ReadonlyArray<{ key: JobRunColorBy; label: string; title: string }> = [
  { key: 'status', label: 'status today', title: 'Color every day of a job by where it stands today — working, billed, or paid' },
  { key: 'stateOnDay', label: 'state on the day', title: 'Color each day by where the job stood then — working until its bill went out, billed until it was paid' },
  { key: 'runLength', label: 'run length', title: 'Color by how long the job ran — 1 day, 2 to 5 days, 6 or more — so the carry and the churn read apart' },
]

/** Stack order per coloring, bottom → top: the calm carry sets the floor, the churn rides on top. */
export const JOB_RUN_BANDS_BY_COLOR: Record<JobRunColorBy, readonly JobRunBand[]> = {
  status: ['working', 'billed', 'paid'],
  stateOnDay: ['working', 'billed', 'paid'],
  runLength: ['d6p', 'd2_5', 'd1'],
}

export const JOB_RUN_BAND_LABEL: Record<JobRunBand, string> = {
  working: 'working',
  billed: 'billed, awaiting payment',
  paid: 'paid',
  d6p: 'ran 6+ days',
  d2_5: 'ran 2–5 days',
  d1: 'ran 1 day',
}

export function ymdToDayNumber(ymd: string): number {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function dayNumberToYmd(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10)
}

/** paid → paid; billed → billed (collections included); everything else is still working. */
export function jobRunBucket(status: string | null | undefined): JobRunBucket {
  if (status === 'paid') return 'paid'
  if (status === 'billed') return 'billed'
  return 'working'
}

export function runLengthBand(runDays: number): JobRunBand {
  if (runDays <= 1) return 'd1'
  if (runDays <= 5) return 'd2_5'
  return 'd6p'
}

/** Where the job stood on `ymd`: working until its Billed move, billed until its Paid move, paid after. */
export function stateOnDay(row: Pick<JobRunRow, 'billedYmd' | 'paidYmd' | 'bucket'>, ymd: string): JobRunBucket {
  if (row.paidYmd != null && ymd >= row.paidYmd) return 'paid'
  if (row.billedYmd != null && ymd >= row.billedYmd) return 'billed'
  // No status history: fall back to today's bucket only when it can't be wrong (still working).
  if (row.billedYmd == null && row.paidYmd == null && row.bucket === 'working') return 'working'
  return 'working'
}

export function bandOnDay(row: JobRunRow, ymd: string, colorBy: JobRunColorBy): JobRunBand {
  if (colorBy === 'runLength') return runLengthBand(row.runDays)
  if (colorBy === 'stateOnDay') return stateOnDay(row, ymd)
  return row.bucket
}

function segmentsFromDays(days: readonly string[], gapDays: number): JobRunSegment[] {
  const sorted = [...new Set(days)].sort()
  const out: JobRunSegment[] = []
  let start: string | null = null
  let prev: string | null = null
  for (const d of sorted) {
    if (start == null || prev == null) {
      start = d
    } else if (ymdToDayNumber(d) - ymdToDayNumber(prev) > gapDays + 1) {
      out.push({ startYmd: start, endYmd: prev })
      start = d
    }
    prev = d
  }
  if (start != null && prev != null) out.push({ startYmd: start, endYmd: prev })
  return out
}

function segmentDays(segments: readonly JobRunSegment[]): number {
  return segments.reduce((s, seg) => s + (ymdToDayNumber(seg.endYmd) - ymdToDayNumber(seg.startYmd) + 1), 0)
}

function finishRow(
  jobId: string,
  ledger: JobDayLedger,
  bucket: JobRunBucket,
  segments: JobRunSegment[],
  todayYmd: string,
): JobRunRow | null {
  if (segments.length === 0) return null
  const startYmd = segments[0]!.startYmd
  const endYmd = segments[segments.length - 1]!.endYmd
  const span = ledger.statusSpansByJob?.get(jobId)
  return {
    jobId,
    label: ledger.jobLabels?.get(jobId) ?? { number: jobId.slice(0, 8), name: '' },
    bucket,
    segments,
    startYmd,
    endYmd,
    runDays: segmentDays(segments),
    open: bucket === 'working' && endYmd >= todayYmd,
    billedYmd: span?.billedYmd ?? null,
    paidYmd: span?.paidYmd ?? null,
  }
}

/** Worked spans: approved field days per job, merged with the gap rule; open jobs touched within the gap run to today. */
export function buildWorkedSpans(args: {
  ledger: JobDayLedger
  statusByJob: ReadonlyMap<string, string | null | undefined>
  todayYmd: string
  gapDays: number
}): JobRunRow[] {
  const { ledger, statusByJob, todayYmd, gapDays } = args
  const daysByJob = new Map<string, string[]>()
  for (const d of ledger.days) for (const [jobId, jd] of d.byJob) if (jd.hours > 0) (daysByJob.get(jobId) ?? daysByJob.set(jobId, []).get(jobId)!).push(d.ymd)
  const rows: JobRunRow[] = []
  for (const [jobId, days] of daysByJob) {
    const bucket = jobRunBucket(statusByJob.get(jobId))
    const segments = segmentsFromDays(days, gapDays)
    const last = segments[segments.length - 1]
    if (last && bucket === 'working' && ymdToDayNumber(todayYmd) - ymdToDayNumber(last.endYmd) <= gapDays + 1 && last.endYmd < todayYmd) {
      last.endYmd = todayYmd
    }
    const row = finishRow(jobId, ledger, bucket, segments, todayYmd)
    if (row) rows.push(row)
  }
  return rows.sort((a, b) => a.startYmd.localeCompare(b.startYmd) || a.label.number.localeCompare(b.label.number, undefined, { numeric: true }))
}

export type JobStatusSpan = { startYmd: string; endYmd: string | null }

/** Status spans (Working → Billed/Paid), clipped to the window; open spans run to today. */
export function buildStatusSpans(args: {
  ledger: JobDayLedger
  statusSpansByJob: ReadonlyMap<string, JobStatusSpan>
  statusByJob: ReadonlyMap<string, string | null | undefined>
  todayYmd: string
}): JobRunRow[] {
  const { ledger, statusSpansByJob, statusByJob, todayYmd } = args
  const rows: JobRunRow[] = []
  for (const [jobId, span] of statusSpansByJob) {
    const start = span.startYmd < ledger.startYmd ? ledger.startYmd : span.startYmd
    const rawEnd = span.endYmd ?? todayYmd
    const end = rawEnd > ledger.endYmd ? ledger.endYmd : rawEnd
    if (end < start) continue
    const row = finishRow(jobId, ledger, jobRunBucket(statusByJob.get(jobId)), [{ startYmd: start, endYmd: end }], todayYmd)
    if (row) rows.push(row)
  }
  return rows.sort((a, b) => a.startYmd.localeCompare(b.startYmd) || a.label.number.localeCompare(b.label.number, undefined, { numeric: true }))
}

export type JobRunningBandDay = { ymd: string; counts: Record<JobRunBand, number>; total: number; jobIds: string[] }

export type JobRunningBandSeries = {
  colorBy: JobRunColorBy
  bands: readonly JobRunBand[]
  days: JobRunningBandDay[]
  avg7: number[]
  peak: { ymd: string; total: number } | null
  todayTotal: number
  /** Mean running count over every calendar day in the window. */
  averageTotal: number
}

const emptyCounts = (): Record<JobRunBand, number> => ({ working: 0, billed: 0, paid: 0, d1: 0, d2_5: 0, d6p: 0 })

/** Running count per day split into the bands of the chosen coloring. */
export function buildRunningSeriesBy(rows: readonly JobRunRow[], dayYmds: readonly string[], todayYmd: string, colorBy: JobRunColorBy): JobRunningBandSeries {
  const days: JobRunningBandDay[] = dayYmds.map((ymd) => ({ ymd, counts: emptyCounts(), total: 0, jobIds: [] }))
  const first = dayYmds[0] ? ymdToDayNumber(dayYmds[0]) : 0
  for (const r of rows) {
    for (const seg of r.segments) {
      const a = Math.max(0, ymdToDayNumber(seg.startYmd) - first)
      const b = Math.min(days.length - 1, ymdToDayNumber(seg.endYmd) - first)
      for (let i = a; i <= b; i++) {
        const d = days[i]!
        d.counts[bandOnDay(r, d.ymd, colorBy)] += 1
        d.total += 1
        d.jobIds.push(r.jobId)
      }
    }
  }
  const avg7 = days.map((_, i) => {
    let s = 0
    let n = 0
    for (let k = Math.max(0, i - 6); k <= i; k++) {
      s += days[k]!.total
      n += 1
    }
    return n > 0 ? s / n : 0
  })
  let peak: JobRunningBandSeries['peak'] = null
  for (const d of days) if (!peak || d.total > peak.total) peak = { ymd: d.ymd, total: d.total }
  if (peak && peak.total === 0) peak = null
  const todayIdx = dayYmds.indexOf(todayYmd)
  const todayTotal = todayIdx < 0 ? (days[days.length - 1]?.total ?? 0) : days[todayIdx]!.total
  const averageTotal = days.length > 0 ? days.reduce((s, d) => s + d.total, 0) / days.length : 0
  return { colorBy, bands: JOB_RUN_BANDS_BY_COLOR[colorBy], days, avg7, peak, todayTotal, averageTotal }
}

export type JobRunningDay = { ymd: string; working: number; billed: number; paid: number; total: number; jobIds: string[] }

export type JobRunningSeries = {
  days: JobRunningDay[]
  avg7: number[]
  peak: { ymd: string; total: number } | null
  todayTotal: number
  averageTotal: number
}

/** The status-today series in its original shape (kept for callers and tests that predate colorings). */
export function buildRunningSeries(rows: readonly JobRunRow[], dayYmds: readonly string[], todayYmd: string): JobRunningSeries {
  const s = buildRunningSeriesBy(rows, dayYmds, todayYmd, 'status')
  return {
    days: s.days.map((d) => ({ ymd: d.ymd, working: d.counts.working, billed: d.counts.billed, paid: d.counts.paid, total: d.total, jobIds: d.jobIds })),
    avg7: s.avg7,
    peak: s.peak,
    todayTotal: s.todayTotal,
    averageTotal: s.averageTotal,
  }
}

export type JobRunColoredSegment = JobRunSegment & { band: JobRunBand }

/** A row's bar pieces for the chosen coloring — state-on-the-day splits each segment at the Billed and Paid moves. */
export function colorSegmentsForRow(row: JobRunRow, colorBy: JobRunColorBy): JobRunColoredSegment[] {
  if (colorBy !== 'stateOnDay') {
    const band: JobRunBand = colorBy === 'runLength' ? runLengthBand(row.runDays) : row.bucket
    return row.segments.map((s) => ({ ...s, band }))
  }
  const out: JobRunColoredSegment[] = []
  for (const seg of row.segments) {
    const cuts = [row.billedYmd, row.paidYmd].filter((c): c is string => c != null && c > seg.startYmd && c <= seg.endYmd).sort()
    let cur = seg.startYmd
    for (const cut of [...new Set(cuts)]) {
      const prevDay = dayNumberToYmd(ymdToDayNumber(cut) - 1)
      if (prevDay >= cur) out.push({ startYmd: cur, endYmd: prevDay, band: stateOnDay(row, cur) })
      cur = cut
    }
    out.push({ startYmd: cur, endYmd: seg.endYmd, band: stateOnDay(row, cur) })
  }
  return out
}

export type JobRunSummary = { jobs: number; open: number; finished: number; medianRunDays: number | null }

export function summarizeJobRuns(rows: readonly JobRunRow[]): JobRunSummary {
  const open = rows.filter((r) => r.open).length
  const lengths = rows.map((r) => r.runDays).sort((a, b) => a - b)
  const mid = Math.floor(lengths.length / 2)
  const medianRunDays = lengths.length === 0 ? null : lengths.length % 2 === 1 ? lengths[mid]! : (lengths[mid - 1]! + lengths[mid]!) / 2
  return { jobs: rows.length, open, finished: rows.length - open, medianRunDays }
}

/** Month boundaries inside a day list, for axis ticks: index → short month label. */
export function monthTicks(dayYmds: readonly string[]): Array<{ index: number; label: string }> {
  const out: Array<{ index: number; label: string }> = []
  dayYmds.forEach((ymd, i) => {
    if (i === 0 || ymd.endsWith('-01')) {
      const m = Number(ymd.slice(5, 7))
      out.push({ index: i, label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] ?? ymd.slice(5, 7) })
    }
  })
  // Drop a window-start tick that sits within a few days of a real month tick.
  if (out.length >= 2 && out[1]!.index - out[0]!.index < 4) out.shift()
  return out
}
