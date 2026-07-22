/**
 * Reorder a person's schedule blocks within one day — "duration + gaps" rule.
 *
 * On the Dispatch Day tab a person's job order IS time order (blocks sort by
 * time_start; there is no position column), so putting job C before job B means
 * assigning new time windows. The rule that keeps the day's shape predictable:
 *
 *   - the first block keeps its original start time
 *   - every job keeps its own duration
 *   - the gaps BETWEEN consecutive blocks stay exactly where they were
 *     (gap i still separates the i-th and i+1-th block after reordering)
 *
 * Example: A 8:00–10:00, B 10:30–12:30, C 13:00–16:00 (30-min gaps), reordered
 * to A,C,B → A 8:00–10:00, C 10:30–13:30, B 14:00–16:00.
 *
 * Pure — no React, no supabase. Times are Postgres `time` strings ("HH:MM" or
 * "HH:MM:SS"); results are emitted as "HH:MM:SS".
 */

export type ReorderableBlock = {
  id: string
  time_start: string
  time_end: string
}

export type ReorderedTime = {
  id: string
  time_start: string
  time_end: string
}

export function scheduleTimeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

export function minutesToScheduleTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

/** Blocks in the order the day currently shows them (time_start ascending, id tiebreak for determinism). */
export function sortBlocksByDayOrder<T extends ReorderableBlock>(blocks: readonly T[]): T[] {
  return [...blocks].sort((a, b) => {
    const d = scheduleTimeToMinutes(a.time_start) - scheduleTimeToMinutes(b.time_start)
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })
}

/**
 * Compute new time windows for `blocks` so they appear in `newOrderedIds` order.
 *
 * Returns ONLY the blocks whose window changed (empty array = no-op reorder).
 * Throws if `newOrderedIds` is not a permutation of the block ids.
 */
export function reorderDayScheduleBlocks(
  blocks: readonly ReorderableBlock[],
  newOrderedIds: readonly string[],
): ReorderedTime[] {
  const current = sortBlocksByDayOrder(blocks)
  if (newOrderedIds.length !== current.length) {
    throw new Error('reorderDayScheduleBlocks: newOrderedIds must include every block exactly once')
  }
  const byId = new Map(current.map((b) => [b.id, b]))
  const seen = new Set<string>()
  for (const id of newOrderedIds) {
    if (!byId.has(id) || seen.has(id)) {
      throw new Error('reorderDayScheduleBlocks: newOrderedIds must be a permutation of the block ids')
    }
    seen.add(id)
  }
  if (current.length < 2) return []

  // The day's shape: original slot starts/gaps in current order.
  const starts = current.map((b) => scheduleTimeToMinutes(b.time_start))
  const ends = current.map((b) => scheduleTimeToMinutes(b.time_end))
  const gaps: number[] = []
  for (let i = 0; i + 1 < current.length; i++) {
    // Negative gaps (overlapping blocks) are preserved as 0 so the reorder
    // never manufactures an overlap that wasn't a deliberate choice.
    gaps.push(Math.max(0, starts[i + 1]! - ends[i]!))
  }

  const changed: ReorderedTime[] = []
  let cursor = starts[0]!
  newOrderedIds.forEach((id, position) => {
    const b = byId.get(id)!
    const duration = Math.max(0, scheduleTimeToMinutes(b.time_end) - scheduleTimeToMinutes(b.time_start))
    const newStart = cursor
    const newEnd = newStart + duration
    const newStartStr = minutesToScheduleTime(newStart)
    const newEndStr = minutesToScheduleTime(newEnd)
    const startChanged = scheduleTimeToMinutes(b.time_start) !== newStart
    const endChanged = scheduleTimeToMinutes(b.time_end) !== newEnd
    if (startChanged || endChanged) {
      changed.push({ id, time_start: newStartStr, time_end: newEndStr })
    }
    cursor = newEnd + (position < gaps.length ? gaps[position]! : 0)
  })
  return changed
}

/** Preview every block's resulting window (changed or not), in the new order — for the modal's live preview. */
export function previewReorderedDay(
  blocks: readonly ReorderableBlock[],
  newOrderedIds: readonly string[],
): ReorderedTime[] {
  const changed = new Map(reorderDayScheduleBlocks(blocks, newOrderedIds).map((c) => [c.id, c]))
  const byId = new Map(blocks.map((b) => [b.id, b]))
  return newOrderedIds.map((id) => {
    const c = changed.get(id)
    if (c) return c
    const b = byId.get(id)!
    return {
      id,
      time_start: minutesToScheduleTime(scheduleTimeToMinutes(b.time_start)),
      time_end: minutesToScheduleTime(scheduleTimeToMinutes(b.time_end)),
    }
  })
}
