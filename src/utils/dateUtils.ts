/**
 * Company default IANA time zone: America/Chicago (Central; CST/CDT via DST).
 * Use for work_date, week boundaries, dispatch calendar, and Chicago-wall schedule fields.
 * Do not hard-code CDT/CST offsets or duplicate this string elsewhere — import this constant
 * or (Edge) `supabase/functions/_shared/appTimeZone.ts`. See `TIME_AND_ZONES.md`.
 */
export const APP_CALENDAR_TZ = 'America/Chicago'

/** Stable UTC instant (noon) for a civil YYYY-MM-DD — used for DST-aware zone offset labels. */
export function referenceDateForWorkDateYmd(workDateYmd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(workDateYmd.trim())
  if (!m) return new Date()
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  return new Date(Date.UTC(y, mo, d, 12, 0, 0))
}

/** E.g. UTC−06:00 (Unicode minus). Null if `Intl` longOffset is unavailable. */
export function formatIanaTimeZoneLongOffsetLabel(iana: string, at: Date): string | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'longOffset' })
    const parts = dtf.formatToParts(at)
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value
    if (!tzPart) return null
    let m = tzPart.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
    if (!m && tzPart.startsWith('UTC')) {
      m = tzPart.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/)
    }
    if (!m) return null
    const sign = m[1]
    const hh = (m[2] ?? '0').padStart(2, '0')
    const mm = (m[3] ?? '00').padStart(2, '0')
    const unicodeMinus = '\u2212'
    const displaySign = sign === '-' ? unicodeMinus : '+'
    return `UTC${displaySign}${hh}:${mm}`
  } catch {
    return null
  }
}

/** E.g. CST, CDT (DST-aware for `at`). Null if `Intl` short name is unavailable. */
export function formatIanaTimeZoneShortAbbrev(iana: string, at: Date): string | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' })
    const parts = dtf.formatToParts(at)
    const v = parts.find((p) => p.type === 'timeZoneName')?.value?.trim()
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

const CHICAGO_WEEKDAY_SHORT_SUN0 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function companyWeekdaySunday0(ms: number): number {
  const w = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
  }).format(new Date(ms))
  const idx = CHICAGO_WEEKDAY_SHORT_SUN0.indexOf(w as (typeof CHICAGO_WEEKDAY_SHORT_SUN0)[number])
  return idx >= 0 ? idx : 0
}

/** Pure Gregorian YYYY-MM-DD ± n days (civil dates, not instants). */
export function ymdAddDays(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const base = new Date(Date.UTC(y, mo, d))
  base.setUTCDate(base.getUTCDate() + deltaDays)
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** ISO 8601 week number (1–53) for the Gregorian calendar day `YYYY-MM-DD` (UTC civil parts). Null if invalid. */
export function isoWeekNumberFromGregorianYmd(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null
  }
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  return Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7)
}

/** E.g. `04/05` for one work-date key, in `APP_CALENDAR_TZ`. */
export function formatMmDdSlash(ymd: string): string {
  const inst = referenceDateForWorkDateYmd(ymd)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: '2-digit',
    day: '2-digit',
  }).format(inst)
}

export type ScheduleDispatchWeekNavParts = {
  /** E.g. `Week 15`, or null if ISO week cannot be computed. */
  weekTitle: string | null
  /** E.g. `04/05–04/11` (en dash). */
  dateRange: string
}

/** ISO week from Thursday (`weekStart` + 4 days). `weekTitle` null ⇒ UI shows only `dateRange`. */
export function getScheduleDispatchWeekNavParts(weekStart: string, weekEnd: string): ScheduleDispatchWeekNavParts {
  const thu = ymdAddDays(weekStart, 4)
  const n = isoWeekNumberFromGregorianYmd(thu)
  const start = formatMmDdSlash(weekStart)
  const end = formatMmDdSlash(weekEnd)
  const dateRange = `${start}\u2013${end}`
  return { weekTitle: n === null ? null : `Week ${n}`, dateRange }
}

const dispatchWeekdayShortChicago = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: APP_CALENDAR_TZ,
})

function workDateYmdIsWeekendChicago(ymd: string): boolean {
  const d = referenceDateForWorkDateYmd(ymd)
  const s = dispatchWeekdayShortChicago.format(d)
  return s === 'Sat' || s === 'Sun'
}

/** Drop Saturday/Sunday in `APP_CALENDAR_TZ` (matches Schedule Dispatch column headers). */
export function filterWorkDateYmdsHideWeekend(ymds: string[]): string[] {
  return ymds.filter((ymd) => !workDateYmdIsWeekendChicago(ymd))
}

/** Sunday-start company week: full 7 days or Mon–Fri only when `hideWeekend`. */
export function getScheduleDispatchVisibleDayKeys(weekStart: string, hideWeekend: boolean): string[] {
  const all = Array.from({ length: 7 }, (_, i) => ymdAddDays(weekStart, i))
  return hideWeekend ? filterWorkDateYmdsHideWeekend(all) : all
}

/** `04/05–04/11` style from first/last visible work_date keys (en dash). */
export function formatScheduleDispatchVisibleDateRange(visibleDayKeys: string[]): string {
  const first = visibleDayKeys[0]
  const last = visibleDayKeys[visibleDayKeys.length - 1]
  if (first === undefined || last === undefined) return ''
  return `${formatMmDdSlash(first)}\u2013${formatMmDdSlash(last)}`
}

/**
 * One-line summary for accessibility or logs. Prefer `getScheduleDispatchWeekNavParts` for layout.
 */
export function formatScheduleDispatchWeekNavLabel(weekStart: string, weekEnd: string): string {
  const { weekTitle, dateRange } = getScheduleDispatchWeekNavParts(weekStart, weekEnd)
  return weekTitle === null ? dateRange : `${weekTitle} ${dateRange}`
}

/**
 * Snap YYYY-MM-DD to the Sunday that starts the America/Chicago week containing that civil date.
 * Use for `week` query normalization (Schedule Dispatch, etc.). `APP_CALENDAR_TZ` matches job schedule Chicago dates.
 */
export function companyWeekStartSundayContaining(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const ms = referenceDateForWorkDateYmd(ymd).getTime()
  const dow = companyWeekdaySunday0(ms)
  return ymdAddDays(ymd, -dow)
}

/** Week range: Sunday–Saturday for the current week (America/Chicago). */
export function getDefaultWeekRange(): { start: string; end: string } {
  const ms = Date.now()
  const todayKey = denverCalendarDayKey(ms)
  const dow = companyWeekdaySunday0(ms)
  const start = ymdAddDays(todayKey, -dow)
  const end = ymdAddDays(start, 6)
  return { start, end }
}

/** Week range: Sunday–Saturday for the previous week (America/Chicago). */
export function getLastWeekRange(): { start: string; end: string } {
  const { start: thisSun } = getDefaultWeekRange()
  const lastSun = ymdAddDays(thisSun, -7)
  const lastSat = ymdAddDays(lastSun, 6)
  return { start: lastSun, end: lastSat }
}

/** Inclusive Sunday (prior week) through Saturday (current week), America/Chicago. Matches leader split week gate. */
export function getThisAndLastWeekRange(): { start: string; end: string } {
  const { start: lastSun } = getLastWeekRange()
  const { end: thisSat } = getDefaultWeekRange()
  return { start: lastSun, end: thisSat }
}

/** YYYY-MM-DD in company calendar (America/Chicago) for an instant (en-CA). */
export function denverCalendarDayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

function utcMsFromCalendarYmd(ymd: string): number {
  const parts = ymd.split('-')
  if (parts.length !== 3) return NaN
  const y = Number(parts[0])
  const mo = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN
  return Date.UTC(y, mo - 1, d)
}

/**
 * Whole calendar days from the instant's company-calendar date to `nowMs`'s company-calendar date (Chicago).
 * 0 = same calendar day; non-negative (clamped).
 */
export function denverCalendarDaysBetweenInstantAndNow(contactMs: number, nowMs: number = Date.now()): number {
  const keyContact = denverCalendarDayKey(contactMs)
  const keyNow = denverCalendarDayKey(nowMs)
  const t0 = utcMsFromCalendarYmd(keyContact)
  const t1 = utcMsFromCalendarYmd(keyNow)
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0
  return Math.max(0, Math.floor((t1 - t0) / 86_400_000))
}

/** e.g. Mar 24 (no year). */
export function formatDenverCalendarDayShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms))
}

/** e.g. Mar 24, 2026 */
export function formatDenverCalendarDayWithYear(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms))
}

/** e.g. Monday, Mar 24, 2026 */
export function formatDenverCalendarDayWithWeekdayAndYear(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms))
}

/** Time only in company calendar (Chicago), e.g. 12:06 PM */
export function formatDenverTimeOnly(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

/** Short datetime in company calendar (segment crossing midnight). */
export function formatDenverDateTimeShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

/**
 * Single company-calendar day for block header, or range when block crosses midnight in Chicago.
 */
export function formatDenverBlockDateHeader(t0: number, t1: number): string {
  const k0 = denverCalendarDayKey(t0)
  const k1 = denverCalendarDayKey(t1)
  if (k0 === k1) return formatDenverCalendarDayWithYear(t0)
  const y0 = formatDenverCalendarDayWithYear(t0)
  const y1 = formatDenverCalendarDayWithYear(t1)
  const extractYear = (s: string) => {
    const m = s.match(/(\d{4})$/)
    return m ? m[1]! : ''
  }
  if (extractYear(y0) === extractYear(y1)) {
    const left = formatDenverCalendarDayShort(t0)
    const right = formatDenverCalendarDayShort(t1)
    return `${left} – ${right}, ${extractYear(y0)}`
  }
  return `${y0} – ${y1}`
}

/** e.g. Monday (America/Chicago). */
export function formatDenverWeekday(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'long',
  }).format(new Date(ms))
}

function formatDenverWeekdayShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'short',
  }).format(new Date(ms))
}

/**
 * Weekday line above strip start time: single long weekday, or Mon – Tue; cross-year adds year span.
 */
export function formatDenverBlockWeekdayHeader(t0: number, t1: number): string {
  const k0 = denverCalendarDayKey(t0)
  const k1 = denverCalendarDayKey(t1)
  if (k0 === k1) return formatDenverWeekday(t0)
  const y0 = formatDenverCalendarDayWithYear(t0)
  const y1 = formatDenverCalendarDayWithYear(t1)
  const extractYear = (s: string) => {
    const m = s.match(/(\d{4})$/)
    return m ? m[1]! : ''
  }
  const left = formatDenverWeekdayShort(t0)
  const right = formatDenverWeekdayShort(t1)
  if (extractYear(y0) === extractYear(y1)) {
    return `${left} – ${right}`
  }
  return `${left} – ${right}, ${extractYear(y0)} – ${extractYear(y1)}`
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** Friendly label for work_date YYYY-MM-DD (calendar date as stored; matches company work_date). */
export function formatWorkDateYmdFriendly(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const y = m[1]
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12) return ymd
  return `${MONTH_SHORT[mo - 1]} ${d}, ${y}`
}

/** E.g. `Apr 10` for calendar `YYYY-MM-DD` (month abbreviation + day; no year). */
export function formatWorkDateYmdMonthDayShort(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd.trim()
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12) return ymd.trim()
  return `${MONTH_SHORT[mo - 1]} ${d}`
}

/** Representative instant on this company work_date (for weekday extraction). */
function denverMsForWorkDateYmd(ymd: string): number | null {
  const trimmed = ymd.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  let ms = Date.UTC(y, mo - 1, d, 12, 0, 0)
  for (let i = 0; i < 48; i++) {
    if (denverCalendarDayKey(ms) === trimmed) return ms
    ms += 3600000
  }
  return null
}

/** e.g. Monday Mar 30, 2026 (Chicago weekday for work_date YYYY-MM-DD). */
export function formatWorkDateYmdWeekdayLongFriendly(ymd: string): string {
  const friendly = formatWorkDateYmdFriendly(ymd)
  const ms = denverMsForWorkDateYmd(ymd)
  if (ms == null) return friendly
  return `${formatDenverWeekday(ms)} ${friendly}`
}

/** Same company calendar day for both instants. */
export function denverSameCalendarDay(aMs: number, bMs: number): boolean {
  return denverCalendarDayKey(aMs) === denverCalendarDayKey(bMs)
}

export function formatDenverTimeRangeSameDay(aMs: number, bMs: number): string {
  return `${formatDenverTimeOnly(aMs)} – ${formatDenverTimeOnly(bMs)}`
}

const denverPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_CALENDAR_TZ,
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

function denverWallPartsAt(ms: number): {
  hour: string
  minute: string
  second: string
  dayPeriod: string
} {
  let hour = ''
  let minute = ''
  let second = ''
  let dayPeriod = ''
  for (const p of denverPartsFormatter.formatToParts(new Date(ms))) {
    if (p.type === 'hour') hour = p.value
    else if (p.type === 'minute') minute = p.value
    else if (p.type === 'second') second = p.value
    else if (p.type === 'dayPeriod') dayPeriod = p.value
  }
  return { hour, minute, second, dayPeriod }
}

export type DenverHourMark = { ms: number; label: string }

/**
 * Company-calendar local times that are exactly H:00:00 with t0Ms < ms < t1Ms (strict), for strip hour rulers.
 */
export function denverHourMarksBetween(t0Ms: number, t1Ms: number): DenverHourMark[] {
  if (!(t1Ms > t0Ms)) return []

  const raw: { ms: number; hour: string; dayPeriod: string }[] = []
  let ms = Math.floor(t0Ms / 60_000) * 60_000
  if (ms <= t0Ms) ms += 60_000
  for (; ms < t1Ms; ms += 60_000) {
    const { hour, minute, second, dayPeriod } = denverWallPartsAt(ms)
    if (minute === '00' && second === '00' && ms > t0Ms && ms < t1Ms) {
      raw.push({ ms, hour, dayPeriod })
    }
  }

  if (raw.length === 0) return []

  const periods = new Set(raw.map((r) => r.dayPeriod))
  const singleMeridiem = periods.size === 1

  return raw.map((r) => ({
    ms: r.ms,
    label: singleMeridiem ? r.hour : `${r.hour}${r.dayPeriod === 'AM' ? 'a' : 'p'}`,
  }))
}

/**
 * Compact display for bid/customer note timestamps in the viewer's local zone, e.g. `3/31/26, 6:10 PM`.
 */
export function formatCompactNoteDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
