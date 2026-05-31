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

function zonedHhMm24FromUtcMs(utcMs: number, timeZone: string): string | null {
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

function sessionAEndUtcMs(params: {
  segmentAStart: string
  segmentADurationMinutes: number
  timeZone: string
  anchorWorkDateYmd: string
}): number | null {
  const anchor = params.anchorWorkDateYmd.trim()
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(anchor)) return null
  const norm = params.segmentAStart.trim()
  const t = salaryPgTimeToHms(norm.length === 5 ? `${norm}:00` : norm)
  const startMs = salaryZonedWallClockToUtcMs(anchor, t.h, t.m, t.s, params.timeZone)
  if (startMs == null) return null
  return startMs + params.segmentADurationMinutes * 60 * 1000
}

/**
 * Minutes between first session end and second session start (wall times on anchor date).
 * Rounded to 15 minutes, clamped [0, 480]. Falls back to 30 if inputs are invalid or gap negative.
 */
export function breakMinutesBetweenAB(params: {
  segmentAStart: string
  segmentADurationMinutes: number
  segmentBStart: string
  timeZone: string
  anchorWorkDateYmd: string
}): number {
  const anchor = params.anchorWorkDateYmd.trim()
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(anchor)) return 30
  const aEndMs = sessionAEndUtcMs({
    segmentAStart: params.segmentAStart,
    segmentADurationMinutes: params.segmentADurationMinutes,
    timeZone: params.timeZone,
    anchorWorkDateYmd: anchor,
  })
  const bNorm = params.segmentBStart.trim()
  const tb = salaryPgTimeToHms(bNorm.length === 5 ? `${bNorm}:00` : bNorm)
  const bStartMs = salaryZonedWallClockToUtcMs(anchor, tb.h, tb.m, tb.s, params.timeZone)
  if (aEndMs == null || bStartMs == null) return 30
  const rawMin = Math.round((bStartMs - aEndMs) / 60000)
  if (rawMin < 0) return 30
  const rounded = Math.round(rawMin / 15) * 15
  return Math.min(480, Math.max(0, rounded))
}

/**
 * Second session local start HH:mm on anchor date from first session end + break.
 * Returns null if the result is not on the same civil date as `anchorWorkDateYmd` in `timeZone`.
 */
export function segmentBStartFromBreak(params: {
  segmentAStart: string
  segmentADurationMinutes: number
  breakMinutes: number
  timeZone: string
  anchorWorkDateYmd: string
}): string | null {
  const anchor = params.anchorWorkDateYmd.trim()
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(anchor)) return null
  const br = Math.round(params.breakMinutes / 15) * 15
  if (!Number.isFinite(br) || br < 0 || br > 480) return null
  const aEndMs = sessionAEndUtcMs({
    segmentAStart: params.segmentAStart,
    segmentADurationMinutes: params.segmentADurationMinutes,
    timeZone: params.timeZone,
    anchorWorkDateYmd: anchor,
  })
  if (aEndMs == null) return null
  const bStartMs = aEndMs + br * 60 * 1000
  const ymd = zonedYmdFromUtcMs(bStartMs, params.timeZone)
  if (ymd !== anchor) return null
  return zonedHhMm24FromUtcMs(bStartMs, params.timeZone)
}

/** Allowed break lengths (15 min steps) that keep second session start on the anchor work date. */
export function validSplitBreakMinutesForAnchor(params: {
  segmentAStart: string
  segmentADurationMinutes: number
  timeZone: string
  anchorWorkDateYmd: string
}): number[] {
  const anchor = params.anchorWorkDateYmd.trim()
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(anchor)) return []
  const aEndMs = sessionAEndUtcMs({
    segmentAStart: params.segmentAStart,
    segmentADurationMinutes: params.segmentADurationMinutes,
    timeZone: params.timeZone,
    anchorWorkDateYmd: anchor,
  })
  if (aEndMs == null) return []
  const out: number[] = []
  for (let b = 0; b <= 480; b += 15) {
    const ms = aEndMs + b * 60 * 1000
    if (zonedYmdFromUtcMs(ms, params.timeZone) !== anchor) continue
    const hhmm = zonedHhMm24FromUtcMs(ms, params.timeZone)
    if (hhmm != null) out.push(b)
  }
  return out
}

/** Nearest valid break in `opts` to `preferred` (for clamping after A changes). */
export function nearestValidSplitBreakMinute(preferred: number, opts: readonly number[]): number | null {
  if (opts.length === 0) return null
  let best = opts[0]!
  let bestDist = Math.abs(preferred - best)
  for (const o of opts) {
    const d = Math.abs(preferred - o)
    if (d < bestDist) {
      bestDist = d
      best = o
    }
  }
  return best
}
