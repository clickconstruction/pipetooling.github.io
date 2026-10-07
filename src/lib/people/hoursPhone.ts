/**
 * People · Hours on a phone (punch list #30, PR 5d): three lists instead of
 * two tables and a grid. Pure — who is in, who left today, and who has hours
 * waiting, each as rows with one number.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export interface HoursPhoneSession {
  id: string
  user_id: string
  name: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string | null
  /** The job or bid as a short line, null when the session names none. */
  label: string | null
}

const hoursBetween = (fromIso: string, toMs: number) => Math.max(0, (toMs - Date.parse(fromIso)) / 3_600_000)

/** `5:12` — hours and minutes, the way a clock reads. */
export function hoursPhoneClock(hours: number): string {
  const mins = Math.max(0, Math.round(hours * 60))
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

export interface WhosInRow {
  userId: string
  name: string
  /** The open session's clock-in. */
  sinceIso: string
  label: string | null
  /** This session so far. */
  elapsed: string
}

/** One row per person clocked in now, A–Z; a person with two open sessions (it happens) is listed once, on the older one. */
export function whosInRows(sessions: ReadonlyArray<HoursPhoneSession>, nowMs: number): WhosInRow[] {
  const byUser = new Map<string, HoursPhoneSession>()
  for (const s of sessions) {
    if (s.clocked_out_at) continue
    const prev = byUser.get(s.user_id)
    if (!prev || s.clocked_in_at < prev.clocked_in_at) byUser.set(s.user_id, s)
  }
  return [...byUser.values()]
    .map((s) => ({ userId: s.user_id, name: s.name, sinceIso: s.clocked_in_at, label: s.label, elapsed: hoursPhoneClock(hoursBetween(s.clocked_in_at, nowMs)) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export interface LeftTodayRow {
  userId: string
  name: string
  firstInIso: string
  lastOutIso: string
  labels: string[]
  total: string
}

/** People who worked today and are out now — everyone in `inNow` is left off. */
export function leftTodayRows(sessions: ReadonlyArray<HoursPhoneSession>, inNow: ReadonlySet<string>): LeftTodayRow[] {
  const byUser = new Map<string, { name: string; first: string; last: string; hours: number; labels: string[] }>()
  for (const s of sessions) {
    if (!s.clocked_out_at || inNow.has(s.user_id)) continue
    const g = byUser.get(s.user_id) ?? { name: s.name, first: s.clocked_in_at, last: s.clocked_out_at, hours: 0, labels: [] }
    if (s.clocked_in_at < g.first) g.first = s.clocked_in_at
    if (s.clocked_out_at > g.last) g.last = s.clocked_out_at
    g.hours += hoursBetween(s.clocked_in_at, Date.parse(s.clocked_out_at))
    if (s.label && !g.labels.includes(s.label)) g.labels.push(s.label)
    byUser.set(s.user_id, g)
  }
  return [...byUser.entries()]
    .map(([userId, g]) => ({ userId, name: g.name, firstInIso: g.first, lastOutIso: g.last, labels: g.labels, total: hoursPhoneClock(g.hours) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export interface ApprovalsPhonePerson {
  userId: string
  name: string
  sessions: number
  days: number
  hours: number
  /** The oldest waiting work day, 'YYYY-MM-DD'. */
  oldestYmd: string
  /** Sessions with no job or bid named. */
  noJob: number
}

/** Who has hours waiting: one row per person, the longest-waiting first. */
export function approvalsPhonePeople(pending: ReadonlyArray<HoursPhoneSession>): ApprovalsPhonePerson[] {
  const byUser = new Map<string, ApprovalsPhonePerson & { dayKeys: Set<string> }>()
  for (const s of pending) {
    if (!s.clocked_out_at) continue
    const day = s.work_date ? s.work_date.slice(0, 10) : calendarYmdInAppTzFromIso(s.clocked_in_at)
    const g = byUser.get(s.user_id) ?? { userId: s.user_id, name: s.name, sessions: 0, days: 0, hours: 0, oldestYmd: day, noJob: 0, dayKeys: new Set<string>() }
    g.sessions += 1
    g.hours += hoursBetween(s.clocked_in_at, Date.parse(s.clocked_out_at))
    if (day < g.oldestYmd) g.oldestYmd = day
    if (!s.label) g.noJob += 1
    g.dayKeys.add(day)
    byUser.set(s.user_id, g)
  }
  return [...byUser.values()]
    .map(({ dayKeys, ...g }) => ({ ...g, days: dayKeys.size, hours: Math.round(g.hours * 10) / 10 }))
    .sort((a, b) => a.oldestYmd.localeCompare(b.oldestYmd) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
