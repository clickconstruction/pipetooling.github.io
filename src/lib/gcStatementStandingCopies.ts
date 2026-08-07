import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { addDaysYmd, dowForYmd } from './emailSchedule/emailScheduleWeek'
import { salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'
import type { GcStatementRequestInsert, PendingGcStatementSend } from './gcStatementSchedule'

/**
 * Standing copies of the whole GC Review report (v2.1430, gc_statement stream).
 *
 * A "standing copy" is NOT a new database concept — it is a grouped view of
 * repeat_weekly WHOLE-REPORT chains in gc_statement_email_requests (one chain
 * per weekday per recipient; REPORT_SUBSCRIPTIONS.md: "the weekly chain is
 * rows, not config"). This kernel groups pending chains by recipient, derives
 * each chain's Central weekday/time, computes first-send instants, and diffs
 * an edit (weekday/time changes) into chain inserts + cancels. Pure — IO
 * stays in gcStatementEmailRequests.ts.
 *
 * Weekday convention matches the recurring-report tables: 0=Sun … 6=Sat.
 */

export type StandingCopyGroup = {
  /** Destination email, lowercased — the group key. */
  email: string
  /** Distinct Central weekdays with a pending chain, sorted 0=Sun…6=Sat. */
  weekdays: number[]
  /** 'HH:MM' Central. When chains disagree (legacy hand-made rows), the earliest. */
  timeHm: string
  /** Pending chain row ids per weekday (normally one per weekday; retries can double up). */
  rowIdsByWeekday: Record<number, string[]>
  allRowIds: string[]
  includeCollections: boolean
}

/** Central weekday + wall-clock of a send instant. */
export function chicagoWeekdayAndTime(sendAtIso: string): { dow: number; timeHm: string } | null {
  const d = new Date(sendAtIso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const hour = get('hour')
  const minute = get('minute')
  if (dow < 0 || !hour || !minute) return null
  return { dow, timeHm: `${hour}:${minute}` }
}

/** A pending row that is part of a standing whole-report copy (vs a one-off or a per-GC chain). */
export function isStandingWholeReportRow(
  r: Pick<PendingGcStatementSend, 'repeat_weekly' | 'gc_customer_id' | 'development_id'>,
): boolean {
  return r.repeat_weekly === true && r.gc_customer_id == null && r.development_id == null
}

/** Group pending standing whole-report chains by recipient email. Alphabetical by email. */
export function groupStandingCopies(rows: PendingGcStatementSend[]): StandingCopyGroup[] {
  const byEmail = new Map<string, StandingCopyGroup>()
  for (const r of rows) {
    if (!isStandingWholeReportRow(r)) continue
    const wt = chicagoWeekdayAndTime(r.send_at)
    if (!wt) continue
    const email = r.sent_to.trim().toLowerCase()
    let g = byEmail.get(email)
    if (!g) {
      g = { email, weekdays: [], timeHm: wt.timeHm, rowIdsByWeekday: {}, allRowIds: [], includeCollections: r.include_collections }
      byEmail.set(email, g)
    }
    if (!g.weekdays.includes(wt.dow)) g.weekdays.push(wt.dow)
    ;(g.rowIdsByWeekday[wt.dow] ??= []).push(r.id)
    g.allRowIds.push(r.id)
    if (wt.timeHm < g.timeHm) g.timeHm = wt.timeHm
  }
  const groups = [...byEmail.values()]
  for (const g of groups) g.weekdays.sort((a, b) => a - b)
  groups.sort((a, b) => a.email.localeCompare(b.email))
  return groups
}

/** Central civil date of an instant, YYYY-MM-DD (formatToParts — locale-independent, unlike en-CA under small-ICU). */
export function chicagoYmdOf(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Next instant (ISO) with the given Central weekday + wall clock strictly after `now`. */
export function nextOccurrenceIso(dow: number, timeHm: string, now: Date): string | null {
  const hm = /^(\d{1,2}):(\d{2})$/.exec(timeHm.trim())
  if (!hm || dow < 0 || dow > 6) return null
  const todayYmd = chicagoYmdOf(now)
  for (let d = 0; d <= 7; d++) {
    const ymd = addDaysYmd(todayYmd, d)
    if (dowForYmd(ymd) !== dow) continue
    const ms = salaryZonedWallClockToUtcMs(ymd, Number(hm[1]), Number(hm[2]), 0, APP_CALENDAR_TZ)
    if (ms != null && ms > now.getTime()) return new Date(ms).toISOString()
  }
  return null
}

export type StandingCopyEditInput = {
  requestedBy: string
  email: string
  /** Grouping dimension of the report the chains rebuild. */
  byDevelopment: boolean
  includeCollections: boolean
  desiredWeekdays: number[]
  desiredTimeHm: string
  /** The recipient's current group, or null when adding a new standing copy. */
  current: StandingCopyGroup | null
}

export type StandingCopyEditPlan =
  | { ok: true; inserts: GcStatementRequestInsert[]; cancelIds: string[] }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Diff an add/edit into chain inserts + cancels. A time change re-creates every
 * chain (the chain's instant IS its time); a pure weekday change touches only
 * the added/removed days. Zero desired weekdays = remove the standing copy.
 */
export function planStandingCopyEdit(input: StandingCopyEditInput, now: Date = new Date()): StandingCopyEditPlan {
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  const desired = [...new Set(input.desiredWeekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)

  const timeChanged = input.current != null && input.current.timeHm !== input.desiredTimeHm
  const currentDays = input.current?.weekdays ?? []
  const daysToAdd = timeChanged ? desired : desired.filter((d) => !currentDays.includes(d))
  const daysToCancel = timeChanged ? currentDays : currentDays.filter((d) => !desired.includes(d))

  const inserts: GcStatementRequestInsert[] = []
  for (const dow of daysToAdd) {
    const sendAt = nextOccurrenceIso(dow, input.desiredTimeHm, now)
    if (!sendAt) return { ok: false, error: 'Pick a valid time.' }
    inserts.push({
      requested_by: input.requestedBy,
      sent_to: email,
      group_by: input.byDevelopment ? 'development' : 'gc',
      gc_customer_id: null,
      development_id: null,
      entity_name: input.byDevelopment ? 'All developments' : 'All GCs',
      include_collections: input.includeCollections,
      send_at: sendAt,
      repeat_weekly: true,
    })
  }
  const cancelIds = daysToCancel.flatMap((d) => input.current?.rowIdsByWeekday[d] ?? [])
  if (inserts.length === 0 && cancelIds.length === 0) return { ok: false, error: 'Pick at least one weekday.' }
  return { ok: true, inserts, cancelIds }
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Mon · Wed" for a sorted weekday list, Monday-first display order. */
export function formatWeekdays(weekdays: number[]): string {
  const mondayFirst = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return mondayFirst.map((d) => DOW_SHORT[d] ?? '?').join(' · ')
}
