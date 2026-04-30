/** Wall-clock helpers for schedule dispatch (matches send-scheduled-reminders 15‑minute rounding). */

/** YYYY-MM-DD civil date string for instant in zone (matches `en-CA` app patterns). */
export function calendarYmdForInstantInZone(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** Pure-calendar `YYYY-MM-DD` plus `deltaDays` (timezone-agnostic day math). Returns null when `ymd` invalid. */
export function addDaysToYmd(ymd: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const utcMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const shifted = utcMs + deltaDays * 86_400_000
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(shifted))
}

const WEEKDAY_SUN0: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** 0 = Sunday … 6 = Saturday, in given IANA timezone. */
export function weekdayIndexSun0InZone(timeZone: string, instant: Date): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(instant)
  const k = WEEKDAY_SUN0[short]
  return k ?? 0
}

/** Parsed schedule.time_local (HH:MM:SS) floored to 15‑minute buckets for comparison with "now". */
export function roundedQuarterHourWallTimeParts(
  timeZone: string,
  instant: Date,
): { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(instant)
  const hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = Number.parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const roundedMinute = Math.floor(minute / 15) * 15
  return { hour, minute: roundedMinute, second: 0 }
}

export function parsePgTimeLocalToParts(t: string): { hour: number; minute: number; second: number } {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})/.exec(t.trim())
  if (!m) return { hour: 0, minute: 0, second: 0 }
  return {
    hour: Number.parseInt(m[1]!, 10),
    minute: Number.parseInt(m[2]!, 10),
    second: Number.parseInt(m[3]!, 10),
  }
}

/** True when rounded wall-clock (15 min) equals schedule TIME (must be on quarter-hour; seconds 0). */
export function scheduleMatchesNowWallQuarter(
  timeLocalFromDb: string,
  zone: string,
  instant: Date,
): boolean {
  const nowRounded = roundedQuarterHourWallTimeParts(zone, instant)
  const stored = parsePgTimeLocalToParts(timeLocalFromDb)
  if (stored.minute % 15 !== 0 || stored.second !== 0) return false
  return nowRounded.hour === stored.hour && nowRounded.minute === stored.minute
}
