/**
 * Supervision, PR 3 (to-dos/supervision): the supervisor's Dashboard, pure.
 *
 * Turns `get_supervised_days_payload` — the job-days the caller supervised, with the crew,
 * the report counts and the crew's sessions — into the three things the section shows:
 * the reports owed (a supervised job-day, today or earlier, with no report yet), the
 * reports filed, and the crew's hours by person and day, read-only. Nothing is assigned:
 * every line is a job-day the caller was on while able to run it.
 */
import { formatJobLedgerShortLine, type LedgerPrefixMap } from '../ledgerDisplayPrefixes'

export type SupervisedCrewMember = { user_id: string; name: string | null; role: string | null }

export type SupervisedJobDay = {
  job_id: string
  work_date: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  job_address: string | null
  report_count: number
  my_report_count: number
  crew: SupervisedCrewMember[]
}

export type SupervisedSession = {
  id: string
  user_id: string
  name: string | null
  job_id: string | null
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string | null
  approved: boolean
}

export type SupervisedDaysPayload = {
  supervisor: boolean
  from: string
  to: string
  job_days: SupervisedJobDay[]
  sessions: SupervisedSession[]
}

export type ReportOwedLine = {
  jobId: string
  workDate: string
  label: string
  address: string | null
  /** For the report door. */
  hcpNumber: string
  jobName: string
  crewNames: string[]
  /** Today's job-day: the report may still be coming. */
  isToday: boolean
}

export type CrewDayHours = { workDate: string; jobLabel: string; hours: number; open: boolean; approved: boolean; notes: string | null }

export type CrewPersonHours = { userId: string; name: string; role: string | null; totalHours: number; days: CrewDayHours[] }

export type SupervisedView = {
  supervisor: boolean
  jobDays: number
  reportsOwed: ReportOwedLine[]
  reportsFiled: number
  crew: CrewPersonHours[]
}

const EMPTY_PREFIX_MAP: LedgerPrefixMap = {}

export function supervisedJobLabel(d: Pick<SupervisedJobDay, 'hcp_number' | 'click_number' | 'job_name' | 'customer_name'>, prefixMap: LedgerPrefixMap = EMPTY_PREFIX_MAP): string {
  const name = (d.job_name ?? '').trim() || (d.customer_name ?? '').trim() || null
  return formatJobLedgerShortLine(prefixMap, null, d.hcp_number, name, d.click_number)
}

/** Hours of a session, its clock-out or `nowMs` for an open one; never negative. */
export function sessionHours(s: Pick<SupervisedSession, 'clocked_in_at' | 'clocked_out_at'>, nowMs: number): number {
  const inMs = Date.parse(s.clocked_in_at)
  if (!Number.isFinite(inMs)) return 0
  const outMs = s.clocked_out_at ? Date.parse(s.clocked_out_at) : nowMs
  if (!Number.isFinite(outMs) || outMs <= inMs) return 0
  return Math.round(((outMs - inMs) / 3_600_000) * 100) / 100
}

export function buildSupervisedView(payload: SupervisedDaysPayload | null, opts: { todayYmd: string; nowMs: number; prefixMap?: LedgerPrefixMap }): SupervisedView {
  if (!payload || !payload.supervisor) return { supervisor: false, jobDays: 0, reportsOwed: [], reportsFiled: 0, crew: [] }
  const prefixMap = opts.prefixMap ?? EMPTY_PREFIX_MAP
  const labelByJob = new Map<string, string>()
  const reportsOwed: ReportOwedLine[] = []
  let reportsFiled = 0
  for (const d of payload.job_days) {
    const label = supervisedJobLabel(d, prefixMap)
    labelByJob.set(d.job_id, label)
    if (d.work_date > opts.todayYmd) continue
    if (d.report_count > 0) {
      reportsFiled++
      continue
    }
    reportsOwed.push({
      jobId: d.job_id,
      workDate: d.work_date,
      label,
      address: (d.job_address ?? '').trim() || null,
      hcpNumber: (d.hcp_number ?? d.click_number ?? '').trim(),
      jobName: (d.job_name ?? d.customer_name ?? '').trim(),
      crewNames: d.crew.map((c) => (c.name ?? '').trim()).filter(Boolean),
      isToday: d.work_date === opts.todayYmd,
    })
  }
  reportsOwed.sort((a, b) => (a.workDate === b.workDate ? a.label.localeCompare(b.label) : b.workDate.localeCompare(a.workDate)))

  const byPerson = new Map<string, CrewPersonHours>()
  const roleByUser = new Map<string, string | null>()
  for (const d of payload.job_days) for (const c of d.crew) roleByUser.set(c.user_id, c.role)
  for (const s of payload.sessions) {
    const hours = sessionHours(s, opts.nowMs)
    let p = byPerson.get(s.user_id)
    if (!p) {
      p = { userId: s.user_id, name: (s.name ?? '').trim() || 'Unknown', role: roleByUser.get(s.user_id) ?? null, totalHours: 0, days: [] }
      byPerson.set(s.user_id, p)
    }
    p.totalHours = Math.round((p.totalHours + hours) * 100) / 100
    p.days.push({ workDate: s.work_date, jobLabel: (s.job_id && labelByJob.get(s.job_id)) || 'No job', hours, open: !s.clocked_out_at, approved: s.approved, notes: (s.notes ?? '').trim() || null })
  }
  const crew = [...byPerson.values()].sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name))
  for (const p of crew) p.days.sort((a, b) => b.workDate.localeCompare(a.workDate) || a.jobLabel.localeCompare(b.jobLabel))

  return { supervisor: true, jobDays: payload.job_days.length, reportsOwed, reportsFiled, crew }
}

/** "3 owed" · "all filed" · null when there was nothing to file yet. */
export function reportsSummary(view: SupervisedView): string | null {
  if (view.reportsOwed.length === 0 && view.reportsFiled === 0) return null
  if (view.reportsOwed.length === 0) return 'all filed'
  return `${view.reportsOwed.length} owed`
}
