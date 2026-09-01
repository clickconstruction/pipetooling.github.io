import { APP_CALENDAR_TZ } from '../utils/dateUtils'

/**
 * Dashboard Recent Reports inbox kernel (v2.1469). States per report, from
 * the viewer's report_reads row:
 *   new    — no row (bold, blue dot)
 *   opened — read_at set, done_at null (stays listed, dimmed)
 *   done   — done_at set (cleared from the dashboard; View all still shows it)
 * Opened rows show inline when opened this session (nothing vanishes as you
 * collapse) or when the "Show opened" footer toggle is on.
 */

export type RecentReportRow = {
  id: string
  template_name: string
  job_display_name: string
  created_at: string
  created_by_name: string
  field_values?: Record<string, string>
  reported_at_lat?: number | null
  reported_at_lng?: number | null
  /** Set when the report is attached to a jobs_ledger row (vs a project/bid) — gates the Job Detail opener + pictures icon. */
  job_ledger_id?: string | null
  job_hcp_number?: string
  job_pictures_link?: string | null
  job_address?: string | null
}

export type ReportRowState = 'new' | 'opened' | 'done'

/**
 * Roles that see the Recent Reports section (v2 gate lived inline in
 * Dashboard.tsx + three copies inside the section; single definition since the
 * superintendent rollout). `list_reports_with_job_info` already scopes
 * superintendents server-side to their assigned projects' reports.
 */
export function isDashboardRecentReportsRole(role: string | null | undefined): boolean {
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    role === 'assistant' ||
    role === 'controller' ||
    role === 'primary' ||
    role === 'superintendent'
  )
}

export function reportRowState(
  id: string,
  readIds: ReadonlySet<string>,
  doneIds: ReadonlySet<string>,
): ReportRowState {
  if (doneIds.has(id)) return 'done'
  if (readIds.has(id)) return 'opened'
  return 'new'
}

/** Blue "N new" badge count: not read and not done. */
export function recentReportsNewCount(
  reports: readonly RecentReportRow[],
  readIds: ReadonlySet<string>,
  doneIds: ReadonlySet<string>,
): number {
  return reports.filter((r) => reportRowState(r.id, readIds, doneIds) === 'new').length
}

/**
 * Rows in the list: done rows never show; new rows always show; opened rows
 * show when opened this session or when the footer toggle is on.
 */
export function visibleRecentReports(
  reports: readonly RecentReportRow[],
  readIds: ReadonlySet<string>,
  doneIds: ReadonlySet<string>,
  sessionOpenedIds: ReadonlySet<string>,
  showOpened: boolean,
): RecentReportRow[] {
  return reports.filter((r) => {
    const state = reportRowState(r.id, readIds, doneIds)
    if (state === 'done') return false
    if (state === 'new') return true
    return showOpened || sessionOpenedIds.has(r.id)
  })
}

/** Count for the "Show N opened reports" footer link (opened rows currently hidden). */
export function openedNotShownCount(
  reports: readonly RecentReportRow[],
  readIds: ReadonlySet<string>,
  doneIds: ReadonlySet<string>,
  sessionOpenedIds: ReadonlySet<string>,
): number {
  return reports.filter(
    (r) => reportRowState(r.id, readIds, doneIds) === 'opened' && !sessionOpenedIds.has(r.id),
  ).length
}

const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  hour: 'numeric',
  minute: '2-digit',
})
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
/** ICU-shape-proof Chicago YYYY-MM-DD (some Nodes render en-CA with US patterns). */
function chicagoYmdKey(d: Date): string {
  const parts = ymdFmt.formatToParts(d)
  const get = (t: Intl.DateTimeFormatPart['type']) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}
const monthDayFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric' })
const monthDayYearFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/**
 * Compact row timestamp in the company calendar zone: clock ("7:04 PM") plus a
 * day word — 'today', 'yesterday', "Aug 5", or "Aug 5, 2025" across years.
 */
export function formatReportRowTime(createdAtIso: string, nowMs: number): { clock: string; day: string } {
  const d = new Date(createdAtIso)
  if (Number.isNaN(d.getTime())) return { clock: '', day: '' }
  const clock = clockFmt.format(d)
  const dayYmd = chicagoYmdKey(d)
  const todayYmd = chicagoYmdKey(new Date(nowMs))
  const yesterdayYmd = chicagoYmdKey(new Date(nowMs - 24 * 60 * 60 * 1000))
  if (dayYmd === todayYmd) return { clock, day: 'today' }
  if (dayYmd === yesterdayYmd) return { clock, day: 'yesterday' }
  const sameYear = dayYmd.slice(0, 4) === todayYmd.slice(0, 4)
  return { clock, day: sameYear ? monthDayFmt.format(d) : monthDayYearFmt.format(d) }
}
