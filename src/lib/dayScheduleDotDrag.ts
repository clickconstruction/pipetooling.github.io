import { MAX_MIN, MIN_MIN } from './dispatchAddBlockTime'
import { JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES } from './jobScheduleOverlap'

/**
 * Day-view boundary-dot drag logic (Schedule Dispatch / Quickfill Schedule).
 *
 * A person's schedule blocks get a draggable dot at every block edge; two
 * blocks that touch (A.end === B.start) share ONE dot that moves both edges.
 * All math is minutes-from-midnight. Snap step is 15 minutes, but block
 * duration must stay >= 30 minutes — that is a DB CHECK constraint
 * (`job_schedule_blocks_min_duration_30m`), as are the 04:00–20:00 bounds.
 */

export const DOT_DRAG_SNAP_MINUTES = 15

export type DotBlock = {
  blockId: string
  /** Minutes from midnight. */
  startMin: number
  endMin: number
}

export type BoundaryDot =
  | { kind: 'start'; blockId: string; min: number }
  | { kind: 'end'; blockId: string; min: number }
  | {
      kind: 'shared'
      /** Block ending at this dot. */
      beforeBlockId: string
      /** Block starting at this dot. */
      afterBlockId: string
      min: number
    }

/**
 * Dots for one person's day, from blocks sorted by start. Touching pairs
 * (A.end === B.start) collapse to one `shared` dot. Overlapping blocks (bad
 * data) never share a dot — each keeps its own edges.
 */
export function boundaryDotsFromBlocks(blocks: readonly DotBlock[]): BoundaryDot[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const dots: BoundaryDot[] = []
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]
    if (!b) continue
    const prev = sorted[i - 1]
    const sharedWithPrev = prev != null && prev.endMin === b.startMin
    if (!sharedWithPrev) {
      dots.push({ kind: 'start', blockId: b.blockId, min: b.startMin })
    }
    const next = sorted[i + 1]
    if (next != null && b.endMin === next.startMin) {
      dots.push({ kind: 'shared', beforeBlockId: b.blockId, afterBlockId: next.blockId, min: b.endMin })
    } else {
      dots.push({ kind: 'end', blockId: b.blockId, min: b.endMin })
    }
  }
  return dots
}

export function snapDotMinutes(min: number): number {
  return Math.round(min / DOT_DRAG_SNAP_MINUTES) * DOT_DRAG_SNAP_MINUTES
}

export type DotDragResult = {
  /** blockId → new [startMin, endMin]; only blocks that change are present. */
  updates: ReadonlyMap<string, { startMin: number; endMin: number }>
  /** Resolved dot position after snapping/clamping. */
  dotMin: number
}

/**
 * Resolve dragging `dot` to `targetMin` over the person's `blocks`.
 *
 * - Snaps to 15-minute steps; clamps to the 04:00–20:00 rail.
 * - Every affected block keeps `>= 30` minutes (DB constraint).
 * - A `start`/`end` dot clamps at the adjacent block's near edge: dragging
 *   onto it makes the times equal (the dots merge into a shared dot);
 *   dragging past it stops there — blocks never overlap.
 * - A `shared` dot moves BOTH edges together (blocks stay touching), clamped
 *   so each side keeps minimum duration.
 */
export function resolveDotDrag(
  dot: BoundaryDot,
  targetMin: number,
  blocks: readonly DotBlock[],
): DotDragResult {
  const byId = new Map(blocks.map((b) => [b.blockId, b]))
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const minDur = JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES
  let t = Math.max(MIN_MIN, Math.min(MAX_MIN, snapDotMinutes(targetMin)))
  const updates = new Map<string, { startMin: number; endMin: number }>()

  if (dot.kind === 'shared') {
    const a = byId.get(dot.beforeBlockId)
    const b = byId.get(dot.afterBlockId)
    if (!a || !b) return { updates, dotMin: dot.min }
    const lo = a.startMin + minDur
    const hi = b.endMin - minDur
    if (lo > hi) return { updates, dotMin: dot.min }
    t = Math.max(lo, Math.min(hi, t))
    if (t !== dot.min) {
      updates.set(a.blockId, { startMin: a.startMin, endMin: t })
      updates.set(b.blockId, { startMin: t, endMin: b.endMin })
    }
    return { updates, dotMin: t }
  }

  const block = byId.get(dot.blockId)
  if (!block) return { updates, dotMin: dot.min }
  const idx = sorted.findIndex((x) => x.blockId === block.blockId)

  if (dot.kind === 'start') {
    const prev = sorted[idx - 1]
    const lo = prev ? prev.endMin : MIN_MIN
    const hi = block.endMin - minDur
    if (lo > hi) return { updates, dotMin: dot.min }
    t = Math.max(lo, Math.min(hi, t))
    if (t !== block.startMin) updates.set(block.blockId, { startMin: t, endMin: block.endMin })
    return { updates, dotMin: t }
  }

  const next = sorted[idx + 1]
  const lo = block.startMin + minDur
  const hi = next ? next.startMin : MAX_MIN
  if (lo > hi) return { updates, dotMin: dot.min }
  t = Math.max(lo, Math.min(hi, t))
  if (t !== block.endMin) updates.set(block.blockId, { startMin: block.startMin, endMin: t })
  return { updates, dotMin: t }
}

/**
 * Click-and-hold on a shared dot: the LATER block jumps 15 minutes later
 * without extending its end (start += 15, end unchanged, duration shrinks).
 * Returns null when the later block would drop below the 30-minute minimum.
 */
export function separateSharedDot(
  dot: Extract<BoundaryDot, { kind: 'shared' }>,
  blocks: readonly DotBlock[],
): { blockId: string; startMin: number; endMin: number } | null {
  const after = blocks.find((b) => b.blockId === dot.afterBlockId)
  if (!after) return null
  const newStart = after.startMin + DOT_DRAG_SNAP_MINUTES
  if (after.endMin - newStart < JOB_SCHEDULE_BLOCK_MIN_DURATION_MINUTES) return null
  return { blockId: after.blockId, startMin: newStart, endMin: after.endMin }
}

/** `minutes` → `HH:MM:SS` for `job_schedule_blocks.time_*` writes. */
export function dotMinutesToPgTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}
