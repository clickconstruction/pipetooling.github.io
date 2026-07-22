import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage } from '../utils/errorHandling'

/**
 * Dispatch Mode → Schedule tab: pure month-grid/agenda helpers + data fetches.
 * All date math is on plain `YYYY-MM-DD` calendar keys (UTC Date arithmetic —
 * no timezone dependence); "today" comes from the caller via the app-calendar
 * helpers.
 */

export type DispatchModeMonthDay = {
  ymd: string
  dayNum: number
  inMonth: boolean
}

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
}

function utcToYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function dispatchModeAddDays(ymd: string, days: number): string {
  const d = ymdToUtc(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return utcToYmd(d)
}

export function dispatchModeAddMonths(ymd: string, months: number): string {
  const d = ymdToUtc(ymd)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  return utcToYmd(d)
}

export function dispatchModeMonthTitle(anchorYmd: string): string {
  const d = ymdToUtc(anchorYmd)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Sunday-first weeks covering the anchor's month (5–6 rows of 7 days). */
export function dispatchModeMonthGrid(anchorYmd: string): DispatchModeMonthDay[][] {
  const anchor = ymdToUtc(anchorYmd)
  const month = anchor.getUTCMonth()
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), month, 1))
  const gridStart = new Date(first)
  gridStart.setUTCDate(1 - first.getUTCDay())
  const weeks: DispatchModeMonthDay[][] = []
  const cursor = new Date(gridStart)
  for (;;) {
    const week: DispatchModeMonthDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({
        ymd: utcToYmd(cursor),
        dayNum: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === month,
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push(week)
    if (cursor.getUTCMonth() !== month || weeks.length >= 6) break
  }
  return weeks
}

/** "Today · Tue Jul 21" / "Wed Jul 22" agenda heading. */
export function dispatchModeAgendaHeading(selectedYmd: string, todayYmd: string): string {
  const d = ymdToUtc(selectedYmd)
  const label = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return selectedYmd === todayYmd ? `Today · ${label}` : label
}

export type DispatchModeAgendaBlock = {
  id: string
  assigneeUserId: string
  assigneeName: string
  timeStart: string
  timeEnd: string
  jobId: string
  hcpNumber: string | null
  clickNumber: string | null
  jobName: string
  jobAddress: string
  customerName: string
  serviceTypeName: string | null
}

/** Sort agenda rows by start time, then assignee name, then job name. */
export function sortDispatchModeAgendaBlocks(
  blocks: DispatchModeAgendaBlock[],
): DispatchModeAgendaBlock[] {
  return [...blocks].sort(
    (a, b) =>
      a.timeStart.localeCompare(b.timeStart) ||
      a.assigneeName.localeCompare(b.assigneeName) ||
      a.jobName.localeCompare(b.jobName),
  )
}

type BlockRowRaw = {
  id: string
  assignee_user_id: string
  time_start: string
  time_end: string
  job_id: string
  users: { name: string | null } | null
  jobs_ledger: {
    hcp_number: string | null
    click_number: string | null
    job_name: string | null
    job_address: string | null
    customer_name: string | null
    service_type: { name: string | null } | null
  } | null
}

/** Every person's schedule blocks for one calendar day (dispatcher view). */
export async function fetchDispatchModeDayBlocks(
  ymd: string,
): Promise<{ data: DispatchModeAgendaBlock[]; error: string | null }> {
  try {
    const rows = await withSupabaseRetry(
      async () =>
        supabase
          .from('job_schedule_blocks')
          .select(
            'id, assignee_user_id, time_start, time_end, job_id, users!job_schedule_blocks_assignee_user_id_fkey(name), jobs_ledger(hcp_number, click_number, job_name, job_address, customer_name, service_type:service_types(name))',
          )
          .eq('work_date', ymd)
          .order('time_start', { ascending: true }),
      'dispatch mode day blocks',
    )
    const out: DispatchModeAgendaBlock[] = []
    for (const r of (rows ?? []) as unknown as BlockRowRaw[]) {
      if (!r?.id) continue
      const jl = r.jobs_ledger
      out.push({
        id: r.id,
        assigneeUserId: r.assignee_user_id,
        assigneeName: (r.users?.name ?? '').trim() || 'Unknown',
        timeStart: r.time_start,
        timeEnd: r.time_end,
        jobId: r.job_id,
        hcpNumber: jl?.hcp_number ?? null,
        clickNumber: jl?.click_number ?? null,
        jobName: (jl?.job_name ?? '').trim() || 'Job',
        jobAddress: (jl?.job_address ?? '').trim(),
        customerName: (jl?.customer_name ?? '').trim(),
        serviceTypeName: jl?.service_type?.name ?? null,
      })
    }
    return { data: sortDispatchModeAgendaBlocks(out), error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** Set of days (ymd) in [startYmd, endYmd] that have at least one schedule block — the calendar dots. */
export async function fetchDispatchModeBusyDays(
  startYmd: string,
  endYmd: string,
): Promise<{ data: Set<string>; error: string | null }> {
  try {
    const rows = await withSupabaseRetry(
      async () =>
        supabase
          .from('job_schedule_blocks')
          .select('work_date')
          .gte('work_date', startYmd)
          .lte('work_date', endYmd),
      'dispatch mode busy days',
    )
    const set = new Set<string>()
    for (const r of (rows ?? []) as Array<{ work_date: string }>) {
      if (r?.work_date) set.add(r.work_date)
    }
    return { data: set, error: null }
  } catch (e) {
    return { data: new Set(), error: formatErrorMessage(e) }
  }
}
