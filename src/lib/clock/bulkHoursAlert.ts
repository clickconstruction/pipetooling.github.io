/**
 * Bulk hours alert (v2.4281): one person typed hours onto several days in a short time. The
 * database finds the bursts (`list_bulk_hours_alerts()`, over the typed-hours ledger, thresholds
 * in app_settings, never the viewer's own typing); this kernel is the words the Needs You card
 * says about them. The sibling of the bulk-deletion notice: a burst never drains on its own, so
 * the card carries snooze / dismiss.
 */
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export type BulkHoursAlert = {
  actorId: string
  actorName: string
  /** Distinct (person, day) pairs typed onto in the burst — the unit, not sessions. */
  days: number
  people: number
  seconds: number
  /** Days nobody else has looked at yet. */
  waitingDays: number
  firstTypedAt: string
  lastTypedAt: string
  windowStart: string
  windowEnd: string
  peopleNames: string[]
  firstWorkDate: string
  lastWorkDate: string
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}

export function parseBulkHoursAlertRow(raw: unknown): BulkHoursAlert | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const actorId = str(r.actor_id)
  if (!actorId) return null
  return {
    actorId,
    actorName: str(r.actor_name, 'Someone') || 'Someone',
    days: num(r.days),
    people: num(r.people),
    seconds: num(r.seconds),
    waitingDays: num(r.waiting_days),
    firstTypedAt: str(r.first_typed_at),
    lastTypedAt: str(r.last_typed_at),
    windowStart: str(r.window_start),
    windowEnd: str(r.window_end),
    peopleNames: Array.isArray(r.people_names) ? r.people_names.filter((n): n is string => typeof n === 'string') : [],
    firstWorkDate: str(r.first_work_date),
    lastWorkDate: str(r.last_work_date),
  }
}

/** First typed to last typed, in whole minutes, at least 1. */
export function bulkHoursBurstMinutes(a: BulkHoursAlert): number {
  const ms = new Date(a.lastTypedAt).getTime() - new Date(a.firstTypedAt).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 1
  return Math.max(1, Math.round(ms / 60_000))
}

function hoursWords(seconds: number): string {
  return `${(seconds / 3600).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`
}

function daySpanWords(a: BulkHoursAlert): string {
  if (!a.firstWorkDate) return ''
  const first = formatWorkDateYmdMonthDayShort(a.firstWorkDate)
  if (!a.lastWorkDate || a.lastWorkDate === a.firstWorkDate) return first
  const last = formatWorkDateYmdMonthDayShort(a.lastWorkDate)
  const sameMonth = a.firstWorkDate.slice(0, 7) === a.lastWorkDate.slice(0, 7)
  return sameMonth ? `${first}–${last.replace(/^[A-Za-z]+ /, '')}` : `${first}–${last}`
}

/** "Taunya typed hours onto 8 days in 25 minutes" / "… onto 3 days for Michael A in 4 minutes". */
export function bulkHoursAlertTitle(a: BulkHoursAlert): string {
  const forWho = a.people === 1 && a.peopleNames[0] ? ` for ${a.peopleNames[0]}` : ''
  const minutes = bulkHoursBurstMinutes(a)
  return `${a.actorName} typed hours onto ${a.days} ${a.days === 1 ? 'day' : 'days'}${forWho} in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

/** The people and days, the hours, and how many days still wait. */
export function bulkHoursAlertDetail(a: BulkHoursAlert): string {
  const who = a.people === 1 ? '' : `${a.peopleNames.join(', ')} · `
  const span = daySpanWords(a)
  const looked = a.days - a.waitingDays
  const waiting =
    a.waitingDays === 0
      ? 'every day already looked at by someone else'
      : `${a.waitingDays} ${a.waitingDays === 1 ? 'day' : 'days'} still waiting${looked > 0 ? `, ${looked} already looked at` : ''}`
  return `${who}${span ? `${span} · ` : ''}${hoursWords(a.seconds)} the clock did not record, ${waiting}.`
}

/** What the card says when there is more than one burst. */
export function bulkHoursAlertsSummary(alerts: readonly BulkHoursAlert[]): string {
  const newest = alerts[0]
  if (!newest) return ''
  const days = alerts.reduce((s, a) => s + a.days, 0)
  const actors = new Set(alerts.map((a) => a.actorId)).size
  return `${days} days across ${alerts.length} bursts by ${actors} ${actors === 1 ? 'person' : 'people'} — newest: ${bulkHoursAlertTitle(newest)}.`
}
