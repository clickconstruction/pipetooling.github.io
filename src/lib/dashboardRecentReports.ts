import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { swipeBackHint } from './swipeAway'

/**
 * Dashboard Recent Reports inbox kernel (v2.1469; one put-away state since punch list #426).
 * A report is the viewer's own to mark, from their `report_reads` row:
 *   new    — no row (bold, blue dot)
 *   opened — a row (a tick). The older `done_at` reads as opened: there is one put-away state.
 * The list holds the new reports and the ones opened in place this session, so nothing vanishes
 * under a finger. A report marked opened leaves the list for the Opened group at the card's foot.
 */

export type RecentReportRow = {
  id: string
  template_name: string
  job_display_name: string
  created_at: string
  created_by_name: string
  /** Who wrote it. The viewer's own report is never new to them (punch list #384). */
  created_by_user_id?: string | null
  field_values?: Record<string, string>
  reported_at_lat?: number | null
  reported_at_lng?: number | null
  /** Set when the report is attached to a jobs_ledger row (vs a project/bid) — gates the Job Detail opener + pictures icon. */
  job_ledger_id?: string | null
  job_hcp_number?: string
  job_pictures_link?: string | null
  job_address?: string | null
}

/**
 * Roles that see the Recent Reports section (v2 gate lived inline in
 * Dashboard.tsx + three copies inside the section; single definition since the
 * superintendent rollout). `list_reports_with_job_info` already scopes
 * superintendents server-side to their assigned projects' reports, and a
 * primary to their own jobs' reports and the ones they wrote.
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

/**
 * The line a primary reads over a list of reports, on the Dashboard card and on Jobs, Reports. The database decides
 * what they read (migration `20261119040000_primary_scope_reports`): a report on a job that names them as account
 * manager or lists them as superintendent, or one they wrote. Every other role reads the list with no line.
 */
export const PRIMARY_REPORTS_SCOPE_LINE = 'You see reports on jobs where you are the account manager or the superintendent, and reports you wrote.'

export function reportsScopeLine(role: string | null | undefined): string | null {
  return role === 'primary' ? PRIMARY_REPORTS_SCOPE_LINE : null
}

/**
 * The read ids with the viewer's own reports added (punch list #384). The count reads `report_reads`, and nothing
 * writes a row when a person saves their own report, so each one counted as new and opened the section on them.
 * A person has read what they wrote: their own reports sit with the opened ones, behind *Show opened*. Nothing is
 * written, and a report they marked done stays done. Pure: a new set out, the one given untouched.
 */
export function readIdsWithOwnReports(readIds: ReadonlySet<string>, reports: ReadonlyArray<Pick<RecentReportRow, 'id' | 'created_by_user_id'>>, viewerUserId: string | null | undefined): Set<string> {
  const out = new Set(readIds)
  if (!viewerUserId) return out
  for (const r of reports) if (r.created_by_user_id === viewerUserId) out.add(r.id)
  return out
}

/** How far back the card reads. An older report is behind View all. */
export const RECENT_REPORTS_WINDOW_DAYS = 14

/** How many reports the list draws at a time, and how many the Opened group draws. */
export const RECENT_REPORTS_LIST_LIMIT = 8

/** The instant the window opens: `nowMs` less the window. A read of the marks from here on covers every report in it. */
export function recentReportsWindowStartIso(nowMs: number): string {
  return new Date(nowMs - RECENT_REPORTS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/** The reports filed inside the window, in the order given (the database answers newest first). */
export function reportsInWindow<T extends Pick<RecentReportRow, 'created_at'>>(reports: readonly T[], nowMs: number): T[] {
  const start = nowMs - RECENT_REPORTS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return reports.filter((r) => {
    const t = Date.parse(r.created_at)
    return !Number.isNaN(t) && t >= start
  })
}

export type RecentReportsCard = {
  /** The list: the new reports and the ones opened in place this session, newest first, eight at a time. */
  listed: RecentReportRow[]
  /** Every new report in the window: the badge. Until punch list #426 it could never read more than 8. */
  fresh: number
  /** The new reports the list is drawing now: the count on **Mark N opened**. */
  freshListed: number
  /** The reports put away, newest first, eight at most. */
  opened: RecentReportRow[]
  /** Every report put away in the window: the Opened heading's count. */
  openedCount: number
  /** Every report in the window, for a host that draws the card folded. */
  inWindow: number
}

/**
 * The card as it is drawn. Until punch list #426 the list was the newest eight reports, cut before
 * anything else: a ninth new report was never shown, and was not shown after the eight were cleared
 * either. Now the list is the new reports of the window, eight at a time, so it refills as it is cleared.
 * `readIds` holds every report the viewer has a mark on (opened or the older done) and their own.
 */
export function buildRecentReportsCard(
  reports: readonly RecentReportRow[],
  readIds: ReadonlySet<string>,
  sessionOpenedIds: ReadonlySet<string>,
  nowMs: number,
): RecentReportsCard {
  const windowed = reportsInWindow(reports, nowMs)
  const inList = windowed.filter((r) => !readIds.has(r.id) || sessionOpenedIds.has(r.id))
  const putAway = windowed.filter((r) => readIds.has(r.id) && !sessionOpenedIds.has(r.id))
  const listed = inList.slice(0, RECENT_REPORTS_LIST_LIMIT)
  return {
    listed,
    fresh: windowed.filter((r) => !readIds.has(r.id)).length,
    freshListed: listed.filter((r) => !readIds.has(r.id)).length,
    opened: putAway.slice(0, RECENT_REPORTS_LIST_LIMIT),
    openedCount: putAway.length,
    inWindow: windowed.length,
  }
}

/** The group at the card's foot that holds what was put away. */
export const RECENT_REPORTS_OPENED_HEADING = 'Opened'
export const RECENT_REPORTS_OPENED_GLOSS = 'You marked these opened. Mark unread puts one back.'

/**
 * The line under **Opened**'s heading. On a device held in the hand an opened report has no press: it
 * comes back with a swipe to the right, so the line says the swipe (v2.8603). A desk keeps the press.
 */
export function recentReportsOpenedGloss(swipes: boolean): string {
  return swipes ? `You marked these opened. ${swipeBackHint('mark it unread')}` : RECENT_REPORTS_OPENED_GLOSS
}

/** The toast after a report is marked unread from **Opened**, with Undo beside it (v2.8603). */
export function markedUnreadWords(jobName: string): string {
  return `Marked unread: ${jobName || 'report'}.`
}

/** Under the Opened group when it holds more than it draws. */
export function recentReportsOpenedMoreWords(shown: number, total: number): string | null {
  return total > shown ? `Showing the newest ${shown}. View all has every report.` : null
}

/** The words on the left of the foot's first row, beside **Mark N opened**. */
export function recentReportsNewWords(fresh: number): string {
  if (fresh <= 0) return 'Every report here is opened.'
  return `${fresh} new ${fresh === 1 ? 'report' : 'reports'}`
}

/** The toast after a put-away, with Undo: one report by its job's name, more by their count. */
export function markedOpenedWords(jobNames: readonly string[]): string {
  if (jobNames.length === 1) return `Marked opened: ${jobNames[0] || 'report'}.`
  return `${jobNames.length} reports marked opened.`
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

/**
 * When a report was filed, as one value: *yesterday 1:02 PM*, *Nov 21 4:08 PM*. The row drew the clock
 * at its right and the day under its name until punch list #426, one moment in two places.
 */
export function formatReportRowWhen(createdAtIso: string, nowMs: number): string {
  const t = formatReportRowTime(createdAtIso, nowMs)
  return `${t.day} ${t.clock}`.trim()
}
