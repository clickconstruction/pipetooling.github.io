/** Week range: Sunday–Saturday for the current week */
export function getDefaultWeekRange(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toLocaleDateString('en-CA'),
    end: end.toLocaleDateString('en-CA'),
  }
}

/** Week range: Sunday–Saturday for the previous week */
export function getLastWeekRange(): { start: string; end: string } {
  const d = new Date()
  const day = d.getDay()
  const thisSun = new Date(d)
  thisSun.setDate(d.getDate() - day)
  const lastSun = new Date(thisSun)
  lastSun.setDate(thisSun.getDate() - 7)
  const lastSat = new Date(lastSun)
  lastSat.setDate(lastSun.getDate() + 6)
  return {
    start: lastSun.toLocaleDateString('en-CA'),
    end: lastSat.toLocaleDateString('en-CA'),
  }
}

const TZ_DENVER = 'America/Denver'

/** YYYY-MM-DD in Denver for an instant (en-CA). */
export function denverCalendarDayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_DENVER,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

/** e.g. Mar 24 (no year). */
export function formatDenverCalendarDayShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_DENVER,
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms))
}

/** e.g. Mar 24, 2026 */
export function formatDenverCalendarDayWithYear(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_DENVER,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms))
}

/** Time only in Denver, e.g. 12:06 PM */
export function formatDenverTimeOnly(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_DENVER,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

/** Short datetime in Denver (segment crossing midnight). */
export function formatDenverDateTimeShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_DENVER,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

/**
 * Single Denver calendar day for block header, or range when block crosses midnight in Denver.
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

/** e.g. Monday (America/Denver). */
export function formatDenverWeekday(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_DENVER,
    weekday: 'long',
  }).format(new Date(ms))
}

function formatDenverWeekdayShort(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_DENVER,
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

/** Friendly label for work_date YYYY-MM-DD (calendar date as stored; matches Denver work_date). */
export function formatWorkDateYmdFriendly(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const y = m[1]
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12) return ymd
  return `${MONTH_SHORT[mo - 1]} ${d}, ${y}`
}

/** Representative instant on this Denver work_date (for weekday extraction). */
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

/** e.g. Monday Mar 30, 2026 (Denver weekday for work_date YYYY-MM-DD). */
export function formatWorkDateYmdWeekdayLongFriendly(ymd: string): string {
  const friendly = formatWorkDateYmdFriendly(ymd)
  const ms = denverMsForWorkDateYmd(ymd)
  if (ms == null) return friendly
  return `${formatDenverWeekday(ms)} ${friendly}`
}

/** Same Denver calendar day for both instants. */
export function denverSameCalendarDay(aMs: number, bMs: number): boolean {
  return denverCalendarDayKey(aMs) === denverCalendarDayKey(bMs)
}

export function formatDenverTimeRangeSameDay(aMs: number, bMs: number): string {
  return `${formatDenverTimeOnly(aMs)} – ${formatDenverTimeOnly(bMs)}`
}

const denverPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ_DENVER,
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
 * Denver local times that are exactly H:00:00 with t0Ms < ms < t1Ms (strict), for strip hour rulers.
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
