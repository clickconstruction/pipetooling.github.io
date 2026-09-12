/**
 * Your record (v2.3368) — the three things only the person who worked can
 * put right, in their own units, with no money on the screen:
 *
 *   clock-open   a session still running from a past day (clocked in, never out)
 *   no-pct       an open job they clocked into this pay week that has no % complete
 *   no-report    a job they clocked into this pay week with no field report from them
 *
 * These are the inputs that make the company's earned number honest (the
 * Bridge assumes half done when no % is set; hours that never closed can't be
 * approved), so a teammate keeping their record straight moves the number
 * without ever seeing it — the owner's decision of 2026-09-11: finances stay
 * on the Bridge, teammates get focus. Empty when the record is clean. Pure.
 */

export type YourRecordSession = {
  id: string
  jobId: string | null
  workDate: string
  clockedOutAt: string | null
  /** Closed-session length; 0 while open. */
  hours: number
}

export type YourRecordJob = {
  id: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  pctComplete: number | null
  status: string | null
}

export type YourRecordItem =
  | { key: 'clock-open'; sessionId: string; ymd: string; jobId: string | null; job: YourRecordJob | null }
  | { key: 'no-pct'; jobId: string; job: YourRecordJob; hours: number }
  | { key: 'no-report'; jobId: string; job: YourRecordJob; hours: number; lastWorkYmd: string }

export const YOUR_RECORD_MAX_ITEMS = 3

const FINISHED = new Set(['ready_to_bill', 'billed', 'paid'])
const r1 = (n: number): number => Math.round(n * 10) / 10

export function buildYourRecordItems(input: {
  todayYmd: string
  weekStart: string
  sessions: ReadonlyArray<YourRecordSession>
  jobsById: ReadonlyMap<string, YourRecordJob>
  /** Jobs this person filed a field report on this pay week. */
  reportedJobIds: ReadonlySet<string>
  officeJobId: string | null
}): YourRecordItem[] {
  const { todayYmd, weekStart } = input
  const out: YourRecordItem[] = []

  // 1. Still on the clock from a past day — oldest first.
  const open = input.sessions.filter((s) => !s.clockedOutAt && s.workDate < todayYmd).sort((a, b) => a.workDate.localeCompare(b.workDate))
  for (const s of open) out.push({ key: 'clock-open', sessionId: s.id, ymd: s.workDate, jobId: s.jobId, job: s.jobId ? (input.jobsById.get(s.jobId) ?? null) : null })

  // Jobs touched this pay week by closed sessions (office job is overhead, not a job to report on).
  const hoursByJob = new Map<string, number>()
  const lastWorkByJob = new Map<string, string>()
  for (const s of input.sessions) {
    if (!s.jobId || !s.clockedOutAt) continue
    if (s.workDate < weekStart || s.workDate > todayYmd) continue
    if (input.officeJobId && s.jobId === input.officeJobId) continue
    hoursByJob.set(s.jobId, (hoursByJob.get(s.jobId) ?? 0) + Math.max(0, s.hours))
    const last = lastWorkByJob.get(s.jobId)
    if (!last || s.workDate > last) lastWorkByJob.set(s.jobId, s.workDate)
  }
  const touched = [...hoursByJob.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  // 2. No % complete on an open job you worked — most hours first.
  for (const [jobId, hours] of touched) {
    const job = input.jobsById.get(jobId)
    if (!job || (job.status != null && FINISHED.has(job.status))) continue
    if (job.pctComplete != null && Number.isFinite(job.pctComplete) && job.pctComplete > 0) continue
    out.push({ key: 'no-pct', jobId, job, hours: r1(hours) })
  }

  // 3. No field report from you on a job you worked — most hours first.
  for (const [jobId, hours] of touched) {
    const job = input.jobsById.get(jobId)
    if (!job || (job.status != null && FINISHED.has(job.status))) continue
    if (input.reportedJobIds.has(jobId)) continue
    out.push({ key: 'no-report', jobId, job, hours: r1(hours), lastWorkYmd: lastWorkByJob.get(jobId) ?? weekStart })
  }

  return out.slice(0, YOUR_RECORD_MAX_ITEMS)
}

const jobWord = (job: YourRecordJob | null): string => (job ? `${job.hcpNumber ? `${job.hcpNumber} ` : ''}${job.jobName}`.trim() || 'a job' : 'a job')
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
const hrs = (h: number): string => (h < 10 ? h.toFixed(1) : String(Math.round(h)))

/** Plain words for a row: what, why it matters to the record, and the verb on the button. */
export function yourRecordItemCopy(item: YourRecordItem): { title: string; detail: string; action: string } {
  switch (item.key) {
    case 'clock-open':
      return {
        title: `You're still on the clock from ${md(item.ymd)}`,
        detail: `Clocked in${item.job ? ` at ${jobWord(item.job)}` : ''}, never clocked out. Fix the day so the hours are right.`,
        action: 'Fix day',
      }
    case 'no-pct':
      return {
        title: `${jobWord(item.job)} has no % complete`,
        detail: `You clocked ${hrs(item.hours)}h there this week. Nobody has said how far along it is.`,
        action: 'Set %',
      }
    case 'no-report':
      return {
        title: `No report on ${jobWord(item.job)}`,
        detail: `You worked it ${md(item.lastWorkYmd)} (${hrs(item.hours)}h this week); no field report from you yet.`,
        action: 'Report',
      }
  }
}
