import type { SplitClockSegmentPayload } from './splitOwnClockSessionSegments'
import {
  CLUSTER_CONTIGUITY_EPS_MS,
  groupTimeContiguousSessionClusters,
  type DayEditorSession,
  MIN_SEGMENT_MS,
} from './myTimeDayTimeline'
import { allocateSecondsForPercents, type DayJobMixRow } from './dayJobMixPercentages'

const MIN_SEGMENT_SEC = Math.ceil(MIN_SEGMENT_MS / 1000)

export type DayJobMixClusterPlan = {
  sessionIds: string[]
  payloads: SplitClockSegmentPayload[]
}

export type DayJobMixReplacePlan = {
  clusters: DayJobMixClusterPlan[]
  /** Human summary for confirm UI */
  clusterCount: number
}

function sortSessionsForDayEditor(
  rows: readonly Pick<
    DayEditorSession,
    | 'id'
    | 'clocked_in_at'
    | 'clocked_out_at'
    | 'work_date'
    | 'notes'
    | 'job_ledger_id'
    | 'bid_id'
    | 'approved_at'
  >[]
): DayEditorSession[] {
  return [...rows].sort((a, b) => a.clocked_in_at.localeCompare(b.clocked_in_at)) as DayEditorSession[]
}

/** Build segment note: prefer inheriting overlap from target rows, else literal. */
function noteForSegment(
  cluster: DayEditorSession[],
  segStartMs: number,
  segEndMs: number,
  sourcePersonLabel: string
): string {
  let best = ''
  for (const s of cluster) {
    const lo = new Date(s.clocked_in_at).getTime()
    const hi = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : segEndMs
    const ov = Math.min(segEndMs, hi) - Math.max(segStartMs, lo)
    if (ov > CLUSTER_CONTIGUITY_EPS_MS) {
      const n = (s.notes ?? '').trim()
      if (n.length > best.length) best = n
    }
  }
  const base =
    best.length > 0 ? best : `Job mix (${sourcePersonLabel})`
  return base.slice(0, 4000)
}

/**
 * Validates per-cluster segment lengths (each part ≥ 0.01 h when multiple segments).
 * Returns a plan of `leaderReplaceClockSessionClusterMixed` calls (one per time-contiguous cluster).
 */
export function buildDayJobMixReplacePlan(args: {
  targetSessions: DayEditorSession[]
  nowMs: number
  /** Source template: job/bid keys + pct (should sum to 1) */
  sourceMix: readonly DayJobMixRow[]
  sourcePersonLabel: string
}): { ok: true; plan: DayJobMixReplacePlan } | { ok: false; error: string } {
  const { targetSessions, nowMs, sourceMix, sourcePersonLabel } = args

  if (sourceMix.length === 0) {
    return { ok: false, error: 'Source has no eligible time on jobs for this day.' }
  }

  const pcts = sourceMix.map((r) => r.pct)
  const pctSum = pcts.reduce((a, p) => a + p, 0)
  if (pctSum <= 0) {
    return { ok: false, error: 'Source mix percentages are invalid.' }
  }
  const normPcts = pcts.map((p) => p / pctSum)

  const sorted = sortSessionsForDayEditor(targetSessions)
  if (sorted.length === 0) {
    return { ok: false, error: 'Target has no sessions for this day.' }
  }

  const clusters = groupTimeContiguousSessionClusters(sorted)
  const clusterPlans: DayJobMixClusterPlan[] = []

  for (const c of clusters) {
    const first = c[0]!
    const last = c[c.length - 1]!
    const clusterStartMs = new Date(first.clocked_in_at).getTime()
    const clusterEndMs = last.clocked_out_at ? new Date(last.clocked_out_at).getTime() : nowMs
    const totalClusterSec = Math.max(0, Math.floor((clusterEndMs - clusterStartMs) / 1000))

    if (totalClusterSec < MIN_SEGMENT_SEC) {
      return {
        ok: false,
        error: `A clock block for the target is shorter than 0.01 hours (${totalClusterSec}s). Edit in My Time first.`,
      }
    }

    const secs = allocateSecondsForPercents(totalClusterSec, normPcts)

    const positiveSecs = secs.filter((s) => s > 0)
    if (positiveSecs.length > 1 && positiveSecs.some((s) => s < MIN_SEGMENT_SEC)) {
      return {
        ok: false,
        error:
          'Applying this mix would create a segment under 0.01 hours on target. Adjust the source day or edit the target in My Time.',
      }
    }

    const payloads: SplitClockSegmentPayload[] = []
    let curMs = clusterStartMs
    const openLast = !last.clocked_out_at

    for (let i = 0; i < normPcts.length; i++) {
      const sec = secs[i]!
      if (sec <= 0) continue

      const hasMoreNonZero = secs.slice(i + 1).some((s) => s > 0)
      const isLastSeg = !hasMoreNonZero
      const segStartMs = curMs

      let segEndMs: number
      if (isLastSeg) {
        segEndMs = clusterEndMs
      } else {
        segEndMs = curMs + sec * 1000
      }

      const mix = sourceMix[i]!
      payloads.push({
        clocked_in_at: new Date(segStartMs).toISOString(),
        clocked_out_at: openLast && isLastSeg ? null : new Date(segEndMs).toISOString(),
        notes: noteForSegment(c, segStartMs, segEndMs, sourcePersonLabel),
        job_ledger_id: mix.job_ledger_id,
        bid_id: mix.bid_id,
      })

      curMs = segEndMs
    }

    if (payloads.length === 0) {
      return { ok: false, error: 'No segments generated for a target clock block.' }
    }

    clusterPlans.push({
      sessionIds: c.map((s) => s.id),
      payloads,
    })
  }

  return {
    ok: true,
    plan: { clusters: clusterPlans, clusterCount: clusterPlans.length },
  }
}
