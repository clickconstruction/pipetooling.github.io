import type { JobDayLedger, JobDayLedgerJobLabel } from './jobDayLedger'

/**
 * The Timeline view kernel (v2.2711): how many jobs are RUNNING at once, over
 * time. Every job in the window becomes one or more spans; the count of spans
 * crossing a day is the running count, split by how the job stands today
 * (working / billed awaiting payment / paid).
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
 * Pure. Day arithmetic works on YYYY-MM-DD strings via UTC epoch days.
 */

export type JobRunDefinition = 'worked' | 'status'
export type JobRunBucket = 'working' | 'billed' | 'paid'
export type JobRunSegment = { startYmd: string; endYmd: string }

export type JobRunRow = {
  jobId: string
  label: JobDayLedgerJobLabel
  bucket: JobRunBucket
  segments: JobRunSegment[]
  startYmd: string
  endYmd: string
  /** Calendar days covered by the segments. */
  runDays: number
  /** Still open today (bucket working and the last segment reaches today). */
  open: boolean
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

function finishRow(jobId: string, label: JobDayLedgerJobLabel, bucket: JobRunBucket, segments: JobRunSegment[], todayYmd: string): JobRunRow | null {
  if (segments.length === 0) return null
  const startYmd = segments[0]!.startYmd
  const endYmd = segments[segments.length - 1]!.endYmd
  return { jobId, label, bucket, segments, startYmd, endYmd, runDays: segmentDays(segments), open: bucket === 'working' && endYmd >= todayYmd }
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
    const row = finishRow(jobId, ledger.jobLabels?.get(jobId) ?? { number: jobId.slice(0, 8), name: '' }, bucket, segments, todayYmd)
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
    const row = finishRow(jobId, ledger.jobLabels?.get(jobId) ?? { number: jobId.slice(0, 8), name: '' }, jobRunBucket(statusByJob.get(jobId)), [{ startYmd: start, endYmd: end }], todayYmd)
    if (row) rows.push(row)
  }
  return rows.sort((a, b) => a.startYmd.localeCompare(b.startYmd) || a.label.number.localeCompare(b.label.number, undefined, { numeric: true }))
}

export type JobRunningDay = { ymd: string; working: number; billed: number; paid: number; total: number; jobIds: string[] }

export type JobRunningSeries = {
  days: JobRunningDay[]
  avg7: number[]
  peak: { ymd: string; total: number } | null
  todayTotal: number
  /** Mean running count over every calendar day in the window. */
  averageTotal: number
}

export function buildRunningSeries(rows: readonly JobRunRow[], dayYmds: readonly string[], todayYmd: string): JobRunningSeries {
  const days: JobRunningDay[] = dayYmds.map((ymd) => ({ ymd, working: 0, billed: 0, paid: 0, total: 0, jobIds: [] }))
  const index = new Map(days.map((d, i) => [d.ymd, i]))
  const first = dayYmds[0] ? ymdToDayNumber(dayYmds[0]) : 0
  for (const r of rows) {
    for (const seg of r.segments) {
      const a = Math.max(0, ymdToDayNumber(seg.startYmd) - first)
      const b = Math.min(days.length - 1, ymdToDayNumber(seg.endYmd) - first)
      for (let i = a; i <= b; i++) {
        const d = days[i]!
        d[r.bucket] += 1
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
  let peak: JobRunningSeries['peak'] = null
  for (const d of days) if (!peak || d.total > peak.total) peak = { ymd: d.ymd, total: d.total }
  if (peak && peak.total === 0) peak = null
  const todayIdx = index.get(todayYmd)
  const todayTotal = todayIdx == null ? (days[days.length - 1]?.total ?? 0) : days[todayIdx]!.total
  const averageTotal = days.length > 0 ? days.reduce((s, d) => s + d.total, 0) / days.length : 0
  return { days, avg7, peak, todayTotal, averageTotal }
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
