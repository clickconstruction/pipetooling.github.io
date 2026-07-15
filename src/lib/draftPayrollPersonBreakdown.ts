import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrewBidRow, CrewJobRow } from '../utils/teamLabor'
import { withSupabaseRetry } from '../utils/errorHandling'
import { computePayReportAssignmentsBreakdown } from './payReportAssignmentsBreakdown'
import {
  EMPTY_SALARIED_PAYROLL_WINDOW,
  fetchSalariedPayrollWindows,
  salariedDayCredit,
  salariedDayCreditReasonLabel,
} from './salariedPayrollDays'

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export type DraftPayrollBreakdownDayRow = {
  work_date: string
  hours: number
  /** Salaried only: why this day pays what it does when not a plain workday (e.g. 'unpaid time off'). */
  salaryNote?: string | null
}

export type DraftPayrollBreakdownAssignmentRow = {
  date: string
  hours: number
  jobsText: string
  /**
   * Closed, unapproved (not rejected/revoked) clock hours this day. Not part of payroll hours
   * (`people_hours` only gets written on approval) — surfaced so "I edited a session but the
   * breakdown didn't move" visibly reads as "those hours are pending approval". Always 0 for salary.
   */
  pendingHours: number
  /** Salaried only: annotation when the day is not a plain 8 h workday (e.g. 'unpaid time off'). */
  salaryNote?: string | null
  /** Earliest clock-in ISO across this day's real (non-rejected/revoked) sessions; null if none. */
  firstClockIn?: string | null
  /** Latest clock-out ISO across this day's sessions; null if none closed / no sessions. */
  lastClockOut?: string | null
}

/**
 * Per work_date, the earliest clock-in and latest clock-out across the given sessions.
 * Pure — the caller passes the person's real (non-rejected/revoked) sessions in range.
 * Open sessions (no clock-out) still set `firstIn` but leave `lastOut` null.
 */
export function firstLastClockByDay(
  sessions: Array<{ work_date: string; clocked_in_at: string; clocked_out_at: string | null }>,
): Record<string, { firstIn: string; lastOut: string | null }> {
  const byDay: Record<string, { firstIn: string; lastOut: string | null }> = {}
  const t = (iso: string) => new Date(iso).getTime()
  for (const s of sessions) {
    if (!s.clocked_in_at || !Number.isFinite(t(s.clocked_in_at))) continue
    const cur = byDay[s.work_date]
    if (!cur) {
      byDay[s.work_date] = { firstIn: s.clocked_in_at, lastOut: s.clocked_out_at ?? null }
      continue
    }
    if (t(s.clocked_in_at) < t(cur.firstIn)) cur.firstIn = s.clocked_in_at
    if (s.clocked_out_at && (cur.lastOut === null || t(s.clocked_out_at) > t(cur.lastOut))) {
      cur.lastOut = s.clocked_out_at
    }
  }
  return byDay
}

/**
 * Sum closed pending-approval session durations per work_date. Pure — used to annotate the
 * breakdown rows; the caller filters to unapproved/unrejected/unrevoked sessions.
 */
export function sumPendingClockHoursByDay(
  sessions: Array<{ work_date: string; clocked_in_at: string; clocked_out_at: string | null }>,
): Record<string, number> {
  const byDay: Record<string, number> = {}
  for (const s of sessions) {
    if (!s.clocked_out_at) continue
    const ms = new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()
    if (!Number.isFinite(ms) || ms <= 0) continue
    byDay[s.work_date] = (byDay[s.work_date] ?? 0) + ms / 3_600_000
  }
  return byDay
}

/**
 * Day rows and crew assignment breakdown for Draft Payroll drill-down — mirrors {@link generatePayStub} date/hours logic.
 */
export async function fetchDraftPayrollPersonBreakdown(
  supabase: SupabaseClient,
  args: { personName: string; periodStart: string; periodEnd: string; isSalary: boolean },
): Promise<{ dayRows: DraftPayrollBreakdownDayRow[]; rows: DraftPayrollBreakdownAssignmentRow[] }> {
  const personName = args.personName.trim()
  const start = args.periodStart
  const end = args.periodEnd
  if (!personName || start > end) {
    return { dayRows: [], rows: [] }
  }

  const hoursRowsRaw = await withSupabaseRetry(
    () =>
      supabase.from('people_hours').select('work_date, hours').eq('person_name', personName).gte('work_date', start).lte('work_date', end),
    'draft payroll breakdown people_hours',
  )
  const hoursRows = ((hoursRowsRaw ?? []) as { work_date: string; hours: number }[])
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .map((r) => ({ date: r.work_date, hours: r.hours }))

  // Salaried: flat 8/0 adjusted for unpaid time off + employment window (mirrors generatePayStub).
  const salaryWindow = args.isSalary
    ? (await fetchSalariedPayrollWindows(supabase, [personName], start, end))[personName] ?? EMPTY_SALARIED_PAYROLL_WINDOW
    : null

  const daysInRange = getDaysInRange(start, end)
  const dayRows: DraftPayrollBreakdownDayRow[] = []
  for (const d of daysInRange) {
    if (salaryWindow) {
      const credit = salariedDayCredit(d, salaryWindow)
      dayRows.push({ work_date: d, hours: credit.hours, salaryNote: salariedDayCreditReasonLabel(credit.reason) })
    } else {
      dayRows.push({ work_date: d, hours: hoursRows.find((r) => r.date === d)?.hours ?? 0 })
    }
  }

  const [crewData, crewBidsData] = await Promise.all([
    withSupabaseRetry(
      () =>
        supabase
          .from('people_crew_jobs')
          .select('work_date, person_name, job_assignments')
          .gte('work_date', start)
          .lte('work_date', end),
      'draft payroll breakdown people_crew_jobs',
    ),
    withSupabaseRetry(
      () =>
        supabase
          .from('people_crew_bids')
          .select('work_date, person_name, bid_assignments')
          .gte('work_date', start)
          .lte('work_date', end),
      'draft payroll breakdown people_crew_bids',
    ),
  ])

  const crewRows = (crewData ?? []) as Array<{
    work_date: string
    person_name: string
    job_assignments: { job_id: string; pct: number }[]
  }>
  const crewBidsRows = (crewBidsData ?? []) as Array<{
    work_date: string
    person_name: string
    bid_assignments: { bid_id: string; pct: number }[]
  }>

  const crewByDatePerson: Record<string, CrewJobRow> = {}
  for (const r of crewRows) {
    crewByDatePerson[`${r.work_date}:${r.person_name}`] = {
      job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
    }
  }
  const crewBidsByDatePerson: Record<string, CrewBidRow> = {}
  for (const r of crewBidsRows) {
    crewBidsByDatePerson[`${r.work_date}:${r.person_name}`] = {
      bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
    }
  }

  const jobIds = new Set<string>()
  const bidIds = new Set<string>()
  for (const r of dayRows) {
    const row = crewByDatePerson[`${r.work_date}:${personName}`]
    for (const a of row?.job_assignments ?? []) jobIds.add(a.job_id)
    const bidRow = crewBidsByDatePerson[`${r.work_date}:${personName}`]
    for (const a of bidRow?.bid_assignments ?? []) bidIds.add(a.bid_id)
  }

  const jobsMap: Record<string, { hcp_number: string; job_name: string; job_address: string }> = {}
  const bidsMap: Record<string, { bid_number: string; project_name: string; address: string }> = {}

  if (jobIds.size > 0) {
    const jobsData = await withSupabaseRetry(
      () => supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: [...jobIds] }),
      'draft payroll breakdown get_jobs_ledger_by_ids',
    )
    for (const j of (jobsData ?? []) as {
      id: string
      hcp_number: string
      job_name: string
      job_address: string
    }[]) {
      jobsMap[j.id] = { hcp_number: j.hcp_number ?? '', job_name: j.job_name ?? '', job_address: j.job_address ?? '' }
    }
  }
  if (bidIds.size > 0) {
    const bidsData = await withSupabaseRetry(
      () => supabase.rpc('get_bids_by_ids', { p_bid_ids: [...bidIds] }),
      'draft payroll breakdown get_bids_by_ids',
    )
    for (const b of (bidsData ?? []) as {
      id: string
      bid_number: string
      project_name: string
      address: string
    }[]) {
      bidsMap[b.id] = { bid_number: b.bid_number ?? '', project_name: b.project_name ?? '', address: b.address ?? '' }
    }
  }

  // Pending-approval clock hours per day (hourly only — salary rows are synthetic 8h/weekday).
  // clock_sessions is user_id-keyed while payroll is person_name-keyed: resolve via the same
  // trimmed-name match the rest of the app uses, then sum closed unapproved sessions in range.
  let pendingByDay: Record<string, number> = {}
  let firstLastByDay: Record<string, { firstIn: string; lastOut: string | null }> = {}
  if (!args.isSalary) {
    const usersData = await withSupabaseRetry(
      () => supabase.from('users').select('id, name'),
      'draft payroll breakdown users for pending',
    )
    const userId = ((usersData ?? []) as { id: string; name: string | null }[]).find(
      (u) => (u.name ?? '').trim() === personName,
    )?.id
    if (userId) {
      // All real (non-rejected/revoked) sessions in range — approved and pending alike. One read
      // feeds both the pending-hours annotation (approved_at null subset) and the day clock span.
      const sessionData = await withSupabaseRetry(
        () =>
          supabase
            .from('clock_sessions')
            .select('work_date, clocked_in_at, clocked_out_at, approved_at')
            .eq('user_id', userId)
            .gte('work_date', start)
            .lte('work_date', end)
            .is('rejected_at', null)
            .is('revoked_at', null),
        'draft payroll breakdown clock sessions',
      )
      const sessions = (sessionData ?? []) as Array<{
        work_date: string
        clocked_in_at: string
        clocked_out_at: string | null
        approved_at: string | null
      }>
      pendingByDay = sumPendingClockHoursByDay(sessions.filter((s) => s.approved_at === null))
      firstLastByDay = firstLastClockByDay(sessions)
    }
  }

  const salaryNoteByDate = new Map(dayRows.map((d) => [d.work_date, d.salaryNote ?? null]))
  const baseRows = computePayReportAssignmentsBreakdown(personName, dayRows, crewByDatePerson, crewBidsByDatePerson, jobsMap, bidsMap)
  const rows: DraftPayrollBreakdownAssignmentRow[] = baseRows.map((r) => ({
    ...r,
    pendingHours: pendingByDay[r.date] ?? 0,
    salaryNote: salaryNoteByDate.get(r.date) ?? null,
    firstClockIn: firstLastByDay[r.date]?.firstIn ?? null,
    lastClockOut: firstLastByDay[r.date]?.lastOut ?? null,
  }))
  return { dayRows, rows }
}
