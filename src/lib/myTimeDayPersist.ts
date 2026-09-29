/**
 * The My Time day editor's save: what each dirty cluster writes to `clock_sessions`. PAYROLL PATH.
 *
 * `planMyTimeDaySave` works out the whole day's writes, in order, without touching the database —
 * every refusal (`DatabaseError`, the copy the user reads) is thrown before anything is sent.
 * `persistMyTimeDayDirtyClusters` sends the list to `save_my_time_day` in one call, which applies it
 * in one transaction: all of it, or none of it (v2.4108; before, each write was its own request
 * and a refusal part-way left the rows before it rewritten — the map's quirk 26).
 *
 * The order of the branches is the behaviour — MY_TIME_DAY_EDITOR_MODAL map, "The save engine"
 * and quirk 8. Change it only with a test that says why.
 *
 * `persistMyTimeClusterAndGetSegmentIds` (persistMyTimeClusterForSegmentAssign.ts) is a near-copy
 * of the multi-payload branches for the assign flow, still one request per write. It has no draft
 * guard and no coalesced branch; do not swap one for the other without a parity test.
 */
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
import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'
import { supabase } from './supabase'
import type { Json } from '../types/database'
import { formatDenverBlockDateHeader, formatDenverTimeOnly } from '../utils/dateUtils'
import { DatabaseError, withSupabaseRetry } from '../utils/errorHandling'

/** The toast after a save that re-cut rows of a salaried workday. */
export const MY_TIME_SALARY_SYNC_SAVED_NOTE =
  'Saved. Rows tied to the salaried workday template may be adjusted when salary sync runs.'

/** A new session in a block that was split or merged before its first save. */
export const MY_TIME_DRAFT_IN_BLOCK_EDITED_MESSAGE =
  'A new session can’t be split or merged with the session beside it before it is saved. Undo that change and Save, then edit again.'

/** A save with writes to send but no person to send them for. */
export const MY_TIME_SAVE_MISSING_SUBJECT_MESSAGE = 'Missing subject user for this day.'

/**
 * One write of a day's save, as `save_my_time_day` takes it (migration 20260928182140). An insert
 * is stamped with the call's person and day by the database.
 */
export type MyTimeDayWrite =
  | {
      op: 'insert'
      clocked_in_at: string
      clocked_out_at: string | null
      notes: string
      job_ledger_id: string | null
      bid_id: string | null
    }
  | { op: 'update_notes'; id: string; notes: string }
  | {
      op: 'update_times'
      id: string
      clocked_in_at: string
      clocked_out_at: string | null
      notes: string
      /** Written only when present (the People → Hours seed update). */
      work_date?: string
      job_ledger_id?: string | null
      bid_id?: string | null
    }
  | { op: 'split_segments'; id: string; segments: SplitClockSegmentPayload[] }
  | { op: 'split_cluster'; ids: string[]; segments: SplitClockSegmentPayload[] }
  | { op: 'replace_mixed'; ids: string[]; segments: SplitClockSegmentPayload[] }

/** A new (draft) session's first save: an insert with the part's times and the row's job and bid. */
function draftInsert(
  row: DayEditorSession,
  p0: SplitClockSegmentPayload,
  effectiveSubjectUserId: string | null | undefined
): MyTimeDayWrite {
  if (!p0.clocked_out_at) {
    throw new DatabaseError('Draft session must be clocked out before saving.')
  }
  if (!effectiveSubjectUserId) {
    throw new DatabaseError('Missing subject user for new clock session.')
  }
  return {
    op: 'insert',
    clocked_in_at: p0.clocked_in_at,
    clocked_out_at: p0.clocked_out_at,
    notes: p0.notes,
    job_ledger_id: row.job_ledger_id,
    bid_id: row.bid_id,
  }
}

/**
 * Your own day uses the `own_*` split / replace RPCs, which the server holds to the current week.
 * Anyone else's day, and your own once the week fence is overridden (Draft Payroll), uses the
 * `leader_*` ones.
 */
export function myTimeDaySaveUsesLeaderRpcs(editingSelf: boolean, fenceOverridden: boolean): boolean {
  // Overridden fence (Draft Payroll origin): always the leader RPCs — own_* stay week-fenced.
  return !(editingSelf && !fenceOverridden)
}

export type PlanMyTimeDaySaveInput = {
  /** Cluster ids to write, in order (the editor's `effectiveDirtyIds`). */
  dirty: string[]
  sessionClusters: DayEditorSession[][]
  splitByCluster: Record<string, SplitEditorState>
  nowTick: number
  effectiveSubjectUserId: string | null | undefined
  /** People → Hours grid seed: a single untouched row saves its times, not only its note. */
  peopleHoursGridProportionalSeed: boolean
}

export type PersistMyTimeDayInput = PlanMyTimeDaySaveInput & {
  /** The day the editor is open on: `save_my_time_day`'s `p_work_date`. */
  dateStr: string
  /** `leader_*` RPCs (true) or `own_*` (false) — `myTimeDaySaveUsesLeaderRpcs`. */
  leader: boolean
}

/**
 * The day's writes, in order. Throws `DatabaseError` with the message the editor shows when a
 * cluster cannot be saved — before anything is sent. `salarySyncMayAdjust` is true when rows of a
 * salaried workday are re-cut.
 */
export function planMyTimeDaySave({
  dirty,
  sessionClusters,
  splitByCluster,
  nowTick,
  effectiveSubjectUserId,
  peopleHoursGridProportionalSeed,
}: PlanMyTimeDaySaveInput): { writes: MyTimeDayWrite[]; salarySyncMayAdjust: boolean } {
  const writes: MyTimeDayWrite[] = []
  let showSalarySyncAfterPartitionSave = false
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
          writes.push(draftInsert(row, p0, effectiveSubjectUserId))
        } else {
          writes.push({ op: 'update_notes', id: row.id, notes: p0.notes })
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
          writes.push(draftInsert(row, payloads[0]!, effectiveSubjectUserId))
        } else if (!singleSegmentTimesMatchSession(row, split)) {
          throw new DatabaseError(
            'To change clock times for one block, add a split first (tap the gray strip) or edit in People → Hours.'
          )
        } else if (peopleHoursGridProportionalSeed) {
          const p0 = payloads[0]!
          writes.push({
            op: 'update_times',
            id: row.id,
            clocked_in_at: p0.clocked_in_at,
            clocked_out_at: p0.clocked_out_at,
            notes: p0.notes,
            work_date: row.work_date,
            job_ledger_id: row.job_ledger_id,
            bid_id: row.bid_id,
          })
        } else {
          writes.push({ op: 'update_notes', id: row.id, notes: payloads[0]!.notes })
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
          writes.push({
            op: 'update_times',
            id: row.id,
            clocked_in_at: new Date(iv.clockedInMs).toISOString(),
            clocked_out_at: iv.clockedOutMs != null ? new Date(iv.clockedOutMs).toISOString() : null,
            notes: p0.notes,
          })
        }
      } else {
        const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
        writes.push({ op: 'replace_mixed', ids: c.map((s) => s.id), segments: mixed })
      }
    } else if (c.length === 1) {
      writes.push({ op: 'split_segments', id: c[0]!.id, segments: payloads.map(stripJobBidForSegmentRpc) })
    } else if (segmentsAreTheRowsUnchanged(c, split, nowTick)) {
      // Only the notes changed: write them onto the rows. The split / replace RPCs delete and
      // re-insert the rows, which takes approved hours back out of payroll.
      for (let i = 0; i < c.length; i++) {
        const row = c[i]!
        writes.push({ op: 'update_notes', id: row.id, notes: payloads[i]!.notes })
      }
    } else if (clusterIsHomogeneousJobBid(c) && clusterSharesClockSessionClusterRpcMetadata(c)) {
      writes.push({ op: 'split_cluster', ids: c.map((s) => s.id), segments: payloads.map(stripJobBidForSegmentRpc) })
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
            writes.push({ op: 'update_notes', id: row.id, notes: p0.notes })
          } else {
            writes.push({
              op: 'update_times',
              id: row.id,
              clocked_in_at: p0.clocked_in_at,
              clocked_out_at: p0.clocked_out_at,
              notes: p0.notes,
            })
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
              writes.push({ op: 'update_notes', id: row.id, notes: p0.notes })
            } else {
              writes.push({
                op: 'update_times',
                id: row.id,
                clocked_in_at: p0.clocked_in_at,
                clocked_out_at: p0.clocked_out_at,
                notes: p0.notes,
              })
            }
          } else {
            writes.push({ op: 'split_segments', id: row.id, segments: rowPayloads.map(stripJobBidForSegmentRpc) })
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
        writes.push({
          op: 'update_times',
          id: row.id,
          clocked_in_at: new Date(iv.clockedInMs).toISOString(),
          clocked_out_at: iv.clockedOutMs != null ? new Date(iv.clockedOutMs).toISOString() : null,
          notes: coalesced.rowNotes[i]!,
        })
      }
    } else {
      // Rows that share origin and salary segment, cut out of line with each other: rebuild.
      const mixed = attachAllocationsToPayloads(payloads, c, split, nowTick)
      writes.push({ op: 'replace_mixed', ids: c.map((s) => s.id), segments: mixed })
    }
    // Any save that re-cut a block holding a salaried row — a split, a moved seam, a merge, a
    // rebuild — may be adjusted by the next salary sync. A notes-only save changes no times.
    if (c.some((s) => s.origin === 'salary_schedule') && !segmentsAreTheRowsUnchanged(c, split, nowTick)) {
      showSalarySyncAfterPartitionSave = true
    }
  }
  return { writes, salarySyncMayAdjust: showSalarySyncAfterPartitionSave }
}

/**
 * Saves the dirty clusters: plans the writes, then sends them to `save_my_time_day` in one call —
 * one transaction, so a refusal from the database undoes every write (all or nothing). The database
 * resyncs `people_hours` once when an approved row's times change in place. Resolves with
 * `salarySyncMayAdjust`; rejects with the planner's `DatabaseError` (nothing sent) or the
 * database's error (nothing written).
 */
export async function persistMyTimeDayDirtyClusters(
  input: PersistMyTimeDayInput
): Promise<{ salarySyncMayAdjust: boolean }> {
  const { writes, salarySyncMayAdjust } = planMyTimeDaySave(input)
  if (writes.length === 0) return { salarySyncMayAdjust }
  const subjectUserId = input.effectiveSubjectUserId
  if (!subjectUserId) {
    throw new DatabaseError(MY_TIME_SAVE_MISSING_SUBJECT_MESSAGE)
  }
  await withSupabaseRetry(
    async () =>
      supabase.rpc('save_my_time_day', {
        p_subject_user_id: subjectUserId,
        p_work_date: input.dateStr,
        p_leader: input.leader,
        p_writes: writes as unknown as Json,
      }),
    'save my time day',
  )
  return { salarySyncMayAdjust }
}
