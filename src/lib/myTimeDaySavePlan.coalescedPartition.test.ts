import { describe, expect, it } from 'vitest'
import { coalescedMixedClusterPartitionForSave } from './myTimeDaySavePlan'
import type { DayEditorSession } from './myTimeDayTimeline'

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

describe('coalescedMixedClusterPartitionForSave', () => {
  it('returns intervals + per-row notes when two segments span full mixed hull', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const slip = j1 + 30_000
    const nowMs = hi
    const c = [
      mk('a', 0, j1, 'salary_schedule', 1),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, slip, hi],
      notes: ['morning', 'rest'],
    }
    const r = coalescedMixedClusterPartitionForSave(c, split, split.notes, nowMs)
    expect(r).not.toBeNull()
    expect(r!.intervals.length).toBe(3)
    // Inner boundary snaps to first row seam: seg0 = row0 only, seg1 = rows 1–2.
    expect(r!.rowNotes).toEqual(['morning', 'rest', 'rest'])
  })

  it('2 segs / 3 rows: inner boundary on row1|row2 seam (merged first two editor segments)', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const nowMs = hi
    const c = [
      mk('a', 0, j1, 'user_punch', null),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, j2, hi],
      notes: ['merged punch rows', 'salary'],
    }
    const r = coalescedMixedClusterPartitionForSave(c, split, split.notes, nowMs)
    expect(r).not.toBeNull()
    expect(r!.intervals).toEqual([
      { clockedInMs: 0, clockedOutMs: j1 },
      { clockedInMs: j1, clockedOutMs: j2 },
      { clockedInMs: j2, clockedOutMs: hi },
    ])
    expect(r!.rowNotes).toEqual(['merged punch rows', 'merged punch rows', 'salary'])
  })

  it('2 segs / 3 rows: inner boundary near (within snap) row1|row2 seam still coalesces', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const drift = 45_000
    const nowMs = hi
    const c = [
      mk('a', 0, j1, 'user_punch', null),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, j2 + drift, hi],
      notes: ['merged punch rows', 'salary'],
    }
    const r = coalescedMixedClusterPartitionForSave(c, split, split.notes, nowMs)
    expect(r).not.toBeNull()
    expect(r!.intervals.length).toBe(3)
    expect(r!.rowNotes).toEqual(['merged punch rows', 'merged punch rows', 'salary'])
  })

  it('2 segs / 3 rows: inner boundary on row0|row1 seam (merged last two editor segments)', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const nowMs = hi
    const c = [
      mk('a', 0, j1, 'user_punch', null),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [0, j1, hi],
      notes: ['row0', 'merged row1+salary'],
    }
    const r = coalescedMixedClusterPartitionForSave(c, split, split.notes, nowMs)
    expect(r).not.toBeNull()
    expect(r!.intervals).toEqual([
      { clockedInMs: 0, clockedOutMs: j1 },
      { clockedInMs: j1, clockedOutMs: j2 },
      { clockedInMs: j2, clockedOutMs: hi },
    ])
    expect(r!.rowNotes).toEqual(['row0', 'merged row1+salary', 'merged row1+salary'])
  })

  it('maps each editor segment to its row when segment count equals row count (moved cross-row seam)', () => {
    const t0 = 0
    const t1 = 3_600_000
    const t2 = 7_200_000
    const t3 = 10_800_000
    const slip = t2 + 15 * 60_000
    const nowMs = t3
    const c = [
      mk('d', t0, t1, 'user_punch', null),
      mk('e', t1, t2, 'user_punch', null),
      mk('f', t2, t3, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [t0, t1, slip, t3],
      notes: ['a', 'b', 'c'],
    }
    const r = coalescedMixedClusterPartitionForSave(c, split, split.notes, nowMs)
    expect(r).not.toBeNull()
    expect(r!.intervals).toEqual([
      { clockedInMs: t0, clockedOutMs: t1 },
      { clockedInMs: t1, clockedOutMs: slip },
      { clockedInMs: slip, clockedOutMs: t3 },
    ])
    expect(r!.rowNotes).toEqual(['a', 'b', 'c'])
  })

  it('returns null when inner boundaries do not span full hull', () => {
    const j1 = 3_600_000
    const j2 = 7_200_000
    const hi = 10_800_000
    const nowMs = hi
    const c = [
      mk('a', 0, j1, 'salary_schedule', 1),
      mk('b', j1, j2, 'user_punch', null),
      mk('c', j2, hi, 'salary_schedule', 2),
    ]
    const split = {
      boundaries: [60_000, j1 + 30_000, hi - 60_000],
      notes: ['a', 'b'],
    }
    expect(coalescedMixedClusterPartitionForSave(c, split, split.notes, nowMs)).toBeNull()
  })
})
