import { buildScheduleProportionSplit } from './scheduleProportionSplit'
import {
  persistMyTimeClusterAndGetSegmentIds,
  type MyTimeClusterPersistRpcsForAssign,
} from './persistMyTimeClusterForSegmentAssign'
import {
  splitOwnClockSessionSegments,
  splitOwnClockSessionCluster,
  replaceOwnClockSessionClusterMixed,
  type SplitClockSegmentPayload,
} from './splitOwnClockSessionSegments'
import {
  leaderSplitClockSessionSegments,
  leaderSplitClockSessionCluster,
  leaderReplaceClockSessionClusterMixed,
} from './leaderClockSessionSplit'
import type { DispatchScheduledJobForAssign } from './jobScheduleBlocks'
import type { DayEditorSession, SplitEditorState } from './myTimeDayTimeline'
import { isDraftPeopleHoursSessionId } from './peopleHoursManualDraftSession'
import { supabase } from './supabase'
import { DatabaseError, formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

/** Minimal clock session shape needed to apply a schedule-proportion split. */
export type ApplyScheduleProportionsRow = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string | null
}

export type ApplyScheduleProportionsResult =
  | { ok: true; segmentCount: number }
  | { ok: false; kind: 'warning' | 'error'; message: string }

/**
 * Split one closed `clock_sessions` row across the day's Dispatch-scheduled jobs (proportional to
 * each job's share of scheduled time) and assign each resulting segment to its job. Persists
 * immediately. Shared by the My Time day editor and the People → Hours clock strip.
 *
 * - 1 viable job → assigns the whole session (no split).
 * - N viable jobs → splits the row into N contiguous segments (schedule-start order) via the
 *   `editingSelf`-selected split RPC, then assigns each new segment its job.
 *
 * Returns a `warning` for benign no-ops (draft / still open / nothing to split) and an `error` for
 * a failed persist; the caller decides how to surface it.
 */
export async function applyScheduleProportionsToClockSession(
  row: ApplyScheduleProportionsRow,
  picks: DispatchScheduledJobForAssign[],
  options: { editingSelf: boolean; nowTick: number },
): Promise<ApplyScheduleProportionsResult> {
  if (isDraftPeopleHoursSessionId(row.id)) {
    return { ok: false, kind: 'warning', message: 'Save this session first, then apply the schedule split.' }
  }
  if (!row.clocked_out_at) {
    return { ok: false, kind: 'warning', message: 'Apply Schedule % needs a clocked-out session.' }
  }

  const spanStartMs = new Date(row.clocked_in_at).getTime()
  const spanEndMs = new Date(row.clocked_out_at).getTime()
  const planResult = buildScheduleProportionSplit({
    spanStartMs,
    spanEndMs,
    jobs: picks.map((p) => ({
      jobId: p.jobId,
      scheduledMinutes: p.scheduledMinutes,
      earliestStartMinutes: p.earliestStartMinutes,
    })),
  })
  if (!planResult) {
    return { ok: false, kind: 'warning', message: 'Could not apply schedule split for this session.' }
  }

  const { boundaries, segmentJobIds } = planResult
  const picksById = new Map(picks.map((p) => [p.jobId, p]))
  const jobNoteFor = (jobId: string): string => {
    const p = picksById.get(jobId)
    if (!p) return 'Scheduled work'
    const hcp = p.hcp_number.trim()
    const name = p.job_name.trim()
    return [hcp, name].filter((x) => x.length > 0).join(' · ') || 'Scheduled work'
  }
  const baseNote = (row.notes ?? '').trim()

  try {
    if (segmentJobIds.length === 1) {
      // Single scheduled job — assign the whole session, no split needed.
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({ job_ledger_id: segmentJobIds[0]!, bid_id: null })
            .eq('id', row.id),
        'apply schedule proportions single job assign',
      )
    } else {
      const payloads: SplitClockSegmentPayload[] = segmentJobIds.map((jobId, i) => ({
        clocked_in_at: new Date(boundaries[i]!).toISOString(),
        clocked_out_at: new Date(boundaries[i + 1]!).toISOString(),
        notes: baseNote || jobNoteFor(jobId),
      }))
      const splitForPersist: SplitEditorState = {
        boundaries: [...boundaries],
        notes: payloads.map((p) => p.notes),
      }
      // persistMyTimeClusterAndGetSegmentIds only reads c[0].id for a length-1 cluster; the other
      // fields are placeholders to satisfy the DayEditorSession type.
      const cluster: DayEditorSession[] = [
        {
          id: row.id,
          clocked_in_at: row.clocked_in_at,
          clocked_out_at: row.clocked_out_at,
          work_date: '',
          notes: row.notes ?? '',
          job_ledger_id: null,
          bid_id: null,
          approved_at: null,
          origin: '',
          salary_segment_index: null,
        },
      ]
      const rpcs: MyTimeClusterPersistRpcsForAssign = {
        runSplitSeg: options.editingSelf ? splitOwnClockSessionSegments : leaderSplitClockSessionSegments,
        runSplitCluster: options.editingSelf ? splitOwnClockSessionCluster : leaderSplitClockSessionCluster,
        runReplaceMixed: options.editingSelf ? replaceOwnClockSessionClusterMixed : leaderReplaceClockSessionClusterMixed,
      }
      const segmentIds = await persistMyTimeClusterAndGetSegmentIds(
        cluster,
        splitForPersist,
        payloads,
        options.nowTick,
        rpcs,
      )
      for (let i = 0; i < segmentJobIds.length; i++) {
        const segId = segmentIds[i]
        if (!segId) throw new DatabaseError('Split did not return an id for a schedule segment.')
        await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .update({ job_ledger_id: segmentJobIds[i]!, bid_id: null })
              .eq('id', segId),
          'apply schedule proportions segment job assign',
        )
      }
    }
    return { ok: true, segmentCount: segmentJobIds.length }
  } catch (e: unknown) {
    return {
      ok: false,
      kind: 'error',
      message: formatErrorMessage(e, e instanceof DatabaseError ? e.message : 'Could not apply schedule split'),
    }
  }
}
