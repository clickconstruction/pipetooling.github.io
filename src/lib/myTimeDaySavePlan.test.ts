import { describe, expect, it } from 'vitest'
import type { DayEditorSession, SplitEditorState } from './myTimeDayTimeline'
import { initialClusterSplitState } from './myTimeDayTimeline'
import {
  MY_TIME_CLUSTER_RPC_METADATA_USER_MESSAGE,
  NO_JOB_BID_LINKED_LABEL,
  allocationForSegmentInterval,
  assignJobNeedsPersistedSplits,
  attachAllocationsToPayloads,
  clockSessionRowForSegmentAssign,
  clusterHasMultipleAllocations,
  coalescedMixedClusterPartitionForSave,
  describeClockSessionsRpcMetadataMismatch,
  effectiveSegmentJobBid,
  everySegmentFullyInsideSomeRow,
  isRowUnassigned,
  labelForSession,
  mergeAllocChoiceRequired,
  mixedClusterSegmentsAllowPerRowPersist,
  mixedClusterSingleSegmentPartitionInfeasible,
  myTimeClusterMergeBlockedUserMessage,
  myTimeClusterMergeWouldBlockPersist,
  myTimeClusterPersistRpcMetadataUserMessage,
  myTimeClusterSpanningSaveBlockedByRpcMetadata,
  myTimeMergePersistBlockTitle,
  segmentAllocationLabel,
  segmentAllocationLabelsForOverlap,
  unassignedSessionIdsOverlappingSegment,
} from './myTimeDaySavePlan'

const T = (hhmm: string, s = 0) => new Date(`2026-09-01T${hhmm}:${String(s).padStart(2, '0')}.000Z`).getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = T('20:00')

function row(id: string, inMs: number, outMs: number | null, extra: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: iso(inMs),
    clocked_out_at: outMs === null ? null : iso(outMs),
    work_date: '2026-09-01',
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...extra,
  }
}
const salary = (id: string, inMs: number, outMs: number | null, seg: number, extra: Partial<DayEditorSession> = {}) =>
  row(id, inMs, outMs, { origin: 'salary_schedule', salary_segment_index: seg, ...extra })

/** Two punch rows, J1 then J2, 08–10 and 10–12. */
const twoJobs = () => [row('a', T('08:00'), T('10:00'), { job_ledger_id: 'J1' }), row('b', T('10:00'), T('12:00'), { job_ledger_id: 'J2' })]
const aligned = (c: DayEditorSession[]): SplitEditorState => initialClusterSplitState(c, NOW)
const JOB_LABELS = { J1: 'J878 · Smith', J2: 'J879 · Jones' }
const BID_LABELS = { B1: 'B404 · Hyper Kidz' }

describe('assignJobNeedsPersistedSplits / mergeAllocChoiceRequired', () => {
  it('only a multi-segment split that no longer matches the rows needs persisting first', () => {
    const c = twoJobs()
    expect(assignJobNeedsPersistedSplits(c, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW)).toBe(false)
    expect(assignJobNeedsPersistedSplits(c, aligned(c), NOW)).toBe(false)
    expect(assignJobNeedsPersistedSplits(c, { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }, NOW)).toBe(true)
  })
  it('a job-choice prompt is needed when the two sides carry different allocations, unless both are simply unlinked', () => {
    expect(mergeAllocChoiceRequired([NO_JOB_BID_LINKED_LABEL], [NO_JOB_BID_LINKED_LABEL])).toBe(false)
    expect(mergeAllocChoiceRequired(['J878'], ['J878'])).toBe(false)
    expect(mergeAllocChoiceRequired(['J878', 'J879'], ['J879', 'J878'])).toBe(false)
    expect(mergeAllocChoiceRequired(['J878'], ['J879'])).toBe(true)
    expect(mergeAllocChoiceRequired(['J878'], [NO_JOB_BID_LINKED_LABEL])).toBe(true)
    expect(mergeAllocChoiceRequired([], [NO_JOB_BID_LINKED_LABEL])).toBe(true)
  })
})

describe('labels', () => {
  it('labelForSession: map label, then a truncated id, then null', () => {
    expect(labelForSession(row('a', 0, 1, { job_ledger_id: 'J1' }), JOB_LABELS, BID_LABELS)).toBe('J878 · Smith')
    expect(labelForSession(row('a', 0, 1, { bid_id: 'B1' }), JOB_LABELS, BID_LABELS)).toBe('B404 · Hyper Kidz')
    expect(labelForSession(row('a', 0, 1, { job_ledger_id: '0123456789abcdef' }), {}, {})).toBe('Job 01234567…')
    expect(labelForSession(row('a', 0, 1, { bid_id: 'fedcba9876543210' }), {}, {})).toBe('Bid fedcba98…')
    expect(labelForSession(row('a', 0, 1), JOB_LABELS, BID_LABELS)).toBeNull()
  })
  it('isRowUnassigned / clusterHasMultipleAllocations', () => {
    expect(isRowUnassigned(row('a', 0, 1))).toBe(true)
    expect(isRowUnassigned(row('a', 0, 1, { bid_id: 'B1' }))).toBe(false)
    expect(clusterHasMultipleAllocations(twoJobs())).toBe(true)
    expect(clusterHasMultipleAllocations([twoJobs()[0]!])).toBe(false)
    expect(clusterHasMultipleAllocations([row('a', 0, 1, { job_ledger_id: 'J1' }), row('b', 1, 2, { job_ledger_id: 'J1' })])).toBe(false)
  })
})

describe('allocationForSegmentInterval', () => {
  const c = twoJobs()
  it('the row with the most overlap wins; ties go to the earlier clock-in', () => {
    expect(allocationForSegmentInterval(c, NOW, T('09:30'), T('11:00'))).toEqual({ job_ledger_id: 'J2', bid_id: null })
    expect(allocationForSegmentInterval(c, NOW, T('09:00'), T('11:00'))).toEqual({ job_ledger_id: 'J1', bid_id: null })
  })
  it('a segment overlapping nothing falls back to the row containing its midpoint, else the first row', () => {
    expect(allocationForSegmentInterval(c, NOW, T('12:00'), T('12:00', 1))).toEqual({ job_ledger_id: 'J2', bid_id: null })
    expect(allocationForSegmentInterval(c, NOW, T('15:00'), T('16:00'))).toEqual({ job_ledger_id: 'J1', bid_id: null })
  })
})

describe('per-segment views (aligned vs re-cut)', () => {
  const c = twoJobs()
  const recut: SplitEditorState = { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }

  it('effectiveSegmentJobBid: override, then the aligned row, then overlap inference', () => {
    expect(effectiveSegmentJobBid(c, aligned(c), NOW, 1)).toEqual({ job_ledger_id: 'J2', bid_id: null })
    expect(effectiveSegmentJobBid(c, recut, NOW, 0)).toEqual({ job_ledger_id: 'J1', bid_id: null }) // 08–11: 2 h of J1 vs 1 h of J2
    expect(effectiveSegmentJobBid(c, { ...recut, segmentJobOverrides: { 0: { job_ledger_id: null, bid_id: 'B1' } } }, NOW, 0)).toEqual({ job_ledger_id: null, bid_id: 'B1' })
  })

  it('unassignedSessionIdsOverlappingSegment lists only unlinked rows that overlap the segment', () => {
    const mixed = [row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00'), { job_ledger_id: 'J2' }), row('c', T('12:00'), T('14:00'))]
    expect(unassignedSessionIdsOverlappingSegment(mixed, aligned(mixed), NOW, 0)).toEqual(['a'])
    expect(unassignedSessionIdsOverlappingSegment(mixed, aligned(mixed), NOW, 1)).toEqual([])
    expect(unassignedSessionIdsOverlappingSegment(mixed, { boundaries: [T('08:00'), T('13:00'), T('14:00')], notes: ['', ''] }, NOW, 0)).toEqual(['a', 'c'])
  })

  it('clockSessionRowForSegmentAssign picks the aligned row, or the best-overlapping row of the inferred allocation', () => {
    expect(clockSessionRowForSegmentAssign(c, aligned(c), NOW, 1)?.id).toBe('b')
    expect(clockSessionRowForSegmentAssign(c, recut, NOW, 0)?.id).toBe('a')
    expect(clockSessionRowForSegmentAssign(c, recut, NOW, 1)?.id).toBe('b')
    expect(clockSessionRowForSegmentAssign([], recut, NOW, 0)).toBeNull()
  })

  it('segmentAllocationLabel: aligned row label, "Mixed allocation" when a segment spans two jobs, no-job fallback', () => {
    expect(segmentAllocationLabel(c, aligned(c), NOW, 0, JOB_LABELS, BID_LABELS)).toBe('J878 · Smith')
    expect(segmentAllocationLabel(c, recut, NOW, 0, JOB_LABELS, BID_LABELS)).toBe('Mixed allocation')
    expect(segmentAllocationLabel(c, recut, NOW, 1, JOB_LABELS, BID_LABELS)).toBe('J879 · Jones')
    const none = [row('a', T('08:00'), T('10:00'))]
    expect(segmentAllocationLabel(none, aligned(none), NOW, 0, JOB_LABELS, BID_LABELS)).toBe(NO_JOB_BID_LINKED_LABEL)
  })

  it('segmentAllocationLabelsForOverlap: override → one; aligned → one; re-cut → every distinct allocation in row order', () => {
    expect(segmentAllocationLabelsForOverlap(c, { ...recut, segmentJobOverrides: { 0: { job_ledger_id: null, bid_id: 'B1' } } }, NOW, 0, JOB_LABELS, BID_LABELS)).toEqual(['B404 · Hyper Kidz'])
    expect(segmentAllocationLabelsForOverlap(c, aligned(c), NOW, 1, JOB_LABELS, BID_LABELS)).toEqual(['J879 · Jones'])
    expect(segmentAllocationLabelsForOverlap(c, recut, NOW, 0, JOB_LABELS, BID_LABELS)).toEqual(['J878 · Smith', 'J879 · Jones'])
    const dup = [row('a', T('08:00'), T('10:00'), { job_ledger_id: 'J1' }), row('b', T('10:00'), T('12:00'), { job_ledger_id: 'J1' })]
    expect(segmentAllocationLabelsForOverlap(dup, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW, 0, JOB_LABELS, BID_LABELS)).toEqual(['J878 · Smith'])
  })
})

describe('attachAllocationsToPayloads', () => {
  const c = twoJobs()
  const payload = (lo: number, hi: number) => ({ clocked_in_at: iso(lo), clocked_out_at: iso(hi), notes: '' })

  it('aligned payloads take their row; overrides beat everything; re-cut payloads infer by overlap', () => {
    const alignedOut = attachAllocationsToPayloads([payload(T('08:00'), T('10:00')), payload(T('10:00'), T('12:00'))], c, aligned(c), NOW)
    expect(alignedOut.map((p) => p.job_ledger_id)).toEqual(['J1', 'J2'])
    const withOverride = attachAllocationsToPayloads([payload(T('08:00'), T('10:00')), payload(T('10:00'), T('12:00'))], c, { ...aligned(c), segmentJobOverrides: { 1: { job_ledger_id: null, bid_id: 'B1' } } }, NOW)
    expect(withOverride[1]).toMatchObject({ job_ledger_id: null, bid_id: 'B1' })
    const recut = attachAllocationsToPayloads([payload(T('08:00'), T('11:00')), payload(T('11:00'), T('12:00'))], c, { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }, NOW)
    expect(recut.map((p) => p.job_ledger_id)).toEqual(['J1', 'J2'])
  })
})

describe('mixed punch / salary clusters', () => {
  const punchA = row('a', T('08:00'), T('10:00'))
  const salB = salary('b', T('10:00'), T('12:00'), 1)
  const salC = salary('c', T('12:00'), T('16:00'), 2)
  const mixed2 = [punchA, salB]
  const mixed3 = [punchA, salB, salC]
  const homo = twoJobs()

  it('everySegmentFullyInsideSomeRow', () => {
    expect(everySegmentFullyInsideSomeRow(mixed2, { boundaries: [T('08:00'), T('09:00'), T('10:00'), T('12:00')], notes: ['', '', ''] }, NOW)).toBe(true)
    expect(everySegmentFullyInsideSomeRow(mixed2, { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }, NOW)).toBe(false)
  })

  it('mixedClusterSegmentsAllowPerRowPersist: shared metadata uses containment / ordered fit; mixed needs one segment per row or a feasible hull partition', () => {
    expect(mixedClusterSegmentsAllowPerRowPersist(homo, { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }, NOW)).toBe(true)
    expect(mixedClusterSegmentsAllowPerRowPersist(mixed3, aligned(mixed3), NOW)).toBe(true)
    expect(mixedClusterSegmentsAllowPerRowPersist(mixed3, { boundaries: [T('08:00'), T('11:00'), T('16:00')], notes: ['', ''] }, NOW)).toBe(false) // 2 segments, 3 rows
    expect(mixedClusterSegmentsAllowPerRowPersist(mixed2, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW)).toBe(true) // single segment over the hull partitions
    expect(mixedClusterSingleSegmentPartitionInfeasible(mixed2, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW)).toBe(false)
    expect(mixedClusterSingleSegmentPartitionInfeasible(homo, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW)).toBe(false)
  })

  it('myTimeClusterSpanningSaveBlockedByRpcMetadata: only a mixed cluster that cannot persist per row', () => {
    expect(myTimeClusterSpanningSaveBlockedByRpcMetadata([punchA], { boundaries: [T('08:00'), T('10:00')], notes: [''] }, NOW)).toBe(false)
    expect(myTimeClusterSpanningSaveBlockedByRpcMetadata(homo, { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }, NOW)).toBe(false)
    expect(myTimeClusterSpanningSaveBlockedByRpcMetadata(mixed3, aligned(mixed3), NOW)).toBe(false)
    expect(myTimeClusterSpanningSaveBlockedByRpcMetadata(mixed3, { boundaries: [T('08:00'), T('11:00'), T('16:00')], notes: ['', ''] }, NOW)).toBe(true)
  })

  it('describeClockSessionsRpcMetadataMismatch names what differs', () => {
    expect(describeClockSessionsRpcMetadataMismatch([punchA])).toBe('')
    expect(describeClockSessionsRpcMetadataMismatch(homo)).toBe('')
    expect(describeClockSessionsRpcMetadataMismatch(mixed2)).toBe('mixed origins (user_punch, salary_schedule); different salary segment indexes (none, 1)')
    expect(describeClockSessionsRpcMetadataMismatch([salB, salC])).toBe('different salary segment indexes (1, 2)')
    expect(myTimeClusterMergeBlockedUserMessage(homo)).toBe(MY_TIME_CLUSTER_RPC_METADATA_USER_MESSAGE)
    expect(myTimeClusterPersistRpcMetadataUserMessage([salB, salC])).toBe(`${MY_TIME_CLUSTER_RPC_METADATA_USER_MESSAGE} Details: different salary segment indexes (1, 2).`)
  })

  it('an intermediate merge across rows is allowed when the whole hull can still be partitioned onto the rows', () => {
    const action = { type: 'removeSegmentMergeWithPrev' as const, segIndex: 1, nowMs: NOW, openLastCluster: false }
    expect(myTimeClusterMergeWouldBlockPersist(mixed3, aligned(mixed3), action)).toBe(false)
    expect(myTimeClusterMergeWouldBlockPersist(homo, aligned(homo), action)).toBe(false)
    expect(myTimeMergePersistBlockTitle(mixed3, aligned(mixed3), NOW, false, 'prev', 1)).toBeUndefined()
    expect(myTimeMergePersistBlockTitle(homo, aligned(homo), NOW, false, 'next', 0)).toBeUndefined()
  })

  it('coalescedMixedClusterPartitionForSave: only mixed, ≥2 segments, notes 1:1, hull-aligned, with at least one note', () => {
    const twoSeg: SplitEditorState = { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }
    expect(coalescedMixedClusterPartitionForSave(homo, twoSeg, ['x', ''], NOW)).toBeNull()
    expect(coalescedMixedClusterPartitionForSave(mixed2, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, ['x'], NOW)).toBeNull()
    expect(coalescedMixedClusterPartitionForSave(mixed2, twoSeg, ['x'], NOW)).toBeNull()
    expect(coalescedMixedClusterPartitionForSave(mixed2, { boundaries: [T('08:30'), T('11:00'), T('12:00')], notes: ['', ''] }, ['x', ''], NOW)).toBeNull()
    expect(coalescedMixedClusterPartitionForSave(mixed2, twoSeg, ['', ''], NOW)).toBeNull()
    const out = coalescedMixedClusterPartitionForSave(mixed2, twoSeg, ['morning', 'afternoon'], NOW)
    expect(out).not.toBeNull()
    expect(out!.intervals).toHaveLength(2)
    expect(out!.rowNotes).toHaveLength(2)
    expect(out!.rowNotes.some((n) => n.trim().length > 0)).toBe(true)
  })
})
