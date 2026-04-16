import { describe, expect, it } from 'vitest'
import {
  everySegmentFullyInsideSomeRow,
  mixedClusterSegmentsAllowPerRowPersist,
} from './myTimeDaySavePlan'
import { everySegmentAssignablePerRowOrdered, type DayEditorSession } from './myTimeDayTimeline'

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

describe('everySegmentAssignablePerRowOrdered', () => {
  const nowMs = 20_000_000

  it('passes after seam moves when containment in old row intervals fails', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const tSeam = join + 120_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const split = {
      boundaries: [0, tSeam, hi],
      notes: ['a', 'b'],
    }
    expect(everySegmentFullyInsideSomeRow(c, split, nowMs)).toBe(false)
    expect(everySegmentAssignablePerRowOrdered(c, split, nowMs)).toBe(true)
    expect(mixedClusterSegmentsAllowPerRowPersist(c, split, nowMs)).toBe(true)
  })

  it('fails when a segment leaves the cluster hull', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const split = {
      boundaries: [-60_000, join, hi],
      notes: ['a', 'b'],
    }
    expect(everySegmentAssignablePerRowOrdered(c, split, nowMs)).toBe(false)
  })
})

describe('mixedClusterSegmentsAllowPerRowPersist', () => {
  const nowMs = 20_000_000

  it('returns false when fewer editor segments than DB rows (coalesced path must persist)', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const c = [
      mk('a', 0, j1, 'salary_schedule', 1),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, j1, hi],
      notes: ['s0', 's1'],
    }
    expect(mixedClusterSegmentsAllowPerRowPersist(c, split, nowMs)).toBe(false)
  })
})
