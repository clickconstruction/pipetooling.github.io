import { supabase } from './supabase'
import {
  attachAllocationsToPayloads,
  mixedClusterSegmentsAllowPerRowPersist,
  myTimeClusterPersistRpcMetadataUserMessage,
} from './myTimeDaySavePlan'
import {
  clusterIsHomogeneousJobBid,
  clusterSharesClockSessionClusterRpcMetadata,
  everySegmentAssignablePerRowOrdered,
  segmentContainedInRow,
  sessionRowIntervalMs,
  CLUSTER_CONTIGUITY_EPS_MS,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'
import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'
import { DatabaseError, withSupabaseRetry } from '../utils/errorHandling'

function stripJobBidForSegmentRpc(p: SplitClockSegmentPayload): SplitClockSegmentPayload {
  return {
    clocked_in_at: p.clocked_in_at,
    clocked_out_at: p.clocked_out_at,
    notes: p.notes,
  }
}

export type MyTimeClusterPersistRpcsForAssign = {
  runSplitSeg: (sessionId: string, segments: SplitClockSegmentPayload[]) => Promise<string[]>
  runSplitCluster: (sessionIds: string[], segments: SplitClockSegmentPayload[]) => Promise<string[]>
  runReplaceMixed: (sessionIds: string[], segments: SplitClockSegmentPayload[]) => Promise<string[]>
}

/**
 * Runs the same multi-segment persistence as Dashboard My Time Save for one cluster, and returns
 * `clock_sessions.id` for each editor segment index (0 .. n-1) after RPCs complete.
 */
export async function persistMyTimeClusterAndGetSegmentIds(
  c: DayEditorSession[],
  split: SplitEditorState,
  payloads: SplitClockSegmentPayload[],
  nowTick: number,
  rpcs: MyTimeClusterPersistRpcsForAssign
): Promise<string[]> {
  const n = payloads.length
  if (n < 2) {
    throw new DatabaseError('persistMyTimeClusterAndGetSegmentIds expects at least two segments')
  }

  if (c.length === 1) {
    const ids = await rpcs.runSplitSeg(c[0]!.id, payloads.map(stripJobBidForSegmentRpc))
    if (ids.length !== n) {
      throw new DatabaseError('Split did not return one id per segment')
    }
    return ids
  }

  if (clusterIsHomogeneousJobBid(c) && clusterSharesClockSessionClusterRpcMetadata(c)) {
    const ids = await rpcs.runSplitCluster(
      c.map((s) => s.id),
      payloads.map(stripJobBidForSegmentRpc)
    )
    if (ids.length !== n) {
      throw new DatabaseError('Cluster split did not return one id per segment')
    }
    return ids
  }

  if (mixedClusterSegmentsAllowPerRowPersist(c, split, nowTick)) {
    const segmentIds: (string | undefined)[] = new Array(n)
    const useOrderedRowSegment =
      everySegmentAssignablePerRowOrdered(c, split, nowTick) && n === c.length
    if (useOrderedRowSegment) {
      for (let rowIdx = 0; rowIdx < c.length; rowIdx++) {
        const row = c[rowIdx]!
        const p0 = payloads[rowIdx]!
        const segI = rowIdx
        const pIn = new Date(p0.clocked_in_at).getTime()
        const pOut = p0.clocked_out_at ? new Date(p0.clocked_out_at).getTime() : nowTick
        const rowIn = new Date(row.clocked_in_at).getTime()
        const rowOut = row.clocked_out_at ? new Date(row.clocked_out_at).getTime() : nowTick
        const eps = CLUSTER_CONTIGUITY_EPS_MS
        const timesMatch =
          Math.abs(pIn - rowIn) <= eps &&
          ((!row.clocked_out_at && !p0.clocked_out_at) ||
            (row.clocked_out_at &&
              p0.clocked_out_at &&
              Math.abs(pOut - rowOut) <= eps))
        if (timesMatch) {
          await withSupabaseRetry(
            async () => supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
            'update clock session notes assign-prep'
          )
        } else {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .update({
                  clocked_in_at: p0.clocked_in_at,
                  clocked_out_at: p0.clocked_out_at,
                  notes: p0.notes,
                })
                .eq('id', row.id),
            'update clock session times assign-prep'
          )
        }
        segmentIds[segI] = row.id
      }
    } else {
      for (const row of c) {
        const { lo, hi } = sessionRowIntervalMs(row, nowTick)
        const rowSegIndices: number[] = []
        const rowPayloads: SplitClockSegmentPayload[] = []
        for (let i = 0; i < n; i++) {
          const a = split.boundaries[i]!
          const b = split.boundaries[i + 1]!
          if (segmentContainedInRow(a, b, lo, hi)) {
            rowSegIndices.push(i)
            rowPayloads.push(payloads[i]!)
          }
        }
        if (rowPayloads.length === 0) continue

        if (rowPayloads.length === 1) {
          const p0 = rowPayloads[0]!
          const segI = rowSegIndices[0]!
          const pIn = new Date(p0.clocked_in_at).getTime()
          const pOut = p0.clocked_out_at ? new Date(p0.clocked_out_at).getTime() : nowTick
          const rowIn = new Date(row.clocked_in_at).getTime()
          const rowOut = row.clocked_out_at ? new Date(row.clocked_out_at).getTime() : nowTick
          const eps = CLUSTER_CONTIGUITY_EPS_MS
          const timesMatch =
            Math.abs(pIn - rowIn) <= eps &&
            ((!row.clocked_out_at && !p0.clocked_out_at) ||
              (row.clocked_out_at &&
                p0.clocked_out_at &&
                Math.abs(pOut - rowOut) <= eps))
          if (timesMatch) {
            await withSupabaseRetry(
              async () => supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
              'update clock session notes assign-prep'
            )
          } else {
            await withSupabaseRetry(
              async () =>
                supabase
                  .from('clock_sessions')
                  .update({
                    clocked_in_at: p0.clocked_in_at,
                    clocked_out_at: p0.clocked_out_at,
                    notes: p0.notes,
                  })
                  .eq('id', row.id),
              'update clock session times assign-prep'
            )
          }
          segmentIds[segI] = row.id
        } else {
          const newIds = await rpcs.runSplitSeg(row.id, rowPayloads.map(stripJobBidForSegmentRpc))
          if (newIds.length !== rowSegIndices.length) {
            throw new DatabaseError('Row split did not return one id per sub-segment')
          }
          for (let j = 0; j < newIds.length; j++) {
            segmentIds[rowSegIndices[j]!] = newIds[j]!
          }
        }
      }
    }
    if (segmentIds.some((x) => x == null)) {
      throw new DatabaseError('Could not resolve all segment ids after persist')
    }
    return segmentIds as string[]
  }

  if (!clusterSharesClockSessionClusterRpcMetadata(c)) {
    throw new DatabaseError(myTimeClusterPersistRpcMetadataUserMessage(c))
  }
  const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
  const ids = await rpcs.runReplaceMixed(
    c.map((s) => s.id),
    mixed
  )
  if (ids.length !== n) {
    throw new DatabaseError('Replace mixed did not return one id per segment')
  }
  return ids
}
