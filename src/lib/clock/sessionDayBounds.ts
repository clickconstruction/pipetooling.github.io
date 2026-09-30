/**
 * Which days a clock session may be typed onto (v2.4271). The Add / Edit clock session modal
 * draws these; the database holds the same floor (`clock_sessions_window_fence`).
 *
 * - An assistant is limited to her hours window (`assistantHoursWindowFloorYmd`) — the floor.
 * - Nobody types the future — today is the ceiling.
 * - A door that is about one day (a day audit, a Team board cell) locks the day.
 *
 * Days are company-calendar `YYYY-MM-DD` strings.
 */
import { formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'

export type SessionDayBounds = {
  /** Earliest allowed day, or null for no floor. */
  minYmd: string | null
  /** Latest allowed day (today, or the locked day). */
  maxYmd: string
  /** The one day allowed, when the door is about a day. */
  lockedYmd: string | null
}

export function sessionDayBounds(input: { floorYmd: string | null; todayYmd: string; lockedYmd?: string | null }): SessionDayBounds {
  const locked = input.lockedYmd ?? null
  if (locked) return { minYmd: locked, maxYmd: locked, lockedYmd: locked }
  return { minYmd: input.floorYmd, maxYmd: input.todayYmd, lockedYmd: null }
}

/** "Fri, Sep 25" — how the modal names a day. */
export function sessionDayWords(ymd: string): string {
  return formatWorkDateYmdWeekdayShortFriendly(ymd)
}

/** The line under the day: what days the person can pick and who to ask for the rest. */
export function sessionDayNote(bounds: SessionDayBounds): string {
  if (bounds.lockedYmd) return `This session goes on ${sessionDayWords(bounds.lockedYmd)}.`
  if (bounds.minYmd == null) return 'Any day through today.'
  if (bounds.minYmd >= bounds.maxYmd) return 'Today only. Ask the owner for earlier days.'
  return `${sessionDayWords(bounds.minYmd)} through today. Ask the owner for earlier days.`
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** Why the day cannot be saved, in the person's words; null when it can. */
export function sessionDayProblem(ymd: string, bounds: SessionDayBounds): string | null {
  if (!YMD_RE.test(ymd)) return 'Pick a day.'
  if (bounds.lockedYmd && ymd !== bounds.lockedYmd) return `This session goes on ${sessionDayWords(bounds.lockedYmd)}.`
  if (bounds.minYmd != null && ymd < bounds.minYmd) {
    return `${sessionDayWords(bounds.minYmd)} is the earliest day in your hours window. Ask the owner for earlier days.`
  }
  if (ymd > bounds.maxYmd) return 'That day has not happened yet.'
  return null
}

/** A day inside the bounds, nearest to the one given. */
export function clampYmdToBounds(ymd: string, bounds: SessionDayBounds): string {
  if (bounds.lockedYmd) return bounds.lockedYmd
  if (bounds.minYmd != null && ymd < bounds.minYmd) return bounds.minYmd
  if (ymd > bounds.maxYmd) return bounds.maxYmd
  return ymd
}

/** `min` / `max` for a `<input type="date">`. */
export function dateInputBounds(bounds: SessionDayBounds): { min: string | undefined; max: string } {
  return { min: bounds.minYmd ?? undefined, max: bounds.maxYmd }
}

/** `min` / `max` for a `<input type="datetime-local">` — the whole first and last day. */
export function datetimeLocalBounds(bounds: SessionDayBounds): { min: string | undefined; max: string } {
  return { min: bounds.minYmd ? `${bounds.minYmd}T00:00` : undefined, max: `${bounds.maxYmd}T23:59` }
}
