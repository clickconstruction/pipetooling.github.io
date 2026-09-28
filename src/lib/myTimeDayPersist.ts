/**
 * The My Time day editor's save: what each dirty cluster writes to `clock_sessions`. PAYROLL PATH.
 *
 * Moved word for word out of DashboardMyTimeDayEditorModal (`persistDirtyChangesAsync`). The order
 * of the branches is the behavior, and every `DatabaseError` message is copy the user reads —
 * MY_TIME_DAY_EDITOR_MODAL map, "The save engine" and quirk 8. Change neither without a test
 * that says why.
 *
 * `persistMyTimeClusterAndGetSegmentIds` (persistMyTimeClusterForSegmentAssign.ts) is a near-copy
 * of the multi-payload branches for the assign flow. It has no draft guard and no coalesced
 * branch; do not swap one for the other without a parity test.
 */
import {
  leaderReplaceClockSessionClusterMixed,
  leaderSplitClockSessionCluster,
  leaderSplitClockSessionSegments,
} from './leaderClockSessionSplit'
import { buildPayloads, singleSegmentTimesMatchSession, stripJobBidForSegmentRpc } from './myTimeDayEditorPayloads'
import {
  attachAllocationsToPayloads,
  coalescedMixedClusterPartitionForSave,
  mixedClusterSegmentsAllowPerRowPersist,
  orderedSegmentsFollowTheirRows,
  myTimeClusterPersistRpcMetadataUserMessage,
  segmentsAreTheRowsUnchanged,
} from './myTimeDaySavePlan'
import {
  CLUSTER_CONTIGUITY_EPS_MS,
  clusterIsHomogeneousJobBid,
  clusterSharesClockSessionClusterRpcMetadata,
  segmentContainedInRow,
  sessionClusterId,
  sessionRowIntervalMs,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'
import { partitionMixedClusterSingleSegmentToRowIntervals } from './myTimeMixedClusterSingleSegmentPartition'
import { isDraftPeopleHoursSessionId } from './peopleHoursManualDraftSession'
import {
  replaceOwnClockSessionClusterMixed,
  splitOwnClockSessionCluster,
  splitOwnClockSessionSegments,
  type SplitClockSegmentPayload,
} from './splitOwnClockSessionSegments'
import { supabase } from './supabase'
import { formatDenverBlockDateHeader, formatDenverTimeOnly } from '../utils/dateUtils'
import { DatabaseError, withSupabaseRetry } from '../utils/errorHandling'

/** The toast after a save that re-cut rows of a salaried workday. */
export const MY_TIME_SALARY_SYNC_SAVED_NOTE =
  'Saved. Rows tied to the salaried workday template may be adjusted when salary sync runs.'

/** A new session in a block that was split or merged before its first save. */
export const MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE =
  'A new session can’t be split or merged with the session beside it before it is saved. Undo that change and Save, then edit again.'

/** A new (draft) session's first save: an INSERT with the part's times and the row's job and bid. */
async function insertDraftClockSession(
  row: DayEditorSession,
  p0: SplitClockSegmentPayload,
  effectiveSubjectUserId: string | null | undefined,
  dateStr: string
): Promise<void> {
  if (!p0.clocked_out_at) {
    throw new DatabaseError('Draft session must be clocked out before saving.')
  }
  if (!effectiveSubjectUserId) {
    throw new DatabaseError('Missing subject user for new clock session.')
  }
  await withSupabaseRetry(
    async () =>
      supabase.from('clock_sessions').insert({
        user_id: effectiveSubjectUserId,
        work_date: dateStr,
        clocked_in_at: p0.clocked_in_at,
        clocked_out_at: p0.clocked_out_at,
        notes: p0.notes,
        job_ledger_id: row.job_ledger_id,
        bid_id: row.bid_id,
      }),
    'insert draft clock session from people hours',
  )
}

/** The three split / replace RPCs a save may call. What they return is not read here. */
export type MyTimeDayPersistRpcs = {
  runSplitSeg: (sessionId: string, segments: SplitClockSegmentPayload[]) => Promise<unknown>
  runSplitCluster: (sessionIds: string[], segments: SplitClockSegmentPayload[]) => Promise<unknown>
  runReplaceMixed: (sessionIds: string[], segments: SplitClockSegmentPayload[]) => Promise<unknown>
}

/**
 * Your own day uses the `own_*` RPCs, which the server holds to the current week. Anyone else's
 * day, and your own once the week fence is overridden (Draft Payroll), uses the `leader_*` RPCs.
 */
export function myTimeDayPersistRpcs(editingSelf: boolean, fenceOverridden: boolean): MyTimeDayPersistRpcs {
  // Overridden fence (Draft Payroll origin): always the leader RPCs — own_* stay week-fenced.
  const runSplitSeg = editingSelf && !fenceOverridden ? splitOwnClockSessionSegments : leaderSplitClockSessionSegments
  const runSplitCluster = editingSelf && !fenceOverridden ? splitOwnClockSessionCluster : leaderSplitClockSessionCluster
  const runReplaceMixed = editingSelf && !fenceOverridden ? replaceOwnClockSessionClusterMixed : leaderReplaceClockSessionClusterMixed
  return { runSplitSeg, runSplitCluster, runReplaceMixed }
}

export type PersistMyTimeDayInput = {
  /** Cluster ids to write, in order (the editor's `effectiveDirtyIds`). */
  dirty: string[]
  sessionClusters: DayEditorSession[][]
  splitByCluster: Record<string, SplitEditorState>
  nowTick: number
  effectiveSubjectUserId: string | null | undefined
  dateStr: string
  /** People → Hours grid seed: a single untouched row saves its times, not only its note. */
  peopleHoursGridProportionalSeed: boolean
  rpcs: MyTimeDayPersistRpcs
}

/**
 * Writes every dirty cluster, one after another, and stops at the first failure — clusters
 * already written stay written. Throws `DatabaseError` with the message the editor shows.
 * `salarySyncMayAdjust` is true when rows of a salaried workday were re-cut.
 */
export async function persistMyTimeDayDirtyClusters({
  dirty,
  sessionClusters,
  splitByCluster,
  nowTick,
  effectiveSubjectUserId,
  dateStr,
  peopleHoursGridProportionalSeed,
  rpcs,
}: PersistMyTimeDayInput): Promise<{ salarySyncMayAdjust: boolean }> {
  const { runSplitSeg, runSplitCluster, runReplaceMixed } = rpcs
  let showSalarySyncAfterPartitionSave = false
  /** An approved row whose times a direct UPDATE changed: payroll hours are resynced once, at the end. */
  let approvedRowTimesChangedId: string | null = null
  for (const clusterId of dirty) {
    const c = sessionClusters.find((x) => sessionClusterId(x) === clusterId)
    if (!c?.length) continue
    const last = c[c.length - 1]!
    const split = splitByCluster[clusterId]
    if (!split) continue
    const payloads = buildPayloads(last, split, nowTick)
    if (!payloads) {
      const first = c[0]!
      throw new DatabaseError(
        `Block ${formatDenverBlockDateHeader(new Date(first.clocked_in_at).getTime(), new Date(last.clocked_out_at || nowTick).getTime())} (${formatDenverTimeOnly(new Date(first.clocked_in_at).getTime())} – ${formatDenverTimeOnly(new Date(last.clocked_out_at || nowTick).getTime())}): add notes and ensure at least 0.01 hours per part.`
      )
    }
    if (c.length > 1 && c.some((s) => isDraftPeopleHoursSessionId(s.id))) {
      // A new session that ends where a saved one starts (or starts where one ends) joins its
      // block. Left as they are, each row saves on its own: the new one is inserted, the saved
      // ones get their notes. Split or merged, the new session has no id to hand an RPC.
      if (!segmentsAreTheRowsUnchanged(c, split, nowTick)) {
        throw new DatabaseError(MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE)
      }
      for (let i = 0; i < c.length; i++) {
        const row = c[i]!
        const p0 = payloads[i]!
        if (isDraftPeopleHoursSessionId(row.id)) {
          await insertDraftClockSession(row, p0, effectiveSubjectUserId, dateStr)
        } else {
          await withSupabaseRetry(
            async () => supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
            'update clock session notes'
          )
        }
      }
      continue
    }
    if (c.some((s) => isDraftPeopleHoursSessionId(s.id)) && payloads.length > 1) {
      throw new DatabaseError(
        'Splitting a draft session before its first save is not supported yet. Save once, then edit splits.',
      )
    }
    if (payloads.length === 1) {
      if (c.length === 1) {
        const row = c[0]!
        if (isDraftPeopleHoursSessionId(row.id)) {
          await insertDraftClockSession(row, payloads[0]!, effectiveSubjectUserId, dateStr)
        } else if (!singleSegmentTimesMatchSession(row, split)) {
          throw new DatabaseError(
            'To change clock times for one block, add a split first (tap the gray strip) or edit in People → Hours.'
          )
        } else if (peopleHoursGridProportionalSeed) {
          const p0 = payloads[0]!
          await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .update({
                  clocked_in_at: p0.clocked_in_at,
                  clocked_out_at: p0.clocked_out_at,
                  work_date: row.work_date,
                  notes: p0.notes,
                  job_ledger_id: row.job_ledger_id,
                  bid_id: row.bid_id,
                })
                .eq('id', row.id),
            'update clock session times from people hours proportional seed',
          )
          if (row.approved_at) approvedRowTimesChangedId = row.id
        } else {
          await withSupabaseRetry(
            async () => supabase.from('clock_sessions').update({ notes: payloads[0]!.notes }).eq('id', row.id),
            'update clock session notes'
          )
        }
      } else if (!clusterSharesClockSessionClusterRpcMetadata(c)) {
        // Punch and salary rows merged into one part: each row takes its share of the part's span.
        const p0 = payloads[0]!
        const pIn = new Date(p0.clocked_in_at).getTime()
        const pOut = p0.clocked_out_at ? new Date(p0.clocked_out_at).getTime() : null
        const intervals = partitionMixedClusterSingleSegmentToRowIntervals(c, pIn, pOut, nowTick)
        if (!intervals) {
          throw new DatabaseError(
            'Cannot save: the time span is too small to split across these clock rows (each needs at least 0.01 hours), or the block is too compressed. Widen the span or edit in People → Hours.'
          )
        }
        for (let i = 0; i < c.length; i++) {
          const row = c[i]!
          const iv = intervals[i]!
          await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .update({
                  clocked_in_at: new Date(iv.clockedInMs).toISOString(),
                  clocked_out_at:
                    iv.clockedOutMs != null
                      ? new Date(iv.clockedOutMs).toISOString()
                      : null,
                  notes: p0.notes,
                })
                .eq('id', row.id),
            'update clock session times after mixed cross-row merge partition',
          )
          if (row.approved_at) approvedRowTimesChangedId = row.id
        }
      } else {
        const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
        await runReplaceMixed(c.map((s) => s.id), mixed)
      }
    } else if (c.length === 1) {
      await runSplitSeg(c[0]!.id, payloads.map(stripJobBidForSegmentRpc))
    } else if (segmentsAreTheRowsUnchanged(c, split, nowTick)) {
      // Only the notes changed: write them onto the rows. The split / replace RPCs delete and
      // re-insert the rows, which takes approved hours back out of payroll.
      for (let i = 0; i < c.length; i++) {
        const row = c[i]!
        const p0 = payloads[i]!
        await withSupabaseRetry(
          async () => supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
          'update clock session notes'
        )
      }
    } else if (clusterIsHomogeneousJobBid(c) && clusterSharesClockSessionClusterRpcMetadata(c)) {
      await runSplitCluster(c.map((s) => s.id), payloads.map(stripJobBidForSegmentRpc))
    } else if (mixedClusterSegmentsAllowPerRowPersist(c, split, nowTick)) {
      const useOrderedRowSegment =
        orderedSegmentsFollowTheirRows(c, split, nowTick) && payloads.length === c.length
      if (useOrderedRowSegment) {
        for (let rowIdx = 0; rowIdx < c.length; rowIdx++) {
          const row = c[rowIdx]!
          const p0 = payloads[rowIdx]!
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
              async () =>
                supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
              'update clock session notes'
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
              'update clock session times'
            )
            if (row.approved_at) approvedRowTimesChangedId = row.id
          }
        }
      } else {
        for (const row of c) {
          const { lo, hi } = sessionRowIntervalMs(row, nowTick)
          const rowPayloads: SplitClockSegmentPayload[] = []
          for (let i = 0; i < payloads.length; i++) {
            const a = split.boundaries[i]!
            const b = split.boundaries[i + 1]!
            if (segmentContainedInRow(a, b, lo, hi)) {
              rowPayloads.push(payloads[i]!)
            }
          }
          if (rowPayloads.length === 0) continue
          if (rowPayloads.length === 1) {
            const p0 = rowPayloads[0]!
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
                async () =>
                  supabase.from('clock_sessions').update({ notes: p0.notes }).eq('id', row.id),
                'update clock session notes'
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
                'update clock session times'
              )
              if (row.approved_at) approvedRowTimesChangedId = row.id
            }
          } else {
            await runSplitSeg(row.id, rowPayloads.map(stripJobBidForSegmentRpc))
          }
        }
      }
    } else if (c.length > 1 && !clusterSharesClockSessionClusterRpcMetadata(c)) {
      const nSegCoalesce = split.boundaries.length - 1
      const coalesced = coalescedMixedClusterPartitionForSave(
        c,
        split,
        split.notes.slice(0, nSegCoalesce),
        nowTick,
      )
      if (!coalesced) {
        throw new DatabaseError(myTimeClusterPersistRpcMetadataUserMessage(c))
      }
      for (let i = 0; i < c.length; i++) {
        const row = c[i]!
        const iv = coalesced.intervals[i]!
        await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .update({
                clocked_in_at: new Date(iv.clockedInMs).toISOString(),
                clocked_out_at:
                  iv.clockedOutMs != null
                    ? new Date(iv.clockedOutMs).toISOString()
                    : null,
                notes: coalesced.rowNotes[i]!,
              })
              .eq('id', row.id),
          'update clock session times after mixed coalesced partition save',
        )
        if (row.approved_at) approvedRowTimesChangedId = row.id
      }
    } else {
      // Rows that share origin and salary segment, cut out of line with each other: rebuild.
      const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
      await runReplaceMixed(c.map((s) => s.id), mixed)
    }
    // Any save that re-cut a block holding a salaried row — a split, a moved seam, a merge, a
    // rebuild — may be adjusted by the next salary sync. A notes-only save changes no times.
    if (c.some((s) => s.origin === 'salary_schedule') && !segmentsAreTheRowsUnchanged(c, split, nowTick)) {
      showSalarySyncAfterPartitionSave = true
    }
  }
  // people_hours moves only on approve (+) and reject / revoke (−). A direct UPDATE of an approved
  // row's times changes neither, so the day's payroll hours stayed at the old sum. Resync the day
  // from its approved sessions — once, and only when an approved row's times were written. (The
  // split / replace RPCs keep people_hours themselves; a notes-only update changes no hours.)
  if (approvedRowTimesChangedId) {
    const sessionId = approvedRowTimesChangedId
    await withSupabaseRetry(
      async () => supabase.rpc('recompute_people_hours_after_session_edit', { p_session_id: sessionId }),
      'recompute people_hours after my time save',
    )
  }
  return { salarySyncMayAdjust: showSalarySyncAfterPartitionSave }
}
