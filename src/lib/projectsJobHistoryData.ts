/**
 * Pure data shape + reducers for the Projects → Job History Gantt.
 *
 * Aggregates approved `clock_sessions` rows (one per session) into per-job bars
 * with per-Chicago-calendar-day distinct-user counts. The UI consumes
 * `ProjectsJobHistoryBar[]` to draw each row's bar and per-day highlights.
 *
 * All day keys are Chicago `YYYY-MM-DD` (matches `clock_sessions.work_date`).
 */

import { ymdAddDays } from '../utils/dateUtils'

export type ProjectsJobHistoryClockRow = {
  job_ledger_id: string | null
  user_id: string
  work_date: string
  clocked_out_at: string | null
}

export type ProjectsJobHistoryJob = {
  id: string
  hcp_number: string
  job_name: string
  job_address: string
  service_type_id: string | null
  /**
   * `jobs_ledger.project_id` — non-null when this job is linked to a multi-phase project,
   * which lets the UI offer an "only show jobs with projects" filter.
   */
  project_id: string | null
}

export type ProjectsJobHistoryBar = {
  jobId: string
  hcpNumber: string
  jobName: string
  jobAddress: string
  serviceTypeId: string | null
  /**
   * `jobs_ledger.project_id` carried through from the source job, so the timeline can
   * filter to jobs that belong to a project without re-querying the DB.
   */
  projectId: string | null
  /** Earliest `work_date` across approved sessions. */
  firstWorkDateYmd: string
  /**
   * Latest `work_date` across **closed** approved sessions, OR `todayYmd` when no closed session yet.
   * When `openEnded === true`, the UI should draw a dashed right edge instead of a solid one.
   */
  lastWorkDateYmd: string
  /** No closed clock_out_at yet → bar extends to today (open-ended). */
  openEnded: boolean
  /** Distinct user count per `work_date` (only days with count >= 1). */
  perDayCounts: Map<string, number>
}

/** Inclusive YMD enumeration: `enumerateDaysInRange('2026-05-01', '2026-05-03') = ['2026-05-01', '2026-05-02', '2026-05-03']`. */
export function enumerateDaysInRange(startYmd: string, endYmd: string): string[] {
  if (!startYmd || !endYmd) return []
  if (startYmd > endYmd) return []
  const out: string[] = []
  let cur = startYmd
  // Hard cap to keep an accidental 100-year range from melting the browser.
  // 4 years of daily columns is already painful; abort beyond that.
  const MAX_DAYS = 366 * 4
  while (cur <= endYmd && out.length < MAX_DAYS) {
    out.push(cur)
    cur = ymdAddDays(cur, 1)
  }
  return out
}

/**
 * Build one `ProjectsJobHistoryBar` per job that has at least one matching session.
 * Jobs with zero sessions are omitted (the UI draws nothing for them).
 *
 * @param jobs    All `working`-status jobs in scope. Bar attaches HCP / name / service-type from here.
 * @param rows    Approved + non-rejected + non-revoked `clock_sessions` rows matching those job IDs.
 *                Sessions with `job_ledger_id == null` are ignored (defensive — RLS allows null).
 * @param todayYmd Today's Chicago `YYYY-MM-DD`. Open-ended bars extend to this date.
 */
export function aggregateClockSessionsToBars(
  jobs: readonly ProjectsJobHistoryJob[],
  rows: readonly ProjectsJobHistoryClockRow[],
  todayYmd: string,
): ProjectsJobHistoryBar[] {
  if (jobs.length === 0) return []

  const jobsById = new Map<string, ProjectsJobHistoryJob>()
  for (const j of jobs) jobsById.set(j.id, j)

  type Agg = {
    firstWorkDate: string | null
    lastClosedWorkDate: string | null
    /** YMD → Set<userId> for distinct user count later. */
    usersByDay: Map<string, Set<string>>
  }
  const agg = new Map<string, Agg>()

  for (const row of rows) {
    const jobId = row.job_ledger_id
    if (!jobId) continue
    if (!jobsById.has(jobId)) continue
    const wd = row.work_date
    if (!wd) continue
    let a = agg.get(jobId)
    if (!a) {
      a = { firstWorkDate: null, lastClosedWorkDate: null, usersByDay: new Map() }
      agg.set(jobId, a)
    }
    if (a.firstWorkDate === null || wd < a.firstWorkDate) a.firstWorkDate = wd
    if (row.clocked_out_at != null && (a.lastClosedWorkDate === null || wd > a.lastClosedWorkDate)) {
      a.lastClosedWorkDate = wd
    }
    let dayUsers = a.usersByDay.get(wd)
    if (!dayUsers) {
      dayUsers = new Set()
      a.usersByDay.set(wd, dayUsers)
    }
    dayUsers.add(row.user_id)
  }

  const bars: ProjectsJobHistoryBar[] = []
  for (const [jobId, a] of agg) {
    if (a.firstWorkDate === null) continue
    const job = jobsById.get(jobId)
    if (!job) continue
    const openEnded = a.lastClosedWorkDate === null
    const right = openEnded
      ? (todayYmd > a.firstWorkDate ? todayYmd : a.firstWorkDate)
      : (a.lastClosedWorkDate as string)
    const perDayCounts = new Map<string, number>()
    for (const [ymd, set] of a.usersByDay) {
      const n = set.size
      if (n > 0) perDayCounts.set(ymd, n)
    }
    bars.push({
      jobId,
      hcpNumber: job.hcp_number,
      jobName: job.job_name,
      jobAddress: job.job_address ?? '',
      serviceTypeId: job.service_type_id ?? null,
      projectId: job.project_id ?? null,
      firstWorkDateYmd: a.firstWorkDate,
      lastWorkDateYmd: right,
      openEnded,
      perDayCounts,
    })
  }

  // Newest-first by start date, then by HCP for tie-stability so the visual order is stable across refreshes.
  bars.sort((a, b) => {
    if (a.firstWorkDateYmd !== b.firstWorkDateYmd) {
      return a.firstWorkDateYmd > b.firstWorkDateYmd ? -1 : 1
    }
    return (a.hcpNumber ?? '').localeCompare(b.hcpNumber ?? '', undefined, { numeric: true })
  })

  return bars
}

export type PeopleCountColors = {
  /** Background color for the day cell. */
  background: string
  /** Foreground (text) color for the count badge. */
  foreground: string
}

/**
 * Map distinct-people-per-day count → palette. The 0-case is returned so callers can
 * decide to render an empty cell or skip rendering entirely (current UI skips count===0).
 */
export function peopleCountColor(count: number): PeopleCountColors {
  if (count <= 0) {
    return { background: 'transparent', foreground: 'var(--text-blue-900)' }
  }
  if (count === 1) return { background: 'var(--bg-blue-200)', foreground: 'var(--text-blue-900)' }
  if (count === 2) return { background: '#bfdbfe', foreground: '#1e3a8a' }
  if (count === 3) return { background: '#93c5fd', foreground: '#1e3a8a' }
  if (count === 4) return { background: '#60a5fa', foreground: '#ffffff' }
  return { background: '#3b82f6', foreground: '#ffffff' }
}
