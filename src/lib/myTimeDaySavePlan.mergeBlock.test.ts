/**
 * Regression for mixed punch/salary merge controls. Manual QA: (1) mid-row split then merge within
 * that row enables buttons and save; (2) cross-row merge into one segment is allowed when affine
 * partition onto rows is feasible; (3) infeasible short span stays blocked.
 */
import { describe, expect, it } from 'vitest'
import {
  myTimeClusterMergeWouldBlockPersist,
  myTimeClusterSpanningSaveBlockedByRpcMetadata,
  myTimeMergePersistBlockTitle,
} from './myTimeDaySavePlan'
import type { DayEditorSession } from './myTimeDayTimeline'
import { MIN_SEGMENT_MS } from './myTimeDayTimeline'

function mk(
  id: string,
  inMs: number,
  outMs: number | null,
  origin: string,
  sal: number | null
): DayEditorSession {
  return {
    id,
    clocked_in_at: new Date(inMs).toISOString(),
    clocked_out_at: outMs != null ? new Date(outMs).toISOString() : null,
    work_date: '2026-01-01',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin,
    salary_segment_index: sal,
  }
}

describe('myTimeClusterMergeWouldBlockPersist', () => {
  const nowMs = 20_000_000
  const openLastCluster = false

  it('allows merge within one DB row on mixed punch/salary (mid-row split)', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const mid = 1_800_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const split = {
      boundaries: [0, mid, join, hi],
      notes: ['s0', 's1', 's2'],
    }
    expect(
      myTimeClusterMergeWouldBlockPersist(c, split, {
        type: 'removeSegmentMergeWithNext',
        segIndex: 0,
        nowMs,
        openLastCluster,
      })
    ).toBe(false)
    expect(
      myTimeClusterMergeWouldBlockPersist(c, split, {
        type: 'removeSegmentMergeWithPrev',
        segIndex: 1,
        nowMs,
        openLastCluster,
      })
    ).toBe(false)
  })

  it('allows merge that collapses to one segment across two mixed-metadata rows when partition is feasible', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const split = {
      boundaries: [0, join, hi],
      notes: ['row0', 'row1'],
    }
    expect(
      myTimeClusterMergeWouldBlockPersist(c, split, {
        type: 'removeSegmentMergeWithNext',
        segIndex: 0,
        nowMs,
        openLastCluster,
      })
    ).toBe(false)
    expect(
      myTimeClusterMergeWouldBlockPersist(c, split, {
        type: 'removeSegmentMergeWithPrev',
        segIndex: 1,
        nowMs,
        openLastCluster,
      })
    ).toBe(false)
  })

  it('allows intermediate merge on three mixed-metadata rows (1 seg per row) when hull partition is feasible', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const c = [
      mk('a', 0, j1, 'salary_schedule', 1),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, j1, j2, hi],
      notes: ['r0', 'r1', 'r2'],
    }
    expect(
      myTimeClusterMergeWouldBlockPersist(c, split, {
        type: 'removeSegmentMergeWithNext',
        segIndex: 0,
        nowMs,
        openLastCluster,
      })
    ).toBe(false)
    expect(
      myTimeMergePersistBlockTitle(c, split, nowMs, openLastCluster, 'next', 0)
    ).toBeUndefined()
  })

  it('allows intermediate merge when open-last trailing slice is below MIN (strict partition) but hull is otherwise OK', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const slip = j1 + 30_000
    const nowMs = j2 + Math.floor(MIN_SEGMENT_MS / 2)
    const openLastCluster = true
    const c = [
      mk('a', 0, j1, 'salary_schedule', 1),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, null, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, slip, j2, nowMs],
      notes: ['s0', 's1', 's2'],
    }
    expect(
      myTimeClusterMergeWouldBlockPersist(c, split, {
        type: 'removeSegmentMergeWithNext',
        segIndex: 0,
        nowMs,
        openLastCluster,
      })
    ).toBe(false)
    expect(
      myTimeMergePersistBlockTitle(c, split, nowMs, openLastCluster, 'next', 0)
    ).toBeUndefined()
  })

  it('blocks spanning save for mixed two-row cluster when single segment cannot be partitioned', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const split = {
      boundaries: [0, MIN_SEGMENT_MS],
      notes: ['x'],
    }
    expect(myTimeClusterSpanningSaveBlockedByRpcMetadata(c, split, nowMs)).toBe(true)
  })
})
