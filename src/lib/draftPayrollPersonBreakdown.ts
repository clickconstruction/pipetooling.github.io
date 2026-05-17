import type { SupabaseClient } from '@supabase/supabase-js'
import type { CrewBidRow, CrewJobRow } from '../utils/teamLabor'
import { withSupabaseRetry } from '../utils/errorHandling'
import { computePayReportAssignmentsBreakdown } from './payReportAssignmentsBreakdown'

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

export type DraftPayrollBreakdownDayRow = { work_date: string; hours: number }

export type DraftPayrollBreakdownAssignmentRow = { date: string; hours: number; jobsText: string }

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

  const daysInRange = getDaysInRange(start, end)
  const dayRows: DraftPayrollBreakdownDayRow[] = []
  for (const d of daysInRange) {
    const hrs = args.isSalary
      ? (() => {
          const day = new Date(d + 'T12:00:00').getDay()
          return day >= 1 && day <= 5 ? 8 : 0
        })()
      : hoursRows.find((r) => r.date === d)?.hours ?? 0
    dayRows.push({ work_date: d, hours: hrs })
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

  const rows = computePayReportAssignmentsBreakdown(personName, dayRows, crewByDatePerson, crewBidsByDatePerson, jobsMap, bidsMap)
  return { dayRows, rows }
}
