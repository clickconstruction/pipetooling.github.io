import {
  JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES,
  scheduleTimeToMinutesFromMidnight,
} from './jobScheduleOverlap'

export const MIN_MIN = 4 * 60
export const MAX_MIN = 20 * 60

/** Preferred default window when adding a schedule block (8:00 AM–4:00 PM Central, dispatch grid). */
export const DISPATCH_DEFAULT_NEW_BLOCK_PREFERRED_START_MIN = 8 * 60
export const DISPATCH_DEFAULT_NEW_BLOCK_PREFERRED_DURATION_MIN = 8 * 60

const DISPATCH_ADD_BLOCK_SLOT_STEP = JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES
export const DISPATCH_ADD_BLOCK_SLOT_COUNT =
  (MAX_MIN - MIN_MIN) / DISPATCH_ADD_BLOCK_SLOT_STEP + 1

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function timeInputToPg(t: string): string {
  const x = t.trim()
  if (/^\d{2}:\d{2}$/.test(x)) return `${x}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(x)) return x
  return `${x}:00`
}

export function dispatchSlotIndexToMinutes(i: number): number {
  return (
    MIN_MIN + clampInt(i, 0, DISPATCH_ADD_BLOCK_SLOT_COUNT - 1) * DISPATCH_ADD_BLOCK_SLOT_STEP
  )
}

/** Nearest 30m slot for slider thumb; typed times off the grid may show a slightly different thumb until adjusted. */
export function dispatchMinutesToSlotIndex(m: number): number {
  const c = clampInt(m, MIN_MIN, MAX_MIN)
  return clampInt(
    Math.round((c - MIN_MIN) / DISPATCH_ADD_BLOCK_SLOT_STEP),
    0,
    DISPATCH_ADD_BLOCK_SLOT_COUNT - 1,
  )
}

export function dispatchMinutesToHHmm(m: number): string {
  const mm = clampInt(m, MIN_MIN, MAX_MIN)
  const h = Math.floor(mm / 60)
  const min = mm % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function timeInputToMinutesSafe(t: string): number {
  return scheduleTimeToMinutesFromMidnight(timeInputToPg(t))
}

export function clampDispatchStartEndForMinDuration(sMin: number, eMin: number): { s: number; e: number } {
  let s = sMin
  let e = eMin
  if (e <= s) {
    e = Math.min(s + JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MAX_MIN)
  }
  if (e - s < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
    const bumpEnd = Math.min(s + JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MAX_MIN)
    if (bumpEnd - s >= JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
      e = bumpEnd
    } else {
      s = Math.max(e - JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MIN_MIN)
    }
  }
  return { s, e }
}

export function clampDispatchEndStartForMinDuration(eMin: number, sMin: number): { s: number; e: number } {
  let s = sMin
  let e = eMin
  if (e <= s) {
    s = Math.max(e - JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MIN_MIN)
  }
  if (e - s < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
    const bumpStart = Math.max(e - JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MIN_MIN)
    if (e - bumpStart >= JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
      s = bumpStart
    } else {
      e = Math.min(s + JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES, MAX_MIN)
    }
  }
  return { s, e }
}

export function formatDispatchQuickTimeLabel(hhmm: string): string {
  const [hs, ms] = hhmm.split(':')
  const h = Number(hs ?? '0')
  const m = Number(ms ?? '0')
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function formatBlockDurationMinutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '—'
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h > 0) return `${h}h ${r}m`
  return `${r}m`
}

export function formatBlockDurationAriaLabel(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return 'Duration not available'
  const h = Math.floor(m / 60)
  const r = m % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (r > 0) parts.push(`${r} ${r === 1 ? 'minute' : 'minutes'}`)
  if (parts.length === 0) return 'Duration zero minutes'
  return `Duration ${parts.join(' ')}`
}
