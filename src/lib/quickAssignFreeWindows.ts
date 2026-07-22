/**
 * Quick Assign (Dispatch Mode): pure free-window math. Minutes past midnight
 * throughout; blocks come from `job_schedule_blocks` time strings via
 * `timeInputToMinutesSafe`.
 */

export type MinuteInterval = { startMin: number; endMin: number }

/** Working day the ribbons + suggestions cover. */
export const QUICK_ASSIGN_DAY_START_MIN = 6 * 60
export const QUICK_ASSIGN_DAY_END_MIN = 18 * 60
/** Suggested windows shorter than this are noise. */
export const QUICK_ASSIGN_MIN_WINDOW_MIN = 30

/** Merge overlapping/touching busy intervals; drops empty/invalid ones. */
export function mergeBusyIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const valid = intervals
    .filter((i) => i.endMin > i.startMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: MinuteInterval[] = []
  for (const i of valid) {
    const last = out[out.length - 1]
    if (last && i.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, i.endMin)
    } else {
      out.push({ ...i })
    }
  }
  return out
}

/** Free gaps within [dayStart, dayEnd] around the merged busy intervals. */
export function freeGapsForDay(
  busy: MinuteInterval[],
  dayStartMin = QUICK_ASSIGN_DAY_START_MIN,
  dayEndMin = QUICK_ASSIGN_DAY_END_MIN,
): MinuteInterval[] {
  const merged = mergeBusyIntervals(busy)
  const gaps: MinuteInterval[] = []
  let cursor = dayStartMin
  for (const b of merged) {
    const s = Math.max(b.startMin, dayStartMin)
    const e = Math.min(b.endMin, dayEndMin)
    if (e <= dayStartMin || s >= dayEndMin) continue
    if (s > cursor) gaps.push({ startMin: cursor, endMin: s })
    cursor = Math.max(cursor, e)
  }
  if (cursor < dayEndMin) gaps.push({ startMin: cursor, endMin: dayEndMin })
  return gaps
}

/** Intersect several people's gap lists into windows where EVERYONE is free. */
export function intersectGapLists(gapLists: MinuteInterval[][]): MinuteInterval[] {
  if (gapLists.length === 0) return []
  let acc = gapLists[0] ?? []
  for (let i = 1; i < gapLists.length; i++) {
    const next: MinuteInterval[] = []
    for (const a of acc) {
      for (const b of gapLists[i] ?? []) {
        const s = Math.max(a.startMin, b.startMin)
        const e = Math.min(a.endMin, b.endMin)
        if (e > s) next.push({ startMin: s, endMin: e })
      }
    }
    acc = next
    if (acc.length === 0) break
  }
  return acc
}

/**
 * Ranked common free windows for the selected people: longest first, ties
 * earlier-first; windows shorter than `minLenMin` dropped; top `limit`.
 */
export function suggestCommonWindows(
  busyByPerson: MinuteInterval[][],
  opts: { dayStartMin?: number; dayEndMin?: number; minLenMin?: number; limit?: number } = {},
): MinuteInterval[] {
  const {
    dayStartMin = QUICK_ASSIGN_DAY_START_MIN,
    dayEndMin = QUICK_ASSIGN_DAY_END_MIN,
    minLenMin = QUICK_ASSIGN_MIN_WINDOW_MIN,
    limit = 3,
  } = opts
  const gapLists = busyByPerson.map((busy) => freeGapsForDay(busy, dayStartMin, dayEndMin))
  return intersectGapLists(gapLists)
    .filter((w) => w.endMin - w.startMin >= minLenMin)
    .sort((a, b) => b.endMin - b.startMin - (a.endMin - a.startMin) || a.startMin - b.startMin)
    .slice(0, limit)
}

/** True when [startMin, endMin) overlaps any of the person's busy intervals. */
export function windowOverlapsBusy(
  window: MinuteInterval,
  busy: MinuteInterval[],
): boolean {
  return mergeBusyIntervals(busy).some(
    (b) => Math.max(b.startMin, window.startMin) < Math.min(b.endMin, window.endMin),
  )
}

/** Left/width percentages for drawing an interval on a day ribbon. */
export function ribbonSpanPct(
  interval: MinuteInterval,
  dayStartMin = QUICK_ASSIGN_DAY_START_MIN,
  dayEndMin = QUICK_ASSIGN_DAY_END_MIN,
): { leftPct: number; widthPct: number } | null {
  const total = dayEndMin - dayStartMin
  const s = Math.max(interval.startMin, dayStartMin)
  const e = Math.min(interval.endMin, dayEndMin)
  if (e <= s || total <= 0) return null
  return {
    leftPct: ((s - dayStartMin) / total) * 100,
    widthPct: ((e - s) / total) * 100,
  }
}
