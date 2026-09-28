/**
 * Save-gate kernels of the My Time day editor (DashboardMyTimeDayEditorModal): what one cluster's
 * split state turns into on Save, and whether the day can be saved at all. Pure — the persist
 * ladder that consumes the payloads stays in the modal (MY_TIME_DAY_EDITOR_MODAL map, "The save engine").
 */
import {
  coalescedMixedClusterPartitionForSave,
  mixedClusterSegmentsAllowPerRowPersist,
} from './myTimeDaySavePlan'
import {
  CLUSTER_CONTIGUITY_EPS_MS,
  clusterSharesClockSessionClusterRpcMetadata,
  MIN_SEGMENT_MS,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'
import { partitionMixedClusterSingleSegmentToRowIntervals } from './myTimeMixedClusterSingleSegmentPartition'
import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'

/**
 * One payload per editor segment, or `null` when any segment has a blank note or is shorter than
 * `MIN_SEGMENT_MS`. `session` is the cluster's last row: when it is still open, the last segment
 * saves with `clocked_out_at: null` and is measured against `nowMs` instead of its end boundary.
 */
export function buildPayloads(
  session: DayEditorSession,
  split: SplitEditorState,
  nowMs: number
): SplitClockSegmentPayload[] | null {
  const { boundaries, notes } = split
  if (boundaries.length < 2) return null
  const nSeg = boundaries.length - 1
  const payloads: SplitClockSegmentPayload[] = []
  for (let i = 0; i < nSeg; i++) {
    const a = boundaries[i]!
    const b = boundaries[i + 1]!
    const isLast = i === nSeg - 1
    const openLast = !session.clocked_out_at && isLast
    if (!notes[i]?.trim()) return null
    if (!openLast && b - a < MIN_SEGMENT_MS) return null
    if (openLast && nowMs - a < MIN_SEGMENT_MS) return null
    payloads.push({
      clocked_in_at: new Date(a).toISOString(),
      clocked_out_at: openLast ? null : new Date(b).toISOString(),
      notes: notes[i]!.trim(),
    })
  }
  return payloads
}

/** Single-segment save uses UPDATE only when times still match the DB row (note-only v1). */
export function singleSegmentTimesMatchSession(session: DayEditorSession, split: SplitEditorState): boolean {
  if (split.boundaries.length !== 2) return false
  const a = split.boundaries[0]!
  const b = split.boundaries[1]!
  const inMs = new Date(session.clocked_in_at).getTime()
  const eps = CLUSTER_CONTIGUITY_EPS_MS
  if (Math.abs(a - inMs) > eps) return false
  if (session.clocked_out_at) {
    const outMs = new Date(session.clocked_out_at).getTime()
    return Math.abs(b - outMs) <= eps
  }
  return true
}

/** The `split_*_segments` / `split_*_cluster` RPCs take times and notes only — job/bid stays on the row. */
export function stripJobBidForSegmentRpc(p: SplitClockSegmentPayload): SplitClockSegmentPayload {
  return {
    clocked_in_at: p.clocked_in_at,
    clocked_out_at: p.clocked_out_at,
    notes: p.notes,
  }
}

/**
 * Whether one cluster can produce a save: valid payloads, and for a mixed cluster without shared
 * RPC metadata, a per-row partition the persist ladder can write (branches 4, 7 and 8).
 */
export function dayEditorClusterCanSave(
  c: DayEditorSession[],
  split: SplitEditorState,
  nowMs: number
): boolean {
  const last = c[c.length - 1]!
  if (buildPayloads(last, split, nowMs) === null) return false
  if (
    c.length > 1 &&
    !clusterSharesClockSessionClusterRpcMetadata(c) &&
    split.boundaries.length === 2
  ) {
    const openLast = !last.clocked_out_at
    const pEnd = openLast ? null : split.boundaries[1]!
    if (
      partitionMixedClusterSingleSegmentToRowIntervals(c, split.boundaries[0]!, pEnd, nowMs) ===
      null
    ) {
      return false
    }
  }
  if (
    c.length > 1 &&
    !clusterSharesClockSessionClusterRpcMetadata(c) &&
    split.boundaries.length > 2 &&
    !mixedClusterSegmentsAllowPerRowPersist(c, split, nowMs)
  ) {
    const nSeg = split.boundaries.length - 1
    if (
      coalescedMixedClusterPartitionForSave(c, split, split.notes.slice(0, nSeg), nowMs) === null
    ) {
      return false
    }
  }
  return true
}
