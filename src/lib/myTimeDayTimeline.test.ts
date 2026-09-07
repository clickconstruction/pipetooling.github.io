import { describe, expect, it } from 'vitest'
import {
  CLOCK_OVERLAP_WARNING_EPS_MS,
  CLUSTER_CONTIGUITY_EPS_MS,
  MIN_SEGMENT_MS,
  ROW_JOIN_SNAP_MS,
  boundariesMatchOriginalRows,
  buildDayTimeline,
  cloneSplitState,
  clusterIsHomogeneousJobBid,
  clusterReferenceBoundaries,
  clusterSharesClockSessionClusterRpcMetadata,
  daySpanMs,
  everySegmentAssignablePerRowOrdered,
  expandClustersSplitPairwiseOverlaps,
  finalizeInnerBoundaryMsForCluster,
  getNextSessionClusterInTimeline,
  groupContiguousSessionClusters,
  groupTimeContiguousSessionClusters,
  hasPairwiseClockIntervalOverlap,
  initialClusterSplitState,
  initialSplitState,
  internalRowJoinMs,
  mergeSegmentNotes,
  normalizeDayEditorSession,
  repairMixedClusterSplitForRowContainment,
  sameJobBid,
  segmentContainedInRow,
  segmentIntervalsMeetMinMs,
  sessionClusterId,
  sessionRowIntervalMs,
  snapBoundaryMs,
  snapTapMsToNearestJoin,
  splitReducer,
  timeClusterMergeAllowed,
  type DayEditorSession,
  type SplitEditorState,
} from './myTimeDayTimeline'

/** All times are on 2026-09-01 (UTC); `T('08:00')` is 08:00Z as epoch ms. */
const T = (hhmm: string, s = 0) => new Date(`2026-09-01T${hhmm}:${String(s).padStart(2, '0')}.000Z`).getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = T('20:00')
const H = 3600 * 1000
const MIN = 60 * 1000

function row(
  id: string,
  inMs: number,
  outMs: number | null,
  extra: Partial<DayEditorSession> = {},
): DayEditorSession {
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

describe('constants and normalisation', () => {
  it('pins the geometry constants the editor is built on', () => {
    expect(MIN_SEGMENT_MS).toBe(36_000) // 0.01 h
    expect(CLUSTER_CONTIGUITY_EPS_MS).toBe(1_000)
    expect(ROW_JOIN_SNAP_MS).toBe(60_000)
    expect(CLOCK_OVERLAP_WARNING_EPS_MS).toBe(60_000)
  })
  it('normalizeDayEditorSession defaults origin and segment index', () => {
    const s = normalizeDayEditorSession({ id: 'x', clocked_in_at: iso(T('08:00')), clocked_out_at: null, work_date: '2026-09-01', notes: '', job_ledger_id: null, bid_id: null, approved_at: null })
    expect(s.origin).toBe('user_punch')
    expect(s.salary_segment_index).toBeNull()
    expect(normalizeDayEditorSession({ ...s, origin: 'salary_schedule', salary_segment_index: 2 })).toMatchObject({ origin: 'salary_schedule', salary_segment_index: 2 })
  })
})

describe('snapping', () => {
  it('snapBoundaryMs clamps to the minimum segment on both sides, then snaps to a join inside the radius', () => {
    const prev = T('08:00')
    const next = T('12:00')
    expect(snapBoundaryMs(T('07:00'), prev, next, [], ROW_JOIN_SNAP_MS)).toBe(prev + MIN_SEGMENT_MS)
    expect(snapBoundaryMs(T('13:00'), prev, next, [], ROW_JOIN_SNAP_MS)).toBe(next - MIN_SEGMENT_MS)
    expect(snapBoundaryMs(T('10:00', 30), prev, next, [T('10:00')], ROW_JOIN_SNAP_MS)).toBe(T('10:00'))
    expect(snapBoundaryMs(T('10:05'), prev, next, [T('10:00')], ROW_JOIN_SNAP_MS)).toBe(T('10:05'))
    // nearest join wins when two are in range
    expect(snapBoundaryMs(T('10:00', 40), prev, next, [T('10:00'), T('10:01')], ROW_JOIN_SNAP_MS)).toBe(T('10:01'))
    // a join that sits inside the minimum-segment zone is clamped back out
    expect(snapBoundaryMs(prev + 5_000, prev, next, [prev], ROW_JOIN_SNAP_MS)).toBe(prev + MIN_SEGMENT_MS)
  })
  it('snapTapMsToNearestJoin snaps only inside the radius and never clamps', () => {
    expect(snapTapMsToNearestJoin(T('10:00', 20), [T('10:00')], ROW_JOIN_SNAP_MS)).toBe(T('10:00'))
    expect(snapTapMsToNearestJoin(T('10:02'), [T('10:00')], ROW_JOIN_SNAP_MS)).toBe(T('10:02'))
    expect(snapTapMsToNearestJoin(T('10:02'), [], ROW_JOIN_SNAP_MS)).toBe(T('10:02'))
  })
})

describe('clustering', () => {
  it('timeClusterMergeAllowed: closed row, next starts within 1 s either side of its end', () => {
    const a = row('a', T('08:00'), T('12:00'))
    expect(timeClusterMergeAllowed(a, row('b', T('12:00'), T('13:00')))).toBe(true)
    expect(timeClusterMergeAllowed(a, row('b', T('12:00', 1), T('13:00')))).toBe(true)
    expect(timeClusterMergeAllowed(a, row('b', T('12:00', 2), T('13:00')))).toBe(false)
    expect(timeClusterMergeAllowed(a, row('b', T('11:59', 59), T('13:00')))).toBe(true) // 1 s overlap noise
    expect(timeClusterMergeAllowed(a, row('b', T('11:59'), T('13:00')))).toBe(false) // real overlap
    expect(timeClusterMergeAllowed(row('open', T('08:00'), null), row('b', T('12:00'), null))).toBe(false)
  })

  it('sameJobBid compares both ids', () => {
    expect(sameJobBid(row('a', 0, 1, { job_ledger_id: 'J' }), row('b', 0, 1, { job_ledger_id: 'J' }))).toBe(true)
    expect(sameJobBid(row('a', 0, 1, { job_ledger_id: 'J' }), row('b', 0, 1, { bid_id: 'B' }))).toBe(false)
  })

  it('groupContiguousSessionClusters needs the same job; the time-only grouping does not; an open row ends its cluster', () => {
    const rows = [
      row('a', T('08:00'), T('10:00'), { job_ledger_id: 'J1' }),
      row('b', T('10:00'), T('12:00'), { job_ledger_id: 'J2' }),
      row('c', T('12:00'), null, { job_ledger_id: 'J2' }),
      row('d', T('13:00'), T('14:00'), { job_ledger_id: 'J2' }),
    ]
    expect(groupContiguousSessionClusters(rows).map((c) => c.map((s) => s.id))).toEqual([['a'], ['b', 'c'], ['d']])
    expect(groupTimeContiguousSessionClusters(rows).map((c) => c.map((s) => s.id))).toEqual([['a', 'b', 'c'], ['d']])
  })

  it('clusterReferenceBoundaries: single, multi (join = later of out / next in), open last uses now', () => {
    expect(clusterReferenceBoundaries([row('a', T('08:00'), T('12:00'))], NOW)).toEqual([T('08:00'), T('12:00')])
    expect(clusterReferenceBoundaries([row('a', T('08:00'), null)], NOW)).toEqual([T('08:00'), NOW])
    const c = [row('a', T('08:00'), T('10:00', 1)), row('b', T('10:00'), T('12:00')), row('c', T('12:00'), null)]
    expect(clusterReferenceBoundaries(c, NOW)).toEqual([T('08:00'), T('10:00', 1), T('12:00'), NOW])
    expect(internalRowJoinMs(c, NOW)).toEqual([T('10:00', 1), T('12:00')])
    expect(internalRowJoinMs([c[0]!], NOW)).toEqual([])
    expect(clusterReferenceBoundaries([], NOW)).toEqual([])
  })

  it('boundariesMatchOriginalRows tolerates 1 s, not more, and never a different count', () => {
    const c = [row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00'))]
    const ok: SplitEditorState = { boundaries: [T('08:00'), T('10:00', 1), T('12:00')], notes: ['', ''] }
    expect(boundariesMatchOriginalRows(c, ok, NOW)).toBe(true)
    expect(boundariesMatchOriginalRows(c, { boundaries: [T('08:00'), T('10:00', 2), T('12:00')], notes: ['', ''] }, NOW)).toBe(false)
    expect(boundariesMatchOriginalRows(c, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW)).toBe(false)
  })

  it('homogeneity and RPC metadata sharing', () => {
    const punch = [row('a', T('08:00'), T('10:00'), { job_ledger_id: 'J' }), row('b', T('10:00'), T('12:00'), { job_ledger_id: 'J' })]
    expect(clusterIsHomogeneousJobBid(punch)).toBe(true)
    expect(clusterIsHomogeneousJobBid([punch[0]!, row('c', 0, 1, { bid_id: 'B' })])).toBe(false)
    expect(clusterSharesClockSessionClusterRpcMetadata(punch)).toBe(true)
    expect(clusterSharesClockSessionClusterRpcMetadata([punch[0]!, salary('s', T('10:00'), T('12:00'), 1)])).toBe(false)
    expect(clusterSharesClockSessionClusterRpcMetadata([salary('s1', 0, 1, 1), salary('s2', 1, 2, 2)])).toBe(false)
    expect(clusterSharesClockSessionClusterRpcMetadata([row('a', 0, 1, { salary_segment_index: null }), row('b', 1, 2, { salary_segment_index: undefined as unknown as null })])).toBe(true)
    expect(clusterSharesClockSessionClusterRpcMetadata([])).toBe(true)
  })
})

describe('overlap', () => {
  it('sessionRowIntervalMs uses now for an open row', () => {
    expect(sessionRowIntervalMs(row('a', T('08:00'), null), NOW)).toEqual({ lo: T('08:00'), hi: NOW })
  })
  it('hasPairwiseClockIntervalOverlap: 1 s tolerance for geometry, 60 s for user-facing warnings', () => {
    const thirtySec = [row('a', T('08:00'), T('10:00', 30)), row('b', T('10:00'), T('12:00'))]
    expect(hasPairwiseClockIntervalOverlap(thirtySec, NOW)).toBe(true)
    expect(hasPairwiseClockIntervalOverlap(thirtySec, NOW, CLOCK_OVERLAP_WARNING_EPS_MS)).toBe(false)
    expect(hasPairwiseClockIntervalOverlap([row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00'))], NOW)).toBe(false)
    expect(hasPairwiseClockIntervalOverlap([row('a', T('08:00'), null), row('b', T('09:00'), null)], NOW)).toBe(true)
    expect(hasPairwiseClockIntervalOverlap([row('a', T('08:00'), null)], NOW)).toBe(false)
  })
  it('expandClustersSplitPairwiseOverlaps breaks only the overlapping cluster into singletons', () => {
    const clean = [row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00'))]
    const messy = [row('c', T('13:00'), T('15:00')), row('d', T('14:00'), T('16:00'))]
    expect(expandClustersSplitPairwiseOverlaps([clean, messy], NOW).map((c) => c.map((s) => s.id))).toEqual([['a', 'b'], ['c'], ['d']])
  })
})

describe('segment geometry', () => {
  it('segmentContainedInRow allows 1 s slop', () => {
    expect(segmentContainedInRow(T('08:00'), T('10:00'), T('08:00'), T('10:00'))).toBe(true)
    expect(segmentContainedInRow(T('07:59', 59), T('10:00', 1), T('08:00'), T('10:00'))).toBe(true)
    expect(segmentContainedInRow(T('07:59', 58), T('10:00'), T('08:00'), T('10:00'))).toBe(false)
  })

  it('everySegmentAssignablePerRowOrdered: one segment per row, each ≥ min, all inside the hull', () => {
    const c = [row('a', T('08:00'), T('10:00')), salary('b', T('10:00'), T('12:00'), 1)]
    expect(everySegmentAssignablePerRowOrdered(c, { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }, NOW)).toBe(true) // seam moved, still inside hull
    expect(everySegmentAssignablePerRowOrdered(c, { boundaries: [T('08:00'), T('12:00')], notes: [''] }, NOW)).toBe(false) // count mismatch
    expect(everySegmentAssignablePerRowOrdered(c, { boundaries: [T('08:00'), T('11:00'), T('12:30')], notes: ['', ''] }, NOW)).toBe(false) // leaves the hull
    expect(everySegmentAssignablePerRowOrdered(c, { boundaries: [T('08:00'), T('08:00', 10), T('12:00')], notes: ['', ''] }, NOW)).toBe(false) // 10 s segment
  })

  it('segmentIntervalsMeetMinMs treats the open last segment against now', () => {
    expect(segmentIntervalsMeetMinMs([T('08:00'), T('09:00')], NOW, false)).toBe(true)
    expect(segmentIntervalsMeetMinMs([T('08:00'), T('08:00', 10)], NOW, false)).toBe(false)
    // open last segment: measured from its start to now, its stored end is ignored
    expect(segmentIntervalsMeetMinMs([NOW - 10_000, NOW], NOW, true)).toBe(false)
    expect(segmentIntervalsMeetMinMs([T('08:00'), T('08:00', 10)], NOW, true)).toBe(true)
    expect(segmentIntervalsMeetMinMs([T('08:00')], NOW, false)).toBe(false)
  })
})

describe('finalizeInnerBoundaryMsForCluster', () => {
  const punchA = row('a', T('08:00'), T('10:00'))
  const salB = salary('b', T('10:00'), T('12:00'), 1)
  const salC = salary('c', T('12:00'), T('16:00'), 2)

  it('homogeneous cluster: clamp, then soft-snap to a row join within 60 s', () => {
    const c = [row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00')), row('c', T('12:00'), T('16:00'))]
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('16:00'), T('10:00', 30), NOW)).toBe(T('10:00'))
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('16:00'), T('10:05'), NOW)).toBe(T('10:05'))
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('16:00'), T('07:00'), NOW)).toBe(T('08:00') + MIN_SEGMENT_MS)
  })

  it('mixed cluster: a boundary that straddles rows on both sides jumps to the nearest row join', () => {
    const c = [punchA, salB, salC]
    // 11:00 is 1 h from both joins; the earlier one wins the tie
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('16:00'), T('11:00'), NOW)).toBe(T('10:00'))
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('16:00'), T('11:30'), NOW)).toBe(T('12:00'))
  })

  it('mixed cluster: a seam between two consecutive rows may slide along the hull', () => {
    const c = [punchA, salB]
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('12:00'), T('10:30'), NOW)).toBe(T('10:30'))
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('12:00'), T('09:30'), NOW)).toBe(T('09:30'))
  })

  it('mixed cluster: a split inside one row stays inside that row', () => {
    const c = [punchA, salB]
    expect(finalizeInnerBoundaryMsForCluster(c, T('08:00'), T('10:00'), T('09:00'), NOW)).toBe(T('09:00'))
  })
})

describe('repairMixedClusterSplitForRowContainment', () => {
  it('returns the same state for homogeneous clusters and for mixed clusters that already fit', () => {
    const homo = [row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00'))]
    const split: SplitEditorState = { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['', ''] }
    expect(repairMixedClusterSplitForRowContainment(homo, split, NOW)).toBe(split)
    const mixed = [row('a', T('08:00'), T('10:00')), salary('b', T('10:00'), T('12:00'), 1)]
    const fits: SplitEditorState = { boundaries: [T('08:00'), T('09:00'), T('10:00'), T('12:00')], notes: ['', '', ''] }
    expect(repairMixedClusterSplitForRowContainment(mixed, fits, NOW)).toBe(fits)
  })
  it('nudges a straddling inner boundary onto the row join', () => {
    const mixed = [row('a', T('08:00'), T('10:00')), salary('b', T('10:00'), T('12:00'), 1), salary('c', T('12:00'), T('16:00'), 2)]
    const bad: SplitEditorState = { boundaries: [T('08:00'), T('11:00'), T('16:00')], notes: ['x', 'y'] }
    const out = repairMixedClusterSplitForRowContainment(mixed, bad, NOW)
    expect(out.boundaries).toEqual([T('08:00'), T('10:00'), T('16:00')])
    expect(out.notes).toEqual(['x', 'y'])
  })
})

describe('timeline', () => {
  it('buildDayTimeline: one block per contiguous strip, a gap only when the hole exceeds 1 s, open last runs to now', () => {
    const rows = [
      row('a', T('08:00'), T('10:00')),
      row('b', T('10:00', 1), T('12:00')),
      row('c', T('13:00'), null),
    ]
    const items = buildDayTimeline(rows, NOW)
    expect(items.map((i) => i.type)).toEqual(['sessionCluster', 'gap', 'sessionCluster'])
    expect(items[0]).toMatchObject({ clusterId: 'a|b', startMs: T('08:00'), endMs: T('12:00') })
    expect(items[1]).toEqual({ type: 'gap', startMs: T('12:00'), endMs: T('13:00') })
    expect(items[2]).toMatchObject({ clusterId: 'c', startMs: T('13:00'), endMs: NOW })
    expect(getNextSessionClusterInTimeline(items, 0)?.clusterId).toBe('c')
    expect(getNextSessionClusterInTimeline(items, 2)).toBeNull()
    expect(sessionClusterId(rows)).toBe('a|b|c')
  })
  it('rows that overlap by more than 1 s never share a block, with or without the overlap option', () => {
    // The contiguity rule already refuses a merge when the next row starts before the last one
    // ended, so overlapping rows are separate blocks; the option only guards clusters built elsewhere.
    const rows = [row('a', T('08:00'), T('10:00')), row('b', T('09:00'), T('11:00'))]
    const ids = (items: ReturnType<typeof buildDayTimeline>) => items.map((i) => (i.type === 'sessionCluster' ? i.clusterId : 'gap'))
    expect(ids(buildDayTimeline(rows, NOW))).toEqual(['a', 'b'])
    expect(ids(buildDayTimeline(rows, NOW, { splitClustersWithPairwiseOverlap: true }))).toEqual(['a', 'b'])
    const clean = [row('a', T('08:00'), T('10:00')), row('b', T('10:00'), T('12:00'))]
    expect(ids(buildDayTimeline(clean, NOW, { splitClustersWithPairwiseOverlap: true }))).toEqual(['a|b'])
  })
  it('daySpanMs', () => {
    expect(daySpanMs([], NOW)).toEqual({ dayStartMs: 0, dayEndMs: 1 })
    expect(daySpanMs([row('a', T('08:00'), T('10:00')), row('b', T('13:00'), null)], NOW)).toEqual({ dayStartMs: T('08:00'), dayEndMs: NOW })
    expect(daySpanMs([row('z', T('08:00'), T('08:00'))], NOW)).toEqual({ dayStartMs: T('08:00'), dayEndMs: T('08:00') + 1 })
  })
})

describe('split state', () => {
  it('initialSplitState / initialClusterSplitState seed one segment per row with trimmed notes', () => {
    expect(initialSplitState(row('a', T('08:00'), null, { notes: '  hi  ' }), NOW)).toEqual({ boundaries: [T('08:00'), NOW], notes: ['hi'] })
    const c = [row('a', T('08:00'), T('10:00'), { notes: 'one' }), row('b', T('10:00'), T('12:00'), { notes: '' })]
    expect(initialClusterSplitState(c, NOW)).toEqual({ boundaries: [T('08:00'), T('10:00'), T('12:00')], notes: ['one', ''] })
    expect(initialClusterSplitState([], NOW)).toEqual({ boundaries: [], notes: [] })
  })
  it('cloneSplitState copies arrays and drops an empty override map', () => {
    const s: SplitEditorState = { boundaries: [1, 2], notes: ['a'], segmentJobOverrides: {} }
    const c = cloneSplitState(s)
    expect(c).toEqual({ boundaries: [1, 2], notes: ['a'] })
    expect(c.boundaries).not.toBe(s.boundaries)
    expect(cloneSplitState({ ...s, segmentJobOverrides: { 0: { job_ledger_id: 'J', bid_id: null } } }).segmentJobOverrides).toEqual({ 0: { job_ledger_id: 'J', bid_id: null } })
  })
  it('mergeSegmentNotes keeps the absorber first, drops duplicate paragraphs, tolerates blanks', () => {
    expect(mergeSegmentNotes('', 'b')).toBe('b')
    expect(mergeSegmentNotes('a', '')).toBe('a')
    expect(mergeSegmentNotes('same', ' same ')).toBe('same')
    expect(mergeSegmentNotes('a\n\nb', 'b\n\nc')).toBe('a\n\nb\n\nc')
    expect(mergeSegmentNotes('a', 'b')).toBe('a\n\nb')
  })
})

describe('splitReducer', () => {
  const base = (): SplitEditorState => ({ boundaries: [T('08:00'), T('12:00')], notes: ['n'] })

  it('drag and nudge clamp to the minimum segment and clear job overrides', () => {
    const s: SplitEditorState = { boundaries: [T('08:00'), T('10:00'), T('12:00')], notes: ['a', 'b'], segmentJobOverrides: { 1: { job_ledger_id: 'J', bid_id: null } } }
    const dragged = splitReducer(s, { type: 'drag', index: 1, ms: T('07:00') })
    expect(dragged.boundaries[1]).toBe(T('08:00') + MIN_SEGMENT_MS)
    expect(dragged.segmentJobOverrides).toBeUndefined()
    const nudged = splitReducer(s, { type: 'nudge', index: 1, deltaMs: 5 * H })
    expect(nudged.boundaries[1]).toBe(T('12:00') - MIN_SEGMENT_MS)
    expect(splitReducer(s, { type: 'nudge', index: 1, deltaMs: 15 * MIN }).boundaries[1]).toBe(T('10:15'))
  })

  it('addSplit halves the longest segment, copies its note, and shifts later overrides', () => {
    const s: SplitEditorState = { boundaries: [T('08:00'), T('09:00'), T('12:00')], notes: ['a', 'b'], segmentJobOverrides: { 0: { job_ledger_id: 'J0', bid_id: null }, 1: { job_ledger_id: 'J1', bid_id: null } } }
    const out = splitReducer(s, { type: 'addSplit', minSegmentMs: MIN_SEGMENT_MS })
    expect(out.boundaries).toEqual([T('08:00'), T('09:00'), T('10:30'), T('12:00')])
    expect(out.notes).toEqual(['a', 'b', 'b'])
    expect(out.segmentJobOverrides).toEqual({ 0: { job_ledger_id: 'J0', bid_id: null }, 1: { job_ledger_id: 'J1', bid_id: null } })
    const s2: SplitEditorState = { boundaries: [T('08:00'), T('11:00'), T('12:00')], notes: ['a', 'b'], segmentJobOverrides: { 1: { job_ledger_id: 'J1', bid_id: null } } }
    expect(splitReducer(s2, { type: 'addSplit', minSegmentMs: MIN_SEGMENT_MS }).segmentJobOverrides).toEqual({ 2: { job_ledger_id: 'J1', bid_id: null } })
    const tiny: SplitEditorState = { boundaries: [T('08:00'), T('08:00', 50)], notes: ['a'] }
    expect(splitReducer(tiny, { type: 'addSplit', minSegmentMs: MIN_SEGMENT_MS })).toBe(tiny)
  })

  it('addSplitAt ignores taps within ε of a boundary or that would leave a sub-minimum piece', () => {
    const s = base()
    expect(splitReducer(s, { type: 'addSplitAt', ms: T('10:00') }).boundaries).toEqual([T('08:00'), T('10:00'), T('12:00')])
    expect(splitReducer(s, { type: 'addSplitAt', ms: T('08:00') + 500 })).toBe(s)
    expect(splitReducer(s, { type: 'addSplitAt', ms: T('08:00') + 20_000 })).toBe(s)
    expect(splitReducer(s, { type: 'addSplitAt', ms: T('13:00') })).toBe(s)
  })

  it('addSplitMidInSegment splits at the midpoint, snapping to a join within 60 s', () => {
    const s = base()
    expect(splitReducer(s, { type: 'addSplitMidInSegment', segIndex: 0, joinTargets: [] }).boundaries).toEqual([T('08:00'), T('10:00'), T('12:00')])
    expect(splitReducer(s, { type: 'addSplitMidInSegment', segIndex: 0, joinTargets: [T('10:00', 45)] }).boundaries).toEqual([T('08:00'), T('10:00', 45), T('12:00')])
    expect(splitReducer(s, { type: 'addSplitMidInSegment', segIndex: 0, joinTargets: [T('10:05')] }).boundaries).toEqual([T('08:00'), T('10:00'), T('12:00')])
    expect(splitReducer(s, { type: 'addSplitMidInSegment', segIndex: 3, joinTargets: [] })).toBe(s)
  })

  it('setNote, setLastBoundary, setSegmentJobOverride', () => {
    const s = base()
    expect(splitReducer(s, { type: 'setNote', index: 0, text: 'z' }).notes).toEqual(['z'])
    expect(splitReducer(s, { type: 'setLastBoundary', nowMs: NOW }).boundaries).toEqual([T('08:00'), NOW])
    expect(splitReducer(s, { type: 'setSegmentJobOverride', segIndex: 0, job_ledger_id: 'J', bid_id: null }).segmentJobOverrides).toEqual({ 0: { job_ledger_id: 'J', bid_id: null } })
    expect(splitReducer(s, { type: 'setSegmentJobOverride', segIndex: 1, job_ledger_id: 'J', bid_id: null })).toBe(s)
  })

  it('merging with the previous segment keeps the earlier note first; merging with next puts the later note first', () => {
    const s: SplitEditorState = { boundaries: [T('08:00'), T('10:00'), T('12:00')], notes: ['a', 'b'] }
    const prev = splitReducer(s, { type: 'removeSegmentMergeWithPrev', segIndex: 1, nowMs: NOW, openLastCluster: false })
    expect(prev).toEqual({ boundaries: [T('08:00'), T('12:00')], notes: ['a\n\nb'], segmentJobOverrides: undefined })
    const next = splitReducer(s, { type: 'removeSegmentMergeWithNext', segIndex: 0, nowMs: NOW, openLastCluster: false })
    expect(next.notes).toEqual(['b\n\na'])
    expect(splitReducer(s, { type: 'removeSegmentMergeWithPrev', segIndex: 0, nowMs: NOW, openLastCluster: false })).toBe(s)
    expect(splitReducer(s, { type: 'removeSegmentMergeWithNext', segIndex: 1, nowMs: NOW, openLastCluster: false })).toBe(s)
  })

  it('merging drops the overrides of both merged segments and shifts the rest down', () => {
    const s: SplitEditorState = {
      boundaries: [T('08:00'), T('09:00'), T('10:00'), T('12:00')],
      notes: ['a', 'b', 'c'],
      segmentJobOverrides: { 0: { job_ledger_id: 'J0', bid_id: null }, 1: { job_ledger_id: 'J1', bid_id: null }, 2: { job_ledger_id: 'J2', bid_id: null } },
    }
    expect(splitReducer(s, { type: 'removeSegmentMergeWithPrev', segIndex: 1, nowMs: NOW, openLastCluster: false }).segmentJobOverrides).toEqual({ 1: { job_ledger_id: 'J2', bid_id: null } })
    expect(splitReducer(s, { type: 'removeSegmentMergeWithNext', segIndex: 1, nowMs: NOW, openLastCluster: false }).segmentJobOverrides).toEqual({ 0: { job_ledger_id: 'J0', bid_id: null } })
  })

  it('a merge that would leave the open last segment shorter than the minimum is refused', () => {
    const s: SplitEditorState = { boundaries: [T('08:00'), NOW - 10_000, NOW], notes: ['a', 'b'] }
    // merging seg 1 into seg 0 leaves [08:00, NOW]: fine
    expect(splitReducer(s, { type: 'removeSegmentMergeWithPrev', segIndex: 1, nowMs: NOW, openLastCluster: true }).boundaries).toEqual([T('08:00'), NOW])
    const short: SplitEditorState = { boundaries: [NOW - 20_000, NOW - 10_000, NOW], notes: ['a', 'b'] }
    expect(splitReducer(short, { type: 'removeSegmentMergeWithPrev', segIndex: 1, nowMs: NOW, openLastCluster: true })).toBe(short)
  })
})
