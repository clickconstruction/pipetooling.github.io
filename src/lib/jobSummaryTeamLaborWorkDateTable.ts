/**
 * Merges team labor "allocated by work date" with clock punch rows for Job Summary
 * (one sorted table: crew row(s) + punch row(s) per calendar day).
 */

export type ByWorkDateEntry = { workDate: string; hours: number; cost: number }

export type ClockSessionLike = {
  id: string
  work_date: string | null
  clocked_in_at: string | null
  clocked_out_at: string | null
}

export type JobSummaryTeamLaborWorkDateTableRow =
  | { kind: 'alloc'; workDate: string; hours: number; cost: number }
  | { kind: 'punch'; workDate: string; session: ClockSessionLike }

/** Sessions with no work_date are grouped and sorted after dated rows. */
export const JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE = '__no_work_date__' as const

function sessionSortTime(s: ClockSessionLike): number {
  if (!s.clocked_in_at) return 0
  const t = new Date(s.clocked_in_at).getTime()
  return Number.isFinite(t) ? t : 0
}

export function isJobSummaryNoWorkDateKey(
  w: string,
): w is typeof JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE {
  return w === JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE
}

/**
 * Produces a flat list: for each work date (sorted), one optional alloc row, then
 * punch rows for that date (in clock order).
 */
export function buildJobSummaryTeamLaborWorkDateTableRows(
  byWorkDate: ByWorkDateEntry[],
  sessions: ClockSessionLike[],
): JobSummaryTeamLaborWorkDateTableRow[] {
  const allocByDate = new Map<string, { hours: number; cost: number }>()
  for (const d of byWorkDate) {
    allocByDate.set(d.workDate, { hours: d.hours, cost: d.cost })
  }
  const sessionsByDate = new Map<string, ClockSessionLike[]>()
  for (const s of sessions) {
    const key =
      s.work_date != null && String(s.work_date).length > 0
        ? s.work_date
        : JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, [])
    sessionsByDate.get(key)!.push(s)
  }
  for (const list of sessionsByDate.values()) {
    list.sort((a, b) => sessionSortTime(a) - sessionSortTime(b))
  }
  const allKeys = new Set<string>([...allocByDate.keys(), ...sessionsByDate.keys()])
  const sorted = [...allKeys].sort((a, b) => {
    if (a === JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE) return 1
    if (b === JOB_SUMMARY_TEAM_LABOR_NO_WORK_DATE) return -1
    return a.localeCompare(b)
  })
  const out: JobSummaryTeamLaborWorkDateTableRow[] = []
  for (const workDate of sorted) {
    const alloc = allocByDate.get(workDate)
    if (alloc) {
      out.push({ kind: 'alloc', workDate, hours: alloc.hours, cost: alloc.cost })
    }
    for (const session of sessionsByDate.get(workDate) ?? []) {
      out.push({ kind: 'punch', workDate, session })
    }
  }
  return out
}
