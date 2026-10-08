// @vitest-environment jsdom
/**
 * The My Time day editor's split store (map step 7a): the seed and its `sessionsKey`-only re-seed
 * (quirk 3), the open-session tick, the merge guard, the merge-segments job choice and the inner
 * boundary drag, each on the real timeline kernels with the inputs built the way the modal builds them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMemo } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useMyTimeSplitEditor } from './useMyTimeSplitEditor'
import { comparableSplit, sessionJobBidKey } from '../../lib/myTimeDayEditorDirty'
import { myTimeClusterMergeBlockedUserMessage } from '../../lib/myTimeDaySavePlan'
import {
  expandClustersSplitPairwiseOverlaps,
  groupTimeContiguousSessionClusters,
  mergeSegmentNotes,
  type DayEditorSession,
} from '../../lib/myTimeDayTimeline'

const DAY = '2026-10-06'
const at = (hms: string) => `${DAY}T${hms}Z`
const ms = (hms: string) => Date.parse(at(hms))

function row(id: string, inAt: string, outAt: string | null, extra: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: at(inAt),
    clocked_out_at: outAt ? at(outAt) : null,
    work_date: DAY,
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...extra,
  }
}

// Two punches back to back on two jobs (one cluster, `a|b`), then a lone punch after a gap (`c`).
const ROUGH = row('a', '14:00:00', '16:00:00', { job_ledger_id: 'job-1', notes: 'Rough-in' })
const TRIM = row('b', '16:00:00', '18:00:00', { job_ledger_id: 'job-2', notes: 'Trim out' })
const LATE = row('c', '19:00:00', '20:00:00', { notes: 'Walkthrough' })
const NOW = ms('22:00:00')
const JOB_LABELS: Record<string, string> = { 'job-1': 'Smith remodel', 'job-2': 'Lee duplex' }
const NO_LABELS: Record<string, string> = {}

type Props = { sessions: DayEditorSession[]; nowTick: number; allowTimelineEdits?: boolean }

function mount(initialProps: Props) {
  const showToast = vi.fn()
  const hook = renderHook(
    (p: Props) => {
      // Built the way DashboardMyTimeDayEditorModal builds them.
      const sortedSessions = useMemo(
        () => [...p.sessions].sort((x, y) => Date.parse(x.clocked_in_at) - Date.parse(y.clocked_in_at)),
        [p.sessions],
      )
      const sessionsKey = useMemo(
        () =>
          sortedSessions
            .map((s) => `${s.id}:${s.clocked_in_at}:${s.clocked_out_at ?? ''}:${s.approved_at ?? ''}:${s.work_date}`)
            .join('|'),
        [sortedSessions],
      )
      const sessionClusters = useMemo(
        () => expandClustersSplitPairwiseOverlaps(groupTimeContiguousSessionClusters(sortedSessions), p.nowTick),
        [sortedSessions, p.nowTick],
      )
      return useMyTimeSplitEditor({
        sortedSessions,
        sessionsKey,
        sessionClusters,
        nowTick: p.nowTick,
        allowTimelineEdits: p.allowTimelineEdits ?? true,
        mergedJobLabels: JOB_LABELS,
        mergedBidLabels: NO_LABELS,
        showToast,
      })
    },
    { initialProps },
  )
  return { ...hook, showToast }
}

afterEach(cleanup)

describe('useMyTimeSplitEditor', () => {
  it('seeds one split per cluster, the snapshot the dirty gate compares, and each row’s job and bid', () => {
    const { result } = mount({ sessions: [LATE, TRIM, ROUGH], nowTick: NOW })
    expect(Object.keys(result.current.splitByCluster).sort()).toEqual(['a|b', 'c'])
    expect(result.current.splitByCluster['a|b']).toEqual({
      boundaries: [ms('14:00:00'), ms('16:00:00'), ms('18:00:00')],
      notes: ['Rough-in', 'Trim out'],
    })
    expect(result.current.splitByCluster.c).toEqual({ boundaries: [ms('19:00:00'), ms('20:00:00')], notes: ['Walkthrough'] })
    expect(result.current.initialSnapshot).toEqual({
      'a|b': comparableSplit(TRIM, result.current.splitByCluster['a|b']!),
      c: comparableSplit(LATE, result.current.splitByCluster.c!),
    })
    expect(result.current.initialJobBidBySessionIdRef.current).toEqual({
      a: sessionJobBidKey(ROUGH),
      b: sessionJobBidKey(TRIM),
      c: sessionJobBidKey(LATE),
    })
    expect(result.current.mergeJobChoice).toBeNull()
  })

  it('keeps in-editor splits through a job refresh and re-seeds only when the sessions key changes (quirk 3)', () => {
    const { result, rerender } = mount({ sessions: [ROUGH, TRIM, LATE], nowTick: NOW })
    act(() => result.current.patchCluster('c', { type: 'addSplitAt', ms: ms('19:30:00') }))
    expect(result.current.splitByCluster.c!.boundaries).toEqual([ms('19:00:00'), ms('19:30:00'), ms('20:00:00')])

    // A job/bid refresh hands over a new array with the same ids and times: nothing re-seeds.
    rerender({ sessions: [ROUGH, TRIM, { ...LATE, job_ledger_id: 'job-1' }], nowTick: NOW })
    expect(result.current.splitByCluster.c!.boundaries).toHaveLength(3)
    expect(result.current.initialJobBidBySessionIdRef.current.c).toBe(sessionJobBidKey(LATE))

    // A new clock-out time changes the key: the store re-seeds from the rows.
    const moved = { ...LATE, clocked_out_at: at('20:30:00') }
    rerender({ sessions: [ROUGH, TRIM, moved], nowTick: NOW })
    expect(result.current.splitByCluster.c).toEqual({ boundaries: [ms('19:00:00'), ms('20:30:00')], notes: ['Walkthrough'] })
    expect(result.current.initialSnapshot.c).toBe(comparableSplit(moved, result.current.splitByCluster.c!))
  })

  it('moves an open session’s end to each tick without reading as an edit', () => {
    const open = row('d', '21:00:00', null, { notes: 'On site' })
    const { result, rerender } = mount({ sessions: [open], nowTick: ms('21:30:00') })
    expect(result.current.splitByCluster.d!.boundaries).toEqual([ms('21:00:00'), ms('21:30:00')])

    rerender({ sessions: [open], nowTick: ms('21:45:00') })
    expect(result.current.splitByCluster.d!.boundaries).toEqual([ms('21:00:00'), ms('21:45:00')])
    expect(result.current.initialSnapshot.d).toBe(comparableSplit(open, result.current.splitByCluster.d!))
    // The gesture code in the shell reads the store and the clock through these refs.
    expect(result.current.nowTickRef.current).toBe(ms('21:45:00'))
    expect(result.current.splitByClusterRef.current).toBe(result.current.splitByCluster)
    expect(result.current.sessionClustersRef.current.map((c) => c.map((s) => s.id))).toEqual([['d']])
  })

  it('blocks a merge the save could not write, with the toast, and leaves the split alone', () => {
    // A 20-second salary row then a punch: one segment across both rows cannot be split back onto them.
    const salary = row('s', '14:00:00', '14:00:20', { origin: 'salary_schedule', salary_segment_index: 1 })
    const punch = row('p', '14:00:20', '16:00:00')
    const { result, showToast } = mount({ sessions: [salary, punch], nowTick: NOW })
    const before = result.current.splitByCluster['s|p']
    expect(before?.boundaries).toHaveLength(3)

    act(() =>
      result.current.patchCluster('s|p', { type: 'removeSegmentMergeWithNext', segIndex: 0, nowMs: NOW, openLastCluster: false }),
    )
    expect(showToast).toHaveBeenCalledWith(myTimeClusterMergeBlockedUserMessage([salary, punch]), 'error')
    expect(result.current.splitByCluster['s|p']).toBe(before)

    act(() => result.current.openMergeJobChoiceForCluster('s|p', { direction: 'next', segIdx: 0 }))
    expect(showToast).toHaveBeenCalledTimes(2)
    expect(result.current.mergeJobChoice).toBeNull()
  })

  it('Merge down asks which job keeps the time, then merges, sets the job and the trimmed note', () => {
    const { result } = mount({ sessions: [ROUGH, TRIM, LATE], nowTick: NOW })
    act(() => result.current.openMergeJobChoiceForCluster('a|b', { direction: 'next', segIdx: 0 }))
    expect(result.current.mergeJobChoice).toEqual({
      clusterId: 'a|b',
      direction: 'next',
      segIdx: 0,
      openLastCluster: false,
      upperJobLabel: 'Smith remodel',
      lowerJobLabel: 'Lee duplex',
      defaultJobChoice: 'lower',
      upperAlloc: { job_ledger_id: 'job-1', bid_id: null },
      lowerAlloc: { job_ledger_id: 'job-2', bid_id: null },
      initialMergedFocusNote: mergeSegmentNotes('Trim out', 'Rough-in'),
    })

    act(() => result.current.confirmMergeJobChoice('upper', '  Rough-in and trim  '))
    expect(result.current.mergeJobChoice).toBeNull()
    expect(result.current.splitByCluster['a|b']).toEqual({
      boundaries: [ms('14:00:00'), ms('18:00:00')],
      notes: ['Rough-in and trim'],
      segmentJobOverrides: { 0: { job_ledger_id: 'job-1', bid_id: null } },
    })
  })

  it('Merge up defaults to the segment above, and Unassigned clears the job', () => {
    const { result } = mount({ sessions: [ROUGH, TRIM, LATE], nowTick: NOW })
    act(() => result.current.openMergeJobChoiceForCluster('a|b', { direction: 'prev', segIdx: 1 }))
    expect(result.current.mergeJobChoice).toMatchObject({
      direction: 'prev',
      segIdx: 1,
      defaultJobChoice: 'upper',
      initialMergedFocusNote: mergeSegmentNotes('Rough-in', 'Trim out'),
    })

    act(() => result.current.confirmMergeJobChoice('unassigned', ''))
    expect(result.current.splitByCluster['a|b']).toEqual({
      boundaries: [ms('14:00:00'), ms('18:00:00')],
      notes: [''],
      segmentJobOverrides: { 0: { job_ledger_id: null, bid_id: null } },
    })
  })

  it('drags and commits an inner boundary, snapping to the row join, and ignores every edit when the timeline is locked', () => {
    const { result, rerender } = mount({ sessions: [ROUGH, TRIM, LATE], nowTick: NOW })
    act(() => result.current.applyInnerBoundaryDragMs('a|b', 1, ms('15:00:00')))
    expect(result.current.splitByCluster['a|b']!.boundaries).toEqual([ms('14:00:00'), ms('15:00:00'), ms('18:00:00')])

    // 30 seconds off the row join snaps onto it.
    act(() => result.current.commitInnerBoundary('a|b', 1, ms('15:59:30')))
    expect(result.current.splitByCluster['a|b']!.boundaries).toEqual([ms('14:00:00'), ms('16:00:00'), ms('18:00:00')])

    // A commit never moves the cluster's outer ends.
    const before = result.current.splitByCluster['a|b']
    act(() => result.current.commitInnerBoundary('a|b', 0, ms('13:00:00')))
    expect(result.current.splitByCluster['a|b']).toBe(before)

    rerender({ sessions: [ROUGH, TRIM, LATE], nowTick: NOW, allowTimelineEdits: false })
    act(() => {
      result.current.patchCluster('c', { type: 'addSplitAt', ms: ms('19:30:00') })
      result.current.applyInnerBoundaryDragMs('a|b', 1, ms('15:00:00'))
      result.current.commitInnerBoundary('a|b', 1, ms('15:00:00'))
      result.current.openMergeJobChoiceForCluster('a|b', { direction: 'next', segIdx: 0 })
    })
    expect(result.current.splitByCluster['a|b']).toBe(before)
    expect(result.current.splitByCluster.c!.boundaries).toHaveLength(2)
    expect(result.current.mergeJobChoice).toBeNull()
  })
})
