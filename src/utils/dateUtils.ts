/** Company-wide calendar for work_date, week gates, and My Time (matches server RPCs). */
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
function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
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

/** Week range: Sunday–Saturday for the current week (America/Chicago). */
export function getDefaultWeekRange(): { start: string; end: string } {
  const ms = Date.now()
  const todayKey = denverCalendarDayKey(ms)
  const dow = companyWeekdaySunday0(ms)
  const start = addCalendarDaysYmd(todayKey, -dow)
  const end = addCalendarDaysYmd(start, 6)
  return { start, end }
}

/** Week range: Sunday–Saturday for the previous week (America/Chicago). */
export function getLastWeekRange(): { start: string; end: string } {
  const { start: thisSun } = getDefaultWeekRange()
  const lastSun = addCalendarDaysYmd(thisSun, -7)
  const lastSat = addCalendarDaysYmd(lastSun, 6)
  return { start: lastSun, end: lastSat }
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
