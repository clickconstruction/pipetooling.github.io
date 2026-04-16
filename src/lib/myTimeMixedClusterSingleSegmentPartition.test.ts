import { describe, expect, it } from 'vitest'
import { partitionMixedClusterSingleSegmentToRowIntervals } from './myTimeMixedClusterSingleSegmentPartition'
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

describe('partitionMixedClusterSingleSegmentToRowIntervals', () => {
  const nowMs = 50_000_000

  it('maps full hull 1:1 for two closed rows (identity scale)', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const p = partitionMixedClusterSingleSegmentToRowIntervals(c, 0, hi, nowMs)
    expect(p).not.toBeNull()
    expect(p!.map((x) => [x.clockedInMs, x.clockedOutMs])).toEqual([
      [0, join],
      [join, hi],
    ])
  })

  it('expands span proportionally for two rows', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const newHi = 10_800_000
    const p = partitionMixedClusterSingleSegmentToRowIntervals(c, 0, newHi, nowMs)
    expect(p).not.toBeNull()
    expect(p![0]).toEqual({ clockedInMs: 0, clockedOutMs: 5_400_000 })
    expect(p![1]).toEqual({ clockedInMs: 5_400_000, clockedOutMs: newHi })
  })

  it('partitions three rows with internal seams', () => {
    const t0 = 1_000_000
    const j1 = t0 + 3_600_000
    const j2 = j1 + 3_600_000
    const hi = j2 + 3_600_000
    const c = [
      mk('a', t0, j1, 'salary_schedule', 1),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const T0 = t0
    const T1 = hi + 3_600_000
    const p = partitionMixedClusterSingleSegmentToRowIntervals(c, T0, T1, nowMs)
    expect(p).not.toBeNull()
    expect(p!.length).toBe(3)
    expect(p![0]!.clockedInMs).toBe(T0)
    expect(p![2]!.clockedOutMs).toBe(T1)
    let prev = T0
    for (const row of p!) {
      expect(row.clockedInMs).toBeGreaterThanOrEqual(prev)
           if (row.clockedOutMs != null) {
        expect(row.clockedOutMs - row.clockedInMs).toBeGreaterThanOrEqual(MIN_SEGMENT_MS)
        prev = row.clockedOutMs
      }
    }
  })

  it('returns null when a row slice would be below MIN_SEGMENT_MS', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    const barely = MIN_SEGMENT_MS * 2 - 1
    expect(partitionMixedClusterSingleSegmentToRowIntervals(c, 0, barely, nowMs)).toBeNull()
  })

  it('handles open last row with T_end null', () => {
    const join = 3_600_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, null, 'user_punch', null),
    ]
    const p = partitionMixedClusterSingleSegmentToRowIntervals(c, 0, null, nowMs)
    expect(p).not.toBeNull()
    expect(p![0]!.clockedOutMs).toBe(join)
    expect(p![1]!.clockedInMs).toBe(join)
    expect(p![1]!.clockedOutMs).toBeNull()
  })

  it('open last: strict rejects short trailing slice; relaxed option allows feasibility check', () => {
    const j1 = 3_600_000
    const c = [
      mk('a', 0, j1, 'salary_schedule', 1),
      mk('b', j1, null, 'user_punch', null),
    ]
    const shortNow = j1 + Math.floor(MIN_SEGMENT_MS / 2)
    expect(partitionMixedClusterSingleSegmentToRowIntervals(c, 0, null, shortNow)).toBeNull()
    const relaxed = partitionMixedClusterSingleSegmentToRowIntervals(c, 0, null, shortNow, {
      skipOpenTrailingMinCheck: true,
    })
    expect(relaxed).not.toBeNull()
    expect(relaxed![1]!.clockedOutMs).toBeNull()
  })

  it('returns null when T_end null but last row is closed', () => {
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      mk('a', 0, join, 'salary_schedule', 1),
      mk('b', join, hi, 'user_punch', null),
    ]
    expect(partitionMixedClusterSingleSegmentToRowIntervals(c, 0, null, nowMs)).toBeNull()
  })
})
