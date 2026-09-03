import type { JobDayLedger } from './jobDayLedger'

/**
 * The Days view kernel (v2.2695): how many jobs the crew carried each day,
 * read straight off the job day ledger. A "workday" is a day with approved
 * field hours; overhead per job-day is the window's pool over workdays divided
 * by the number of (day, job) pairs — the unit cost that explains why a two-
 * job day is cheaper than a five-job day. Pure.
 */

export type JobDaysJobSlice = {
  jobId: string
  hours: number
  people: string[]
}

export type JobDaysRow = {
  ymd: string
  /** Distinct jobs with approved field hours that day. */
  jobs: number
  /** Distinct people across those jobs. */
  people: number
  fieldHours: number
  poolUsd: number
  /** pool ÷ jobs that day; null on days with no field work. */
  perJobDayUsd: number | null
  /** Jobs that day, most hours first. */
  slices: JobDaysJobSlice[]
}

export type JobDaysSummary = {
  calendarDays: number
  workdays: number
  jobDays: number
  avgJobsPerWorkday: number | null
  medianJobsPerWorkday: number | null
  maxJobsPerWorkday: number
  /** Pool on workdays ÷ job-days. */
  overheadPerJobDayUsd: number | null
  /** Pool on days with no field work (unallocated). */
  unallocatedUsd: number
  /** Index k = number of workdays that carried exactly k jobs (index 0 unused). */
  histogram: number[]
  totalFieldHours: number
  totalPeopleDays: number
}

export function buildJobDaysRows(ledger: JobDayLedger): JobDaysRow[] {
  return ledger.days.map((d) => {
    const slices: JobDaysJobSlice[] = [...d.byJob.entries()]
      .map(([jobId, jd]) => ({ jobId, hours: jd.hours, people: [...jd.people] }))
      .filter((s) => s.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.jobId.localeCompare(b.jobId))
    const people = new Set<string>()
    for (const s of slices) for (const p of s.people) people.add(p)
    const jobs = slices.length
    return {
      ymd: d.ymd,
      jobs,
      people: people.size,
      fieldHours: d.fieldHours,
      poolUsd: d.poolUsd,
      perJobDayUsd: jobs > 0 ? d.poolUsd / jobs : null,
      slices,
    }
  })
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export function summarizeJobDays(rows: readonly JobDaysRow[]): JobDaysSummary {
  const workRows = rows.filter((r) => r.jobs > 0)
  const jobDays = workRows.reduce((s, r) => s + r.jobs, 0)
  const poolOnWorkdays = workRows.reduce((s, r) => s + r.poolUsd, 0)
  const unallocatedUsd = rows.filter((r) => r.jobs === 0).reduce((s, r) => s + r.poolUsd, 0)
  const maxJobs = workRows.reduce((m, r) => Math.max(m, r.jobs), 0)
  const histogram = new Array<number>(maxJobs + 1).fill(0)
  for (const r of workRows) histogram[r.jobs] = (histogram[r.jobs] ?? 0) + 1
  return {
    calendarDays: rows.length,
    workdays: workRows.length,
    jobDays,
    avgJobsPerWorkday: workRows.length > 0 ? jobDays / workRows.length : null,
    medianJobsPerWorkday: median(workRows.map((r) => r.jobs)),
    maxJobsPerWorkday: maxJobs,
    overheadPerJobDayUsd: jobDays > 0 ? poolOnWorkdays / jobDays : null,
    unallocatedUsd,
    histogram,
    totalFieldHours: rows.reduce((s, r) => s + r.fieldHours, 0),
    totalPeopleDays: workRows.reduce((s, r) => s + r.people, 0),
  }
}

export type JobDaysChartSeries = {
  /** Job ids that get their own color, most hours in the window first. */
  keyJobIds: string[]
  /** Per day, stacked segments in `keyJobIds` order plus a trailing "other" bucket. */
  days: Array<{ ymd: string; segments: Array<{ jobId: string | null; hours: number }>; jobs: number }>
  maxHours: number
}

/** Top `keyCount` jobs by hours keep a color; everything else stacks as "other". */
export function buildJobDaysChartSeries(rows: readonly JobDaysRow[], keyCount = 6): JobDaysChartSeries {
  const hoursByJob = new Map<string, number>()
  for (const r of rows) for (const s of r.slices) hoursByJob.set(s.jobId, (hoursByJob.get(s.jobId) ?? 0) + s.hours)
  const keyJobIds = [...hoursByJob.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, keyCount)
    .map(([id]) => id)
  const keySet = new Set(keyJobIds)
  let maxHours = 0
  const days = rows.map((r) => {
    const byKey = new Map<string, number>()
    let other = 0
    for (const s of r.slices) {
      if (keySet.has(s.jobId)) byKey.set(s.jobId, (byKey.get(s.jobId) ?? 0) + s.hours)
      else other += s.hours
    }
    const segments: Array<{ jobId: string | null; hours: number }> = []
    for (const id of keyJobIds) {
      const h = byKey.get(id) ?? 0
      if (h > 0) segments.push({ jobId: id, hours: h })
    }
    if (other > 0) segments.push({ jobId: null, hours: other })
    maxHours = Math.max(maxHours, r.fieldHours)
    return { ymd: r.ymd, segments, jobs: r.jobs }
  })
  return { keyJobIds, days, maxHours }
}

/** Newest first, workdays only unless `includeQuiet`. */
export function orderJobDaysRows(rows: readonly JobDaysRow[], opts: { includeQuiet: boolean }): JobDaysRow[] {
  return rows.filter((r) => opts.includeQuiet || r.jobs > 0 || r.poolUsd > 0).slice().reverse()
}
