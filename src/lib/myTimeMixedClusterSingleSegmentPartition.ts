/**
 * Affine partition of one editor segment across N touching DB rows (mixed punch/salary metadata).
 *
 * **Salary sync caveat:** `salary_sync_one_user_clock_sessions` can rewrite or recreate
 * `salary_schedule` rows for a day; user-edited seams on salary-linked rows may be reverted
 * on the next sync. See `SALARY_CLOCK_SESSIONS.md` (cross-row merge note).
 */
import {
  CLUSTER_CONTIGUITY_EPS_MS,
  clusterReferenceBoundaries,
  MIN_SEGMENT_MS,
  segmentContainedInRow,
  sessionRowIntervalMs,
  type DayEditorSession,
} from './myTimeDayTimeline'

/** Max distance from an inner boundary to a reference row seam (ms) for grouping / snap. */
const INNER_SEAM_MATCH_SLACK_MS = 5 * 60 * 1000

/**
 * Snap inner boundaries to exact reference seam times (nearest eligible seam per slack).
 */
function snapInnerBoundariesToExactRefs(
  boundaries: readonly number[],
  refs: readonly number[],
  maxDist: number
): number[] | null {
  const out = [...boundaries]
  const internalR = refs.slice(1, -1)
  let lastRefIdx = -1
  for (let k = 1; k < out.length - 1; k++) {
    const b = out[k]!
    let bestJ = -1
    let bestD = Infinity
    for (let j = lastRefIdx + 1; j < internalR.length; j++) {
      const d = Math.abs(b - internalR[j]!)
      if (d < bestD) {
        bestD = d
        bestJ = j
      }
    }
    if (bestJ < 0 || bestD > maxDist) return null
    out[k] = internalR[bestJ]!
    lastRefIdx = bestJ
  }
  return out
}

/**
 * Map each inner editor boundary to an internal row seam index (into refs.slice(1,-1)).
 * Nearest seam after the previous match within {@link INNER_SEAM_MATCH_SLACK_MS}.
 */
function matchInnerBoundariesToRefSeams(boundaries: readonly number[], refs: readonly number[]): number[] | null {
  const internalB = boundaries.slice(1, -1)
  const internalR = refs.slice(1, -1)
  const seamIdx: number[] = []
  let lastRefIdx = -1
  for (const b of internalB) {
    let bestJ = -1
    let bestD = Infinity
    for (let j = lastRefIdx + 1; j < internalR.length; j++) {
      const d = Math.abs(b - internalR[j]!)
      if (d < bestD) {
        bestD = d
        bestJ = j
      }
    }
    if (bestJ < 0 || bestD > INNER_SEAM_MATCH_SLACK_MS) return null
    seamIdx.push(bestJ)
    lastRefIdx = bestJ
  }
  return seamIdx
}

export type PartitionedRowIntervalMs = {
  clockedInMs: number
  clockedOutMs: number | null
}

/**
 * Map **multiple** editor segments (full cluster hull) onto one interval per DB row when each
 * segment lies fully inside a single row. Respects internal boundaries (unlike affine single-segment).
 */
export function partitionMixedClusterEditorSegmentsToRowIntervals(
  c: DayEditorSession[],
  boundaries: readonly number[],
  nowMs: number
): PartitionedRowIntervalMs[] | null {
  const n = c.length
  const nSeg = boundaries.length - 1
  if (n < 2 || nSeg < 2) return null

  const first = c[0]!
  const last = c[n - 1]!
  const { lo: hullLo } = sessionRowIntervalMs(first, nowMs)
  const { hi: hullEnd } = sessionRowIntervalMs(last, nowMs)
  const eps = CLUSTER_CONTIGUITY_EPS_MS
  const openLast = !last.clocked_out_at

  if (Math.abs(boundaries[0]! - hullLo) > eps) return null
  if (Math.abs(boundaries[boundaries.length - 1]! - hullEnd) > eps) return null

  if (nSeg === n) {
    const out: PartitionedRowIntervalMs[] = []
    for (let r = 0; r < n; r++) {
      const startMs = boundaries[r]!
      const endMs = boundaries[r + 1]!
      const clockOut = r === n - 1 && openLast ? null : endMs
      if (clockOut != null) {
        if (endMs - startMs < MIN_SEGMENT_MS) return null
        if (endMs - startMs <= eps) return null
      } else {
        if (nowMs - startMs < MIN_SEGMENT_MS) return null
      }
      out.push({ clockedInMs: startMs, clockedOutMs: clockOut })
    }
    return out
  }

  /**
   * Fewer editor segments than DB rows (e.g. merged notes across rows): inner boundaries must sit on
   * reference row seams; each segment is affine-mapped across its contiguous row slice (not “prefix
   * rows1:1” — merging the first two segments makes the first visual span multiple rows).
   */
  if (nSeg < n) {
    const refs = clusterReferenceBoundaries(c, nowMs)
    if (refs.length !== n + 1) return null
    let seamIdx = matchInnerBoundariesToRefSeams(boundaries, refs)
    let effectiveBoundaries: readonly number[] = boundaries
    if (!seamIdx) {
      const snapped = snapInnerBoundariesToExactRefs(boundaries, refs, INNER_SEAM_MATCH_SLACK_MS)
      if (!snapped) return null
      effectiveBoundaries = snapped
      seamIdx = matchInnerBoundariesToRefSeams(snapped, refs)
      if (!seamIdx) return null
    }

    const out: PartitionedRowIntervalMs[] = []
    let rowStart = 0
    for (let s = 0; s < nSeg; s++) {
      const bLo = effectiveBoundaries[s]!
      const bHi = effectiveBoundaries[s + 1]!
      const rowEndInclusive = s < nSeg - 1 ? seamIdx[s]! : n - 1
      const slice = c.slice(rowStart, rowEndInclusive + 1)
      if (slice.length === 0) return null

      const isClusterLastRow = rowEndInclusive === n - 1
      const useOpenOut = isClusterLastRow && openLast

      if (slice.length === 1) {
        const clockOut = useOpenOut ? null : bHi
        if (clockOut != null) {
          if (bHi - bLo < MIN_SEGMENT_MS) return null
          if (bHi - bLo <= eps) return null
        } else {
          if (nowMs - bLo < MIN_SEGMENT_MS) return null
        }
        out.push({ clockedInMs: bLo, clockedOutMs: clockOut })
      } else {
        const pEnd = useOpenOut ? null : bHi
        let part = partitionMixedClusterSingleSegmentToRowIntervals(slice, bLo, pEnd, nowMs)
        if (!part && useOpenOut) {
          part = partitionMixedClusterSingleSegmentToRowIntervals(slice, bLo, pEnd, nowMs, {
            skipOpenTrailingMinCheck: true,
          })
        }
        if (!part) return null
        out.push(...part)
      }
      rowStart = rowEndInclusive + 1
    }
    if (rowStart !== n) return null
    if (out.length !== n) return null
    return out
  }

  const rowOfSeg: number[] = []
  for (let j = 0; j < nSeg; j++) {
    const segLo = boundaries[j]!
    const segHi = boundaries[j + 1]!
    if (segHi - segLo < MIN_SEGMENT_MS) return null
    let found = -1
    for (let r = 0; r < n; r++) {
      const { lo, hi } = sessionRowIntervalMs(c[r]!, nowMs)
      if (segmentContainedInRow(segLo, segHi, lo, hi, eps)) {
        if (found >= 0) return null
        found = r
      }
    }
    if (found < 0) return null
    rowOfSeg.push(found)
  }

  for (let j = 1; j < rowOfSeg.length; j++) {
    if (rowOfSeg[j]! < rowOfSeg[j - 1]!) return null
  }
  if (rowOfSeg[0] !== 0 || rowOfSeg[rowOfSeg.length - 1] !== n - 1) return null

  const out: PartitionedRowIntervalMs[] = []
  let j = 0
  for (let r = 0; r < n; r++) {
    if (j >= nSeg || rowOfSeg[j] !== r) return null
    const startMs = boundaries[j]!
    while (j + 1 < nSeg && rowOfSeg[j + 1] === r) {
      j++
    }
    const endMs = boundaries[j + 1]!
    const clockOut = r === n - 1 && openLast ? null : endMs
    if (clockOut != null) {
      if (endMs - startMs < MIN_SEGMENT_MS) return null
      if (endMs - startMs <= eps) return null
    } else {
      if (nowMs - startMs < MIN_SEGMENT_MS) return null
    }
    out.push({ clockedInMs: startMs, clockedOutMs: clockOut })
    j++
  }
  if (j !== nSeg) return null
  return out
}

/**
 * Map one visual segment [T_start, T_end] onto row-level intervals using reference seams
 * from `clusterReferenceBoundaries`. `T_endMs` null means the cluster's last row is still
 * open (use `nowMs` for scaling and for validating the last row's duration).
 */
export type PartitionMixedClusterSingleSegmentOpts = {
  /**
   * When the cluster's last row is still open, the affine map ends at `nowMs`; the last row slice
   * must be at least {@link MIN_SEGMENT_MS}. For **merge UI** intermediate steps only, skipping this
   * avoids blocking merges for ~36s after a punch while the hull is otherwise partitionable.
   * Persist / save paths must omit this flag (strict).
   */
  skipOpenTrailingMinCheck?: boolean
}

export function partitionMixedClusterSingleSegmentToRowIntervals(
  c: DayEditorSession[],
  T_startMs: number,
  T_endMs: number | null,
  nowMs: number,
  opts?: PartitionMixedClusterSingleSegmentOpts
): PartitionedRowIntervalMs[] | null {
  const n = c.length
  if (n < 2) return null

  const lastRow = c[n - 1]!
  const openLast = !lastRow.clocked_out_at
  if (T_endMs === null && !openLast) return null
  if (T_endMs !== null && openLast) return null

  const effectiveEnd = T_endMs === null ? nowMs : T_endMs

  const hullLo = sessionRowIntervalMs(c[0]!, nowMs).lo
  const hullHi = sessionRowIntervalMs(lastRow, nowMs).hi
  const eps = CLUSTER_CONTIGUITY_EPS_MS

  const denom = hullHi - hullLo
  if (denom <= eps) return null

  const numer = effectiveEnd - T_startMs
  if (numer <= eps) return null

  const refs = clusterReferenceBoundaries(c, nowMs)
  if (refs.length !== n + 1) return null

  const scale = numer / denom
  const joins: number[] = []
  for (let j = 0; j < n - 1; j++) {
    joins.push(T_startMs + (refs[j + 1]! - hullLo) * scale)
  }

  const lo0 = T_startMs
  if (joins.length > 0) {
    if (joins[0]! - lo0 < MIN_SEGMENT_MS) return null
    if (joins[0]! - lo0 <= eps) return null
  }

  for (let j = 0; j < joins.length - 1; j++) {
    const span = joins[j + 1]! - joins[j]!
    if (span < MIN_SEGMENT_MS) return null
    if (span <= eps) return null
  }

  if (n >= 2) {
    const lastJoin = joins[n - 2]!
    if (openLast) {
      if (!opts?.skipOpenTrailingMinCheck && nowMs - lastJoin < MIN_SEGMENT_MS) return null
    } else {
      if (effectiveEnd - lastJoin < MIN_SEGMENT_MS) return null
      if (effectiveEnd - lastJoin <= eps) return null
    }
  }

  const out: PartitionedRowIntervalMs[] = []
  out.push({ clockedInMs: lo0, clockedOutMs: joins[0]! })
  for (let i = 1; i < n - 1; i++) {
    out.push({ clockedInMs: joins[i - 1]!, clockedOutMs: joins[i]! })
  }
  out.push({
    clockedInMs: joins.length > 0 ? joins[joins.length - 1]! : lo0,
    clockedOutMs: openLast ? null : effectiveEnd,
  })

  return out
}
