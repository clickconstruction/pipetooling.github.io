import { describe, expect, it } from 'vitest'
import { buildReviewJobsRollup, type ReviewRollupRowInput } from './reviewJobsRollup'

function r(over: Partial<ReviewRollupRowInput> & { rowKey: string; jobKey: string }): ReviewRollupRowInput {
  return {
    date: '2026-08-10',
    numberLabel: 'JP1',
    jobName: 'Job',
    jobAddress: '1 Main',
    hours: 8,
    laborCost: 462,
    allocatedTotalBill: 1000,
    allocatedRevenueBeforeOverhead: 300,
    totalLaborOnJob: 6523,
    valueCreated: 24081,
    revenueBeforeOverhead: 226,
    totalBill: 24081,
    pctComplete: 100,
    ...over,
  }
}

describe('buildReviewJobsRollup', () => {
  it('groups day rows by job, sums the person figures, keeps the whole-job figures, and orders days by date', () => {
    const rows = [
      r({ rowKey: 'crew-a-2026-08-11', jobKey: 'a', date: '2026-08-11', hours: 0.98, laborCost: 56, allocatedTotalBill: 208, allocatedRevenueBeforeOverhead: 2 }),
      r({ rowKey: 'crew-a-2026-08-05', jobKey: 'a', date: '2026-08-05' }),
      r({ rowKey: 'labor-x', jobKey: 'a', date: null, hours: 4, laborCost: 231, allocatedTotalBill: 500, allocatedRevenueBeforeOverhead: 150 }),
      r({ rowKey: 'crew-b-2026-08-07', jobKey: 'b', numberLabel: 'JP891', jobName: 'Liberty Hill', hours: 2.54, laborCost: 147, allocatedTotalBill: 3745, allocatedRevenueBeforeOverhead: 2941, totalLaborOnJob: 1659, valueCreated: 42301, revenueBeforeOverhead: 33219, totalBill: 42301 }),
    ]
    const out = buildReviewJobsRollup(rows)
    expect(out.dayRows).toBe(4)
    expect(out.jobs.map((j) => j.jobKey)).toEqual(['b', 'a'])
    const a = out.jobs[1]!
    expect(a.rowKeys).toEqual(['crew-a-2026-08-05', 'crew-a-2026-08-11', 'labor-x'])
    expect(a.dayRows).toBe(3)
    expect(a.hours).toBeCloseTo(12.98)
    expect(a.laborCost).toBe(749)
    expect(a.allocatedTotalBill).toBe(1708)
    expect(a.allocatedRevenueBeforeOverhead).toBe(452)
    expect(a.share).toBeCloseTo(749 / 6523)
    expect(a.totalLaborOnJob).toBe(6523)
    expect(a.valueCreated).toBe(24081)
    expect(a.revPerHour).toBeCloseTo(1708 / 12.98)
    expect(a.profitPerHour).toBeCloseTo(452 / 12.98)
    expect(a.flags).toEqual({ noBill: false, assumedPct: false })
    const b = out.jobs[0]!
    expect(b.share).toBeCloseTo(147 / 1659)
    expect(b.numberLabel).toBe('JP891')
  })
  it('counts zero-hour rows per job and overall, and flags no-bill and assumed-% jobs', () => {
    const rows = [
      r({ rowKey: 'crew-c-1', jobKey: 'c', hours: 0, laborCost: 0, allocatedTotalBill: 0, allocatedRevenueBeforeOverhead: 0 }),
      r({ rowKey: 'crew-c-2', jobKey: 'c', date: '2026-08-12' }),
      r({ rowKey: 'crew-d-1', jobKey: 'd', totalBill: 0, valueCreated: 0, allocatedTotalBill: 0, allocatedRevenueBeforeOverhead: -53 }),
      r({ rowKey: 'crew-e-1', jobKey: 'e', pctComplete: null }),
      r({ rowKey: 'crew-f-1', jobKey: 'f', totalLaborOnJob: 0 }),
    ]
    const out = buildReviewJobsRollup(rows)
    expect(out.zeroHourRows).toBe(1)
    const byKey = Object.fromEntries(out.jobs.map((j) => [j.jobKey, j]))
    expect(byKey.c!.zeroHourRows).toBe(1)
    expect(byKey.d!.flags.noBill).toBe(true)
    expect(byKey.e!.flags.assumedPct).toBe(true)
    expect(byKey.f!.share).toBeNull()
  })
  it('returns an empty rollup for no rows', () => {
    expect(buildReviewJobsRollup([])).toEqual({ jobs: [], dayRows: 0, zeroHourRows: 0 })
  })
})
