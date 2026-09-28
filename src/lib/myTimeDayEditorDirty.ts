/**
 * Dirty-gate kernels of the My Time day editor (DashboardMyTimeDayEditorModal): which clusters
 * Save has to write, and whether a change to approved hours is safe without the confirm. Pure.
 */
import { buildPayloads, singleSegmentTimesMatchSession } from './myTimeDayEditorPayloads'
import { segmentsAreTheRowsUnchanged } from './myTimeDaySavePlan'
import {
  boundariesMatchOriginalRows,
  sessionClusterId,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'
import { isDraftPeopleHoursSessionId } from './peopleHoursManualDraftSession'

/** True when the cluster's save is a notes-only write — approved hours stay in payroll. */
export function noteOnlyApprovedSafe(
  c: DayEditorSession[],
  split: SplitEditorState,
  last: DayEditorSession,
  nowMs: number
): boolean {
  const payloads = buildPayloads(last, split, nowMs)
  if (!payloads) return false
  if (payloads.length === 1) {
    if (c.length === 1) return singleSegmentTimesMatchSession(c[0]!, split)
    return boundariesMatchOriginalRows(c, split, nowMs)
  }
  // Several rows, each part its row unchanged: the save writes notes only.
  return c.length > 1 && segmentsAreTheRowsUnchanged(c, split, nowMs)
}

/** Open sessions: exclude last boundary from compare so clock ticks do not look dirty. */
export function comparableSplit(session: DayEditorSession, split: SplitEditorState): string {
  if (session.clocked_out_at) return JSON.stringify(split)
  return JSON.stringify({
    boundaries: split.boundaries.slice(0, -1),
    notes: split.notes,
  })
}

export function listDirtyClusterIds(
  clusters: DayEditorSession[][],
  initial: Record<string, string>,
  splitByCluster: Record<string, SplitEditorState>
): string[] {
  const dirty: string[] = []
  for (const c of clusters) {
    const id = sessionClusterId(c)
    const cur = splitByCluster[id]
    if (!cur) continue
    const last = c[c.length - 1]!
    const key = comparableSplit(last, cur)
    if (initial[id] !== key) dirty.push(id)
  }
  return dirty
}

export function sessionJobBidKey(s: Pick<DayEditorSession, 'job_ledger_id' | 'bid_id'>): string {
  return `${s.job_ledger_id ?? ''}\0${s.bid_id ?? ''}`
}

/** Clusters whose session job/bid no longer match values when the editor was seeded (split snapshot ignores job/bid). */
export function listClustersDirtyFromJobBidChange(
  clusters: DayEditorSession[][],
  initialBySessionId: Record<string, string>,
  currentBySessionId: Map<string, string>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of clusters) {
    const cid = sessionClusterId(c)
    if (seen.has(cid)) continue
    for (const s of c) {
      const init = initialBySessionId[s.id] ?? ''
      const cur = currentBySessionId.get(s.id) ?? sessionJobBidKey(s)
      if (init !== cur) {
        seen.add(cid)
        out.push(cid)
        break
      }
    }
  }
  return out
}

/**
 * The clusters Save writes: split edits, job/bid drift, and every draft cluster (not in the
 * database yet, so it persists even untouched). With nothing dirty and a People → Hours
 * proportional seed, every cluster is written and `isOnlyProportionalSeed` is true.
 */
export function dayEditorEffectiveDirty(input: {
  clusters: DayEditorSession[][]
  sessions: DayEditorSession[]
  initialSnapshot: Record<string, string>
  splitByCluster: Record<string, SplitEditorState>
  initialJobBidBySessionId: Record<string, string>
  proportionalSeed: boolean
}): { effectiveDirtyIds: string[]; isOnlyProportionalSeed: boolean } {
  const { clusters, sessions, initialSnapshot, splitByCluster, initialJobBidBySessionId, proportionalSeed } = input
  const splitDirty = listDirtyClusterIds(clusters, initialSnapshot, splitByCluster)
  const currentJobBid = new Map(sessions.map((s) => [s.id, sessionJobBidKey(s)]))
  const jobBidDirty = listClustersDirtyFromJobBidChange(clusters, initialJobBidBySessionId, currentJobBid)
  const draftClusterIds = clusters
    .filter((c) => c.some((s) => isDraftPeopleHoursSessionId(s.id)))
    .map((c) => sessionClusterId(c))
  const raw = [...new Set([...splitDirty, ...jobBidDirty, ...draftClusterIds])]
  if (raw.length === 0 && proportionalSeed && clusters.length > 0) {
    return {
      effectiveDirtyIds: clusters.map((c) => sessionClusterId(c)),
      isOnlyProportionalSeed: true,
    }
  }
  return { effectiveDirtyIds: raw, isOnlyProportionalSeed: false }
}
