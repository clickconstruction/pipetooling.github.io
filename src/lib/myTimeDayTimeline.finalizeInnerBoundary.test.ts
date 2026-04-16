import { describe, expect, it } from 'vitest'
import {
  finalizeInnerBoundaryMsForCluster,
  MIN_SEGMENT_MS,
  type DayEditorSession,
} from './myTimeDayTimeline'

function row(
  id: string,
  clockedInMs: number,
  clockedOutMs: number | null,
  origin: string,
  salarySeg: number | null
): DayEditorSession {
  return {
    id,
    clocked_in_at: new Date(clockedInMs).toISOString(),
    clocked_out_at: clockedOutMs != null ? new Date(clockedOutMs).toISOString() : null,
    work_date: '2026-01-01',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin,
    salary_segment_index: salarySeg,
  }
}

describe('finalizeInnerBoundaryMsForCluster', () => {
  const nowMs = 9_000_000

  it('mixed metadata: seam can slide later off the stored join within hull', () => {
    const lo = 0
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      row('a', lo, join, 'salary_schedule', 1),
      row('b', join, hi, 'user_punch', null),
    ]
    const prevB = lo
    const nextB = hi
    const ms = join + 120_000
    const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, ms, nowMs)
    expect(fin).toBe(ms)
  })

  it('mixed metadata: seam can slide earlier off the stored join within hull', () => {
    const lo = 0
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      row('a', lo, join, 'salary_schedule', 1),
      row('b', join, hi, 'user_punch', null),
    ]
    const prevB = lo
    const nextB = hi
    const ms = join - 120_000
    const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, ms, nowMs)
    expect(fin).toBe(ms)
  })

  it('mixed metadata: keeps mid-row boundary within the row span', () => {
    const lo = 0
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      row('a', lo, join, 'salary_schedule', 1),
      row('b', join, hi, 'user_punch', null),
    ]
    const mid = 1_800_000
    const prevB = lo
    const nextB = join
    const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, mid + 60_000, nowMs)
    expect(fin).toBeGreaterThanOrEqual(prevB + MIN_SEGMENT_MS)
    expect(fin).toBeLessThanOrEqual(nextB - MIN_SEGMENT_MS)
    expect(fin).toBe(mid + 60_000)
  })

  it('homogeneous metadata: still applies soft join snap only near join', () => {
    const lo = 0
    const join = 3_600_000
    const hi = 7_200_000
    const c = [
      row('a', lo, join, 'user_punch', null),
      row('b', join, hi, 'user_punch', null),
    ]
    const prevB = lo
    const nextB = hi
    const msNear = join + 30_000
    const fin = finalizeInnerBoundaryMsForCluster(c, prevB, nextB, msNear, nowMs)
    expect(fin).toBe(join)
  })
})
