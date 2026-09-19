/**
 * The recurring-digest vocabulary the Email reports surfaces share (v2.3595 — moved out of the
 * retired `RecurringDigestsPanel`): the activity scopes and crew filters the edge function and
 * the DB constraint accept, the Postgres `time` ↔ `<input type="time">` bridge, the weekday
 * bits, and the one-line "when" a schedule reads as.
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** Matches Edge + DB constraint on `activity_scope`. */
export type ActivityScope = 'calendar_yesterday' | 'calendar_today' | 'calendar_week' | 'calendar_last_week'
/** Matches Edge + DB constraint on `crew_filter`. */
export type CrewFilter = 'all_users' | 'my_team'

export const ACTIVITY_SCOPE_UI: readonly { value: ActivityScope; label: string }[] = [
  { value: 'calendar_yesterday', label: 'Jobs yesterday' },
  { value: 'calendar_today', label: 'Jobs today' },
  { value: 'calendar_week', label: 'Jobs this week (Sun–Sat)' },
  { value: 'calendar_last_week', label: 'Jobs last week (Sun–Sat)' },
] as const

export const CREW_FILTER_UI: readonly { value: CrewFilter; label: string }[] = [
  { value: 'all_users', label: 'All users' },
  { value: 'my_team', label: 'My team (people you lead)' },
] as const

export function parseActivityScope(v: unknown): ActivityScope {
  return v === 'calendar_yesterday' || v === 'calendar_today' || v === 'calendar_week' || v === 'calendar_last_week' ? v : 'calendar_yesterday'
}

export function parseCrewFilter(v: unknown): CrewFilter {
  return v === 'all_users' || v === 'my_team' ? v : 'all_users'
}

/** `time` HH:MM (15-minute step expected) → Postgres `HH:MM:SS`. */
export function toPgTime(hhMm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhMm.trim())
  if (!m) return '06:00:00'
  return `${m[1]}:${m[2]}:00`
}

/** Postgres `HH:MM:SS` → HH:MM for `<input type="time" />`. */
export function fromPgTime(t: string | null | undefined): string {
  const s = (t ?? '06:00:00').slice(0, 5)
  return /^(\d{2}):(\d{2})$/.test(s) ? s : '06:00'
}

export function defaultWeekdays(): number[] {
  return [1, 2, 3, 4, 5]
}

export const WEEKDAYS: readonly { bit: number; label: string }[] = [
  { bit: 0, label: 'Sun' },
  { bit: 1, label: 'Mon' },
  { bit: 2, label: 'Tue' },
  { bit: 3, label: 'Wed' },
  { bit: 4, label: 'Thu' },
  { bit: 5, label: 'Fri' },
  { bit: 6, label: 'Sat' },
]

/** "Mon–Fri", "Every day", "Tue–Sat", "Mon, Wed, Fri". */
export function describeWeekdays(days: readonly number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
  if (sorted.length === 0) return 'no days'
  if (sorted.length === 7) return 'Every day'
  const labels = sorted.map((d) => WEEKDAYS[d]?.label ?? String(d))
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1)
  if (consecutive && sorted.length >= 3) return `${labels[0]}–${labels[labels.length - 1]}`
  return labels.join(', ')
}

/** "7:00 AM" from Postgres `07:00:00`. */
export function describeTime(t: string | null | undefined): string {
  const hm = fromPgTime(t)
  const [h, m] = hm.split(':').map((x) => Number.parseInt(x, 10))
  const hour = h ?? 6
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

/** "Mon–Fri 7:00 AM" — the schedule's when, for the Schedules line and the editor. */
export function describeScheduleWhen(s: { days_of_week: number[] | null; time_local: string | null }): string {
  return `${describeWeekdays(s.days_of_week ?? [])} ${describeTime(s.time_local)}`
}

export function calendarDayKeyWithZone(ms: number, timeZone: string): string {
  const zone = timeZone.trim() || APP_CALENDAR_TZ
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}
