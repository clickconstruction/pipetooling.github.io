import { salaryPgTimeToHms, salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'

function zonedYmdFromUtcMs(utcMs: number, timeZone: string): string | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date(utcMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const y = get('year')
  const mo = get('month')
  const d = get('day')
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(mo) || !/^\d{2}$/.test(d)) return null
  return `${y}-${mo}-${d}`
}

function zonedHhMmFromUtcMs(utcMs: number, timeZone: string): string | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = formatter.formatToParts(new Date(utcMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const h = get('hour')
  const mi = get('minute')
  if (!/^\d{2}$/.test(h) || !/^\d{2}$/.test(mi)) return null
  return `${h}:${mi}`
}

/**
 * Human-readable block end from wall start + duration in `timeZone`, aligned to `anchorWorkDateYmd`.
 * Appends ` (+1 day)` when the end wall date is after the anchor civil date in that zone.
 */
export function formatSalaryBlockEndDisplay(params: {
  startHhMm: string
  durationMinutes: number
  timeZone: string
  anchorWorkDateYmd: string
}): string {
  const { startHhMm, durationMinutes, timeZone, anchorWorkDateYmd } = params
  const norm = startHhMm.trim()
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(anchorWorkDateYmd.trim())) return '—'
  const t = salaryPgTimeToHms(norm.length === 5 ? `${norm}:00` : norm)
  const startMs = salaryZonedWallClockToUtcMs(anchorWorkDateYmd, t.h, t.m, t.s, timeZone)
  if (startMs == null) return '—'
  const endMs = startMs + durationMinutes * 60 * 1000
  const endClock = zonedHhMmFromUtcMs(endMs, timeZone)
  const endYmd = zonedYmdFromUtcMs(endMs, timeZone)
  if (!endClock || !endYmd) return '—'
  const anchor = anchorWorkDateYmd.trim()
  const crosses = endYmd > anchor
  return crosses ? `${endClock} (+1 day)` : endClock
}
