/** Minimum duration for office-scheduled job blocks (matches dispatch slider step). */
export const JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES = 30

export function validateJobScheduleBlockMinuteRange(args: {
  startMin: number
  endMin: number
  minWallMin: number
  maxWallMin: number
}): string | null {
  const { startMin: sm, endMin: em, minWallMin, maxWallMin } = args
  if (em <= sm) return 'End time must be after start time.'
  if (sm < minWallMin || em > maxWallMin) {
    return 'Times must stay between 4:00 AM and 8:00 PM Central.'
  }
  if (em - sm < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) {
    return 'Blocks must be at least 30 minutes.'
  }
  return null
}

/** Minutes from midnight for PostgreSQL time string HH:MM or HH:MM:SS. */
export function scheduleTimeToMinutesFromMidnight(pgTime: string): number {
  const parts = pgTime.trim().split(':')
  const h = Number(parts[0] ?? '0')
  const m = Number(parts[1] ?? '0')
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

export type MinuteRange = { startMin: number; endMin: number }

export function scheduleRangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin
}

export function scheduleBlockToRange(timeStart: string, timeEnd: string): MinuteRange {
  return {
    startMin: scheduleTimeToMinutesFromMidnight(timeStart),
    endMin: scheduleTimeToMinutesFromMidnight(timeEnd),
  }
}

/** Returns true if any pair in `blocks` overlaps (same assignee/day caller enforces single-day list). */
export function scheduleHasInternalOverlap(
  blocks: Array<{ time_start: string; time_end: string; id?: string }>,
): boolean {
  const ranges = blocks.map((b) => scheduleBlockToRange(b.time_start, b.time_end))
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i]
      const b = ranges[j]
      if (!a || !b) continue
      if (scheduleRangesOverlap(a, b)) return true
    }
  }
  return false
}

/** New block overlaps any existing (same day, same person — caller filters). */
export function scheduleOverlapsAny(
  candidate: MinuteRange,
  existing: Array<{ time_start: string; time_end: string; id?: string }>,
  excludeIds?: string[],
): boolean {
  const skip = new Set(excludeIds?.filter(Boolean) ?? [])
  for (const row of existing) {
    if (row.id && skip.has(row.id)) continue
    const r = scheduleBlockToRange(row.time_start, row.time_end)
    if (scheduleRangesOverlap(candidate, r)) return true
  }
  return false
}
