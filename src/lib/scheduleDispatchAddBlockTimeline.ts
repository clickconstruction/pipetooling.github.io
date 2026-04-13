import {
  JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES,
  scheduleBlockToRange,
  scheduleRangesOverlap,
  type MinuteRange,
} from './jobScheduleOverlap'
import { MIN_MIN, MAX_MIN, dispatchMinutesToHHmm } from './dispatchAddBlockTime'

export type AddBlockTimelineSegment = {
  blockId: string
  jobId: string
  label: string
  time_start: string
  time_end: string
  shared_block_group_id: string | null
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Effective interval for a segment (draft overrides base). */
export function effectiveSegmentRange(
  seg: AddBlockTimelineSegment,
  draft: { time_start: string; time_end: string } | undefined,
): MinuteRange {
  if (draft) {
    return scheduleBlockToRange(timeInputToPg(draft.time_start), timeInputToPg(draft.time_end))
  }
  return scheduleBlockToRange(timeInputToPg(seg.time_start), timeInputToPg(seg.time_end))
}

function timeInputToPg(t: string): string {
  const x = t.trim()
  if (/^\d{2}:\d{2}$/.test(x)) return `${x}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(x)) return x
  return `${x}:00`
}

/** Merge overlapping/adjacent occupied intervals (for gap math). */
export function mergeOccupiedIntervals(intervals: MinuteRange[]): MinuteRange[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin)
  const out: MinuteRange[] = []
  let cur = sorted[0]
  if (!cur) return []
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i]
    if (!n) continue
    if (n.startMin <= cur.endMin) {
      cur = { startMin: cur.startMin, endMin: Math.max(cur.endMin, n.endMin) }
    } else {
      out.push(cur)
      cur = n
    }
  }
  out.push(cur)
  return out
}

/** Disjoint occupied union inside [dayLo, dayHi] from segments + drafts. */
export function occupiedUnionFromSegments(
  segments: AddBlockTimelineSegment[],
  draftByBlockId: Record<string, { time_start: string; time_end: string }>,
  dayLo = MIN_MIN,
  dayHi = MAX_MIN,
): MinuteRange[] {
  const raw: MinuteRange[] = []
  for (const s of segments) {
    const r = effectiveSegmentRange(s, draftByBlockId[s.blockId])
    const startMin = clampInt(r.startMin, dayLo, dayHi)
    const endMin = clampInt(r.endMin, dayLo, dayHi)
    if (endMin > startMin) raw.push({ startMin, endMin })
  }
  return mergeOccupiedIntervals(raw)
}

/** Free gaps inside [dayLo, dayHi] after subtracting occupied union. */
export function gapsFromOccupied(occupied: MinuteRange[], dayLo = MIN_MIN, dayHi = MAX_MIN): MinuteRange[] {
  const merged = mergeOccupiedIntervals(occupied)
  const gaps: MinuteRange[] = []
  let x = dayLo
  for (const o of merged) {
    if (o.startMin > x) gaps.push({ startMin: x, endMin: o.startMin })
    x = Math.max(x, o.endMin)
  }
  if (dayHi > x) gaps.push({ startMin: x, endMin: dayHi })
  return gaps
}

/** Pick default start/end for a new block: first gap that fits `preferDurationMin`, else best effort. */
export function defaultNewBlockRangeInFirstGap(args: {
  segments: AddBlockTimelineSegment[]
  draftByBlockId: Record<string, { time_start: string; time_end: string }>
  preferDurationMin?: number
  dayLo?: number
  dayHi?: number
}): { startMin: number; endMin: number } | null {
  const {
    segments,
    draftByBlockId,
    preferDurationMin = 4 * 60,
    dayLo = MIN_MIN,
    dayHi = MAX_MIN,
  } = args
  const occ = occupiedUnionFromSegments(segments, draftByBlockId, dayLo, dayHi)
  const gaps = gapsFromOccupied(occ, dayLo, dayHi)
  const minDur = JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES

  for (const g of gaps) {
    if (g.endMin - g.startMin < minDur) continue
    const end = Math.min(g.startMin + preferDurationMin, g.endMin)
    const start = end - preferDurationMin
    if (start >= g.startMin && end - start >= minDur) {
      return { startMin: start, endMin: end }
    }
    if (g.endMin - g.startMin >= minDur) {
      return { startMin: g.startMin, endMin: Math.min(g.startMin + preferDurationMin, g.endMin) }
    }
  }
  return null
}

/**
 * Clamp a desired new-block range so it lies entirely in one gap and meets min duration.
 * Picks the gap that contains the midpoint of [desiredStart, desiredEnd], else the nearest gap by edge distance.
 */
export function clampNewBlockRangeToGaps(args: {
  desiredStartMin: number
  desiredEndMin: number
  gaps: MinuteRange[]
  minDurationMin?: number
}): { startMin: number; endMin: number } {
  const { desiredStartMin, desiredEndMin, gaps, minDurationMin = JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES } = args
  let dur = desiredEndMin - desiredStartMin
  if (dur < minDurationMin) dur = minDurationMin

  const pickGapForPoint = (p: number): MinuteRange | null => {
    let best: MinuteRange | null = null
    let bestDist = Infinity
    for (const g of gaps) {
      if (p >= g.startMin && p <= g.endMin) {
        return g
      }
      const d = p < g.startMin ? g.startMin - p : p - g.endMin
      if (d < bestDist) {
        bestDist = d
        best = g
      }
    }
    return best
  }

  const mid = (desiredStartMin + desiredEndMin) / 2
  const gap = pickGapForPoint(mid) ?? gaps[0]
  if (!gap) {
    return {
      startMin: clampInt(desiredStartMin, MIN_MIN, MAX_MIN - minDurationMin),
      endMin: clampInt(desiredStartMin + minDurationMin, MIN_MIN + minDurationMin, MAX_MIN),
    }
  }

  const maxDurInGap = gap.endMin - gap.startMin
  const useDur = clampInt(dur, minDurationMin, Math.max(minDurationMin, maxDurInGap))
  let start = clampInt(desiredStartMin, gap.startMin, gap.endMin - useDur)
  let end = start + useDur
  if (end > gap.endMin) {
    end = gap.endMin
    start = end - useDur
    start = clampInt(start, gap.startMin, gap.endMin - minDurationMin)
    end = start + useDur
  }
  if (end - start < minDurationMin) {
    start = gap.startMin
    end = Math.min(gap.endMin, start + minDurationMin)
  }
  return { startMin: start, endMin: end }
}

function intervalsOverlapOthers(candidate: MinuteRange, others: MinuteRange[]): boolean {
  for (const o of others) {
    if (scheduleRangesOverlap(candidate, o)) return true
  }
  return false
}

function siblingBlockIdsForDrag(segments: AddBlockTimelineSegment[], seedBlockId: string): string[] {
  const anchor = segments.find((s) => s.blockId === seedBlockId)
  if (!anchor) return [seedBlockId]
  const gid = anchor.shared_block_group_id
  if (!gid) return [seedBlockId]
  return segments.filter((s) => s.shared_block_group_id === gid && s.jobId === anchor.jobId).map((s) => s.blockId)
}

/**
 * Apply a drag delta (minutes) to one segment (or all linked siblings on the same person-day list).
 * Returns updated draft map, or `null` if the move is impossible (no change from last valid).
 */
export function applySegmentDragDelta(args: {
  segments: AddBlockTimelineSegment[]
  draftByBlockId: Record<string, { time_start: string; time_end: string }>
  seedBlockId: string
  deltaMin: number
  dayLo?: number
  dayHi?: number
}): Record<string, { time_start: string; time_end: string }> | null {
  const { segments, draftByBlockId, seedBlockId, deltaMin, dayLo = MIN_MIN, dayHi = MAX_MIN } = args
  if (deltaMin === 0) return draftByBlockId

  const movingIds = siblingBlockIdsForDrag(segments, seedBlockId)
  const movingSet = new Set(movingIds)

  const effRangeForId = (id: string): MinuteRange | null => {
    const seg = segments.find((s) => s.blockId === id)
    if (!seg) return null
    return effectiveSegmentRange(seg, draftByBlockId[id])
  }

  const anchorRange = effRangeForId(movingIds[0] ?? seedBlockId)
  if (!anchorRange) return null

  const dur = anchorRange.endMin - anchorRange.startMin
  if (dur < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) return null

  let newStart = anchorRange.startMin + deltaMin
  newStart = clampInt(newStart, dayLo, dayHi - dur)

  const others: MinuteRange[] = []
  for (const s of segments) {
    if (movingSet.has(s.blockId)) continue
    others.push(effectiveSegmentRange(s, draftByBlockId[s.blockId]))
  }

  const mergedOthers = mergeOccupiedIntervals(others)
  let tryStart = newStart
  const step = 5
  for (let k = 0; k < 500; k++) {
    const c: MinuteRange = { startMin: tryStart, endMin: tryStart + dur }
    if (!intervalsOverlapOthers(c, mergedOthers)) break
    if (deltaMin >= 0) tryStart -= step
    else tryStart += step
    if ((deltaMin >= 0 && tryStart <= anchorRange.startMin) || (deltaMin < 0 && tryStart >= anchorRange.startMin)) {
      return null
    }
    tryStart = clampInt(tryStart, dayLo, dayHi - dur)
  }
  newStart = tryStart

  const finalEnd = newStart + dur
  if (intervalsOverlapOthers({ startMin: newStart, endMin: finalEnd }, mergeOccupiedIntervals(others))) {
    return null
  }

  const startStr = dispatchMinutesToHHmm(newStart)
  const endStr = dispatchMinutesToHHmm(finalEnd)

  const next = { ...draftByBlockId }
  for (const id of movingIds) {
    next[id] = { time_start: startStr, time_end: endStr }
  }
  return next
}

/** Move segment(s) so the anchor leg starts at `desiredStartMin` (after overlap + day clamping). */
export function applySegmentMoveToAbsoluteStart(args: {
  segments: AddBlockTimelineSegment[]
  draftByBlockId: Record<string, { time_start: string; time_end: string }>
  seedBlockId: string
  desiredStartMin: number
  dayLo?: number
  dayHi?: number
}): Record<string, { time_start: string; time_end: string }> | null {
  const { segments, draftByBlockId, seedBlockId, desiredStartMin, dayLo, dayHi } = args
  const movingIds = siblingBlockIdsForDrag(segments, seedBlockId)
  const firstId = movingIds[0] ?? seedBlockId
  const seg0 = segments.find((s) => s.blockId === firstId)
  if (!seg0) return null
  const anchorRange = effectiveSegmentRange(seg0, draftByBlockId[firstId])
  const delta = desiredStartMin - anchorRange.startMin
  return applySegmentDragDelta({ segments, draftByBlockId, seedBlockId, deltaMin: delta, dayLo, dayHi })
}

/** Build virtual day rows for overlap checks (draft times patched in). */
export function virtualDayBlocksForOverlap(
  serverRows: Array<{ id: string; time_start: string; time_end: string }>,
  draftByBlockId: Record<string, { time_start: string; time_end: string }>,
): Array<{ id: string; time_start: string; time_end: string }> {
  return serverRows.map((r) => {
    const d = draftByBlockId[r.id]
    if (!d) return r
    return {
      id: r.id,
      time_start: timeInputToPg(d.time_start),
      time_end: timeInputToPg(d.time_end),
    }
  })
}
