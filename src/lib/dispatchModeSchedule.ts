import { supabase } from './supabase'
import { withSupabaseRetry, formatErrorMessage, errorKindOf, type DatabaseErrorKind } from '../utils/errorHandling'

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

/** Sunday-first rows for the week containing `todayYmd` plus the next week. */
export function dispatchModeTwoWeekGrid(todayYmd: string): DispatchModeMonthDay[][] {
  const today = ymdToUtc(todayYmd)
  const weekStart = new Date(today)
  weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay())
  const weeks: DispatchModeMonthDay[][] = []
  const cursor = new Date(weekStart)
  for (let w = 0; w < 2; w++) {
    const week: DispatchModeMonthDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ ymd: utcToYmd(cursor), dayNum: cursor.getUTCDate(), inMonth: true })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push(week)
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
  note: string | null
  sharedBlockGroupId: string | null
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
  note: string | null
  shared_block_group_id: string | null
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

/**
 * Every person's schedule blocks for one calendar day (dispatcher view).
 * `errorKind` is the failure's class (v2.2843) so the agenda's error panel can
 * offer Retry only when the network — not the server — was the problem.
 */
export async function fetchDispatchModeDayBlocks(
  ymd: string,
  assigneeUserId?: string,
): Promise<{ data: DispatchModeAgendaBlock[]; error: string | null; errorKind: DatabaseErrorKind | null }> {
  try {
    const rows = await withSupabaseRetry(
      async () => {
        let q = supabase
          .from('job_schedule_blocks')
          .select(
            'id, assignee_user_id, time_start, time_end, note, shared_block_group_id, job_id, users!job_schedule_blocks_assignee_user_id_fkey(name), jobs_ledger(hcp_number, click_number, job_name, job_address, customer_name, service_type:service_types(name))',
          )
          .eq('work_date', ymd)
        if (assigneeUserId) q = q.eq('assignee_user_id', assigneeUserId)
        return q.order('time_start', { ascending: true })
      },
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
        note: r.note,
        sharedBlockGroupId: r.shared_block_group_id,
        jobId: r.job_id,
        hcpNumber: jl?.hcp_number ?? null,
        clickNumber: jl?.click_number ?? null,
        jobName: (jl?.job_name ?? '').trim() || 'Job',
        jobAddress: (jl?.job_address ?? '').trim(),
        customerName: (jl?.customer_name ?? '').trim(),
        serviceTypeName: jl?.service_type?.name ?? null,
      })
    }
    return { data: sortDispatchModeAgendaBlocks(out), error: null, errorKind: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e), errorKind: errorKindOf(e) }
  }
}

/** Set of days (ymd) in [startYmd, endYmd] that have at least one schedule block — the calendar dots. */
/**
 * Distinct jobs per day from schedule-block rows. Multiple blocks on the same
 * job/day count once; a block with no job link counts as its own unit so a
 * scheduled non-job day is never rendered as empty.
 */
export function countDispatchModeJobsByDay(
  rows: Array<{ work_date: string; job_id: string | null }>,
): Map<string, number> {
  const jobsByDay = new Map<string, Set<string>>()
  const nullBlocksByDay = new Map<string, number>()
  for (const r of rows) {
    if (!r?.work_date) continue
    if (r.job_id) {
      let set = jobsByDay.get(r.work_date)
      if (!set) {
        set = new Set()
        jobsByDay.set(r.work_date, set)
      }
      set.add(r.job_id)
    } else {
      nullBlocksByDay.set(r.work_date, (nullBlocksByDay.get(r.work_date) ?? 0) + 1)
    }
  }
  const counts = new Map<string, number>()
  for (const [ymd, set] of jobsByDay) counts.set(ymd, set.size)
  for (const [ymd, n] of nullBlocksByDay) counts.set(ymd, (counts.get(ymd) ?? 0) + n)
  return counts
}

/** Two-week header: distinct job count per day (was a busy-day dot until v2.1264). */
export async function fetchDispatchModeDayJobCounts(
  startYmd: string,
  endYmd: string,
  assigneeUserId?: string,
): Promise<{ data: Map<string, number>; error: string | null }> {
  try {
    const rows = await withSupabaseRetry(
      async () => {
        let q = supabase
          .from('job_schedule_blocks')
          .select('work_date, job_id')
          .gte('work_date', startYmd)
          .lte('work_date', endYmd)
        if (assigneeUserId) q = q.eq('assignee_user_id', assigneeUserId)
        return q
      },
      'dispatch mode day job counts',
    )
    return { data: countDispatchModeJobsByDay((rows ?? []) as Array<{ work_date: string; job_id: string | null }>), error: null }
  } catch (e) {
    return { data: new Map(), error: formatErrorMessage(e) }
  }
}
