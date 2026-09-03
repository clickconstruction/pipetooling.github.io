import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { computeOverheadRateMethods, type OverheadRateMethods } from '../overheadRateMethods'

/**
 * The job day ledger (v2.2692): one calendar-day table that feeds Job Summary's
 * true profit AND the Days view. Per day: the overhead pool $ (office labor +
 * bid labor + office parts, internal transfers excluded — the SAME pool People →
 * Overhead builds) and every approved, closed field session grouped by job.
 *
 * Day-share overhead (the owner-picked default, 2026-09-03): each day's pool is
 * handed to the jobs worked that day, split by that day's field hours. It
 * reconciles to the pool exactly on days with field work; days with pool $ but
 * no field hours (weekends, rain days, office-only days) stay UNALLOCATED and
 * visible — spreading them would hide slow weeks inside job margins.
 *
 * Pure: the loader (`loadJobDayLedger.ts`) fetches; everything here is math.
 */

export type JobDayLedgerJobDay = {
  hours: number
  laborUsd: number
  /** Distinct person display names on the job that day. */
  people: string[]
}

export type JobDayLedgerDay = {
  ymd: string
  /** Office labor + bid labor + office parts, internal transfers excluded. */
  poolUsd: number
  /** Approved, closed, wage-priced field hours across every job (office excluded). */
  fieldHours: number
  fieldLaborUsd: number
  byJob: Map<string, JobDayLedgerJobDay>
}

export type JobDayLedgerJob = {
  hours: number
  laborUsd: number
  days: number
  firstYmd: string
  lastYmd: string
}

export type JobDayLedgerJobLabel = { number: string; name: string }

export type JobDayLedger = {
  startYmd: string
  endYmd: string
  officeJobLedgerId: string | null
  /** Every day in [start, end], zero-filled, in order. */
  days: JobDayLedgerDay[]
  dayByYmd: Map<string, JobDayLedgerDay>
  /** Jobs with at least one approved field session in the window. */
  jobs: Map<string, JobDayLedgerJob>
  /** Display labels for the touched jobs (the Days view's chips) — filled by the loader; empty in pure tests. */
  jobLabels: Map<string, JobDayLedgerJobLabel>
  /** Approved field hours on each touched job BEFORE the window (not charged — surfaced as a flag). */
  priorHoursByJob: Map<string, number>
  /** Closed field sessions in the window still awaiting approval (count nowhere yet). */
  pendingFieldSessions: number
  pendingFieldHours: number
  /** The three reference lenses over THIS window (pool ÷ field hours / invoiced revenue / field labor $). */
  rates: OverheadRateMethods
  totals: { poolUsd: number; fieldHours: number; fieldLaborUsd: number; invoicedRevenueUsd: number }
}

export type JobOverheadMethod = 'day' | 'A' | 'B' | 'C'
export const JOB_OVERHEAD_METHODS: ReadonlyArray<{ key: JobOverheadMethod; label: string; title: string }> = [
  { key: 'day', label: 'Day-share', title: 'Each day’s overhead pool split across the jobs worked that day by field hours — reconciles to the real pool' },
  { key: 'A', label: 'A · $/hr', title: 'Overhead pool ÷ field hours, then × this job’s field hours' },
  { key: 'B', label: 'B · % rev', title: 'Overhead pool ÷ invoiced revenue, then × this job’s revenue' },
  { key: 'C', label: 'C · × labor', title: 'Overhead pool ÷ field labor $, then × this job’s field labor $' },
]

export type JobOverheadDayLine = {
  ymd: string
  jobHours: number
  fieldHours: number
  poolUsd: number
  shareUsd: number
}

export type JobOverheadShare = {
  overheadUsd: number
  lines: JobOverheadDayLine[]
  hoursInWindow: number
  daysInWindow: number
}

function eachYmd(startYmd: string, endYmd: string, addDays: (ymd: string, delta: number) => string): string[] {
  const out: string[] = []
  let cur = startYmd
  let guard = 0
  while (cur <= endYmd && guard < 4000) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard += 1
  }
  return out
}

export function buildJobDayLedger(args: {
  startYmd: string
  endYmd: string
  officeJobLedgerId: string | null
  /** From `buildOtherJobsLaborByDay(...).detailByDay` — one line per approved, closed field session. */
  fieldDetailByDay: ReadonlyMap<string, readonly OtherJobsLaborDetailLine[]>
  /** From the overhead day merge: office labor + bid labor + office parts per day. */
  poolUsdByDay: ReadonlyMap<string, number>
  priorHoursByJob?: ReadonlyMap<string, number>
  jobLabels?: ReadonlyMap<string, JobDayLedgerJobLabel>
  pendingFieldSessions?: number
  pendingFieldHours?: number
  invoicedRevenueUsd?: number
  addDays: (ymd: string, delta: number) => string
}): JobDayLedger {
  const dayByYmd = new Map<string, JobDayLedgerDay>()
  const days: JobDayLedgerDay[] = []
  for (const ymd of eachYmd(args.startYmd, args.endYmd, args.addDays)) {
    const d: JobDayLedgerDay = { ymd, poolUsd: args.poolUsdByDay.get(ymd) ?? 0, fieldHours: 0, fieldLaborUsd: 0, byJob: new Map() }
    days.push(d)
    dayByYmd.set(ymd, d)
  }
  const jobs = new Map<string, JobDayLedgerJob>()
  for (const [ymd, lines] of args.fieldDetailByDay) {
    const d = dayByYmd.get(ymd)
    if (!d) continue
    for (const l of lines) {
      if (!(l.hours > 0)) continue
      d.fieldHours += l.hours
      d.fieldLaborUsd += l.laborUsd
      const jd = d.byJob.get(l.jobLedgerId) ?? { hours: 0, laborUsd: 0, people: [] }
      jd.hours += l.hours
      jd.laborUsd += l.laborUsd
      if (!jd.people.includes(l.userName)) jd.people.push(l.userName)
      d.byJob.set(l.jobLedgerId, jd)
      const j = jobs.get(l.jobLedgerId)
      if (j) {
        j.hours += l.hours
        j.laborUsd += l.laborUsd
        if (ymd < j.firstYmd) j.firstYmd = ymd
        if (ymd > j.lastYmd) j.lastYmd = ymd
      } else {
        jobs.set(l.jobLedgerId, { hours: l.hours, laborUsd: l.laborUsd, days: 0, firstYmd: ymd, lastYmd: ymd })
      }
    }
  }
  for (const d of days) for (const jobId of d.byJob.keys()) {
    const j = jobs.get(jobId)
    if (j) j.days += 1
  }
  let poolUsd = 0
  let fieldHours = 0
  let fieldLaborUsd = 0
  for (const d of days) {
    poolUsd += d.poolUsd
    fieldHours += d.fieldHours
    fieldLaborUsd += d.fieldLaborUsd
  }
  const invoicedRevenueUsd = args.invoicedRevenueUsd ?? 0
  return {
    startYmd: args.startYmd,
    endYmd: args.endYmd,
    officeJobLedgerId: args.officeJobLedgerId,
    days,
    dayByYmd,
    jobs,
    jobLabels: new Map(args.jobLabels ?? []),
    priorHoursByJob: new Map(args.priorHoursByJob ?? []),
    pendingFieldSessions: args.pendingFieldSessions ?? 0,
    pendingFieldHours: args.pendingFieldHours ?? 0,
    rates: computeOverheadRateMethods({ overheadPoolUsd: poolUsd, fieldHours, invoicedRevenueUsd, fieldLaborUsd }),
    totals: { poolUsd, fieldHours, fieldLaborUsd, invoicedRevenueUsd },
  }
}

/** Day-share: Σ over the job's days of pool(d) × jobHours(d) ÷ fieldHours(d). */
export function allocateJobOverheadDayShare(ledger: JobDayLedger, jobId: string): JobOverheadShare {
  const lines: JobOverheadDayLine[] = []
  let overheadUsd = 0
  let hoursInWindow = 0
  for (const d of ledger.days) {
    const jd = d.byJob.get(jobId)
    if (!jd || !(jd.hours > 0)) continue
    const shareUsd = d.fieldHours > 0 ? d.poolUsd * (jd.hours / d.fieldHours) : 0
    lines.push({ ymd: d.ymd, jobHours: jd.hours, fieldHours: d.fieldHours, poolUsd: d.poolUsd, shareUsd })
    overheadUsd += shareUsd
    hoursInWindow += jd.hours
  }
  return { overheadUsd, lines, hoursInWindow, daysInWindow: lines.length }
}

/** Overhead $ for one job under any of the four methods; null when the method's rate is undefined. */
export function jobOverheadByMethod(
  ledger: JobDayLedger,
  jobId: string,
  method: JobOverheadMethod,
  opts: { revenueUsd: number },
): number | null {
  if (method === 'day') return allocateJobOverheadDayShare(ledger, jobId).overheadUsd
  const j = ledger.jobs.get(jobId)
  if (method === 'A') return ledger.rates.methodA == null ? null : (j?.hours ?? 0) * ledger.rates.methodA
  if (method === 'B') return ledger.rates.methodB == null ? null : Math.max(0, opts.revenueUsd) * ledger.rates.methodB
  return ledger.rates.methodC == null ? null : (j?.laborUsd ?? 0) * ledger.rates.methodC
}

export type JobDayLedgerUnallocated = { usd: number; days: number }

/** Pool $ on days with no approved field hours — nobody is charged for it, and the strip says so. */
export function unallocatedJobDayOverhead(ledger: JobDayLedger): JobDayLedgerUnallocated {
  let usd = 0
  let days = 0
  for (const d of ledger.days) {
    if (d.poolUsd > 0 && !(d.fieldHours > 0)) {
      usd += d.poolUsd
      days += 1
    }
  }
  return { usd, days }
}

/** JSON-safe form for sessionStorage (Maps become arrays). */
export type JobDayLedgerSerialized = {
  startYmd: string
  endYmd: string
  officeJobLedgerId: string | null
  days: Array<{ ymd: string; poolUsd: number; fieldHours: number; fieldLaborUsd: number; byJob: Array<[string, JobDayLedgerJobDay]> }>
  priorHoursByJob: Array<[string, number]>
  jobLabels?: Array<[string, JobDayLedgerJobLabel]>
  pendingFieldSessions: number
  pendingFieldHours: number
  invoicedRevenueUsd: number
}

export function serializeJobDayLedger(l: JobDayLedger): JobDayLedgerSerialized {
  return {
    startYmd: l.startYmd,
    endYmd: l.endYmd,
    officeJobLedgerId: l.officeJobLedgerId,
    days: l.days.map((d) => ({ ymd: d.ymd, poolUsd: d.poolUsd, fieldHours: d.fieldHours, fieldLaborUsd: d.fieldLaborUsd, byJob: [...d.byJob.entries()] })),
    priorHoursByJob: [...l.priorHoursByJob.entries()],
    jobLabels: [...l.jobLabels.entries()],
    pendingFieldSessions: l.pendingFieldSessions,
    pendingFieldHours: l.pendingFieldHours,
    invoicedRevenueUsd: l.totals.invoicedRevenueUsd,
  }
}

export function deserializeJobDayLedger(s: JobDayLedgerSerialized): JobDayLedger {
  const days: JobDayLedgerDay[] = s.days.map((d) => ({ ...d, byJob: new Map(d.byJob) }))
  const dayByYmd = new Map(days.map((d) => [d.ymd, d]))
  const jobs = new Map<string, JobDayLedgerJob>()
  let poolUsd = 0
  let fieldHours = 0
  let fieldLaborUsd = 0
  for (const d of days) {
    poolUsd += d.poolUsd
    fieldHours += d.fieldHours
    fieldLaborUsd += d.fieldLaborUsd
    for (const [jobId, jd] of d.byJob) {
      const j = jobs.get(jobId)
      if (j) {
        j.hours += jd.hours
        j.laborUsd += jd.laborUsd
        j.days += 1
        if (d.ymd < j.firstYmd) j.firstYmd = d.ymd
        if (d.ymd > j.lastYmd) j.lastYmd = d.ymd
      } else jobs.set(jobId, { hours: jd.hours, laborUsd: jd.laborUsd, days: 1, firstYmd: d.ymd, lastYmd: d.ymd })
    }
  }
  return {
    startYmd: s.startYmd,
    endYmd: s.endYmd,
    officeJobLedgerId: s.officeJobLedgerId,
    days,
    dayByYmd,
    jobs,
    jobLabels: new Map(s.jobLabels ?? []),
    priorHoursByJob: new Map(s.priorHoursByJob),
    pendingFieldSessions: s.pendingFieldSessions,
    pendingFieldHours: s.pendingFieldHours,
    rates: computeOverheadRateMethods({ overheadPoolUsd: poolUsd, fieldHours, invoicedRevenueUsd: s.invoicedRevenueUsd, fieldLaborUsd }),
    totals: { poolUsd, fieldHours, fieldLaborUsd, invoicedRevenueUsd: s.invoicedRevenueUsd },
  }
}
