/**
 * "It did not clock me in" (docs/recent-features/v2.4242.md, the worker's door): a person reports
 * a day the clock missed — the day, when they started and stopped, the job, what happened. It is
 * written as their own session, which the typed-hours ledger stamps as typed by them, and waits
 * for someone in the office to approve. This kernel is the form's rules; the modal only draws them.
 */
import { salaryZonedWallClockToUtcMs } from '../salaryZonedWallClock'
import { APP_CALENDAR_TZ, formatWorkDateYmdWeekdayShortFriendly, ymdAddDays, ymdDaysBetween } from '../../utils/dateUtils'

/** The longest day the form takes; anything longer is a conversation with the office. */
export const MISSED_CLOCK_IN_MAX_HOURS = 16
export const MISSED_CLOCK_IN_MIN_MINUTES = 5

export type MissedDayOption = { ymd: string; label: string }

/** The days a person may report: from the start of last week through today, newest first. */
export function missedDayOptions(rangeStartYmd: string, todayYmd: string): MissedDayOption[] {
  const span = ymdDaysBetween(rangeStartYmd, todayYmd)
  if (span == null || span < 0) return []
  const out: MissedDayOption[] = []
  for (let i = 0; i <= span; i++) {
    const ymd = ymdAddDays(todayYmd, -i)
    out.push({ ymd, label: i === 0 ? `Today · ${formatWorkDateYmdWeekdayShortFriendly(ymd)}` : formatWorkDateYmdWeekdayShortFriendly(ymd) })
  }
  return out
}

/** "10:00" / "21:30" → hour and minute; null for anything else. */
export function parseTimeInput(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return { h, m }
}

export type MissedSpan = { inMs: number; outMs: number; endsNextDay: boolean }

/**
 * The day and the two clock times, in the company's time zone, as instants. A stop time at or
 * before the start is read as the next day (a shift that ran past midnight).
 */
export function missedSpan(workDateYmd: string, inTime: string, outTime: string, timeZone: string = APP_CALENDAR_TZ): MissedSpan | null {
  const a = parseTimeInput(inTime)
  const b = parseTimeInput(outTime)
  if (!a || !b) return null
  const inMs = salaryZonedWallClockToUtcMs(workDateYmd, a.h, a.m, 0, timeZone)
  if (inMs == null) return null
  let outMs = salaryZonedWallClockToUtcMs(workDateYmd, b.h, b.m, 0, timeZone)
  let endsNextDay = false
  if (outMs != null && outMs <= inMs) {
    outMs = salaryZonedWallClockToUtcMs(ymdAddDays(workDateYmd, 1), b.h, b.m, 0, timeZone)
    endsNextDay = true
  }
  if (outMs == null) return null
  return { inMs, outMs, endsNextDay }
}

export function missedSpanHours(span: MissedSpan): number {
  return (span.outMs - span.inMs) / 3_600_000
}

export type ExistingInterval = { startMs: number; endMs: number | null }

/** Why the report cannot be sent, in the person's words; null when it can. */
export function missedClockInProblem(input: {
  span: MissedSpan | null
  reason: string
  nowMs: number
  existing: readonly ExistingInterval[]
}): string | null {
  const { span, reason, nowMs, existing } = input
  if (!span) return 'Enter the time you started and the time you stopped.'
  const hours = missedSpanHours(span)
  if (hours * 60 < MISSED_CLOCK_IN_MIN_MINUTES) return 'The stop time is the same as the start time.'
  if (hours > MISSED_CLOCK_IN_MAX_HOURS) return `That is more than ${MISSED_CLOCK_IN_MAX_HOURS} hours. Check the times, or call the office.`
  if (span.outMs > nowMs) return 'The stop time has not happened yet. If you are still working, clock in instead.'
  const clash = existing.find((e) => span.inMs < (e.endMs ?? nowMs) && span.outMs > e.startMs)
  if (clash) return 'You already have clocked time inside those hours. Report only the part the clock missed.'
  if (reason.trim().length < 3) return 'Say what happened — the office reads this before approving.'
  return null
}

/** The note the office reads on the row. */
export function missedClockInNotes(reason: string): string {
  return `Clock missed it — ${reason.trim()}`
}
