import { describe, expect, it } from 'vitest'
import { buildEarnedRevenue, expectedHoursForJob } from './earnedRevenue'

describe('expectedHoursForJob', () => {
  it('finished jobs are 100%; open jobs scale by pct; no pct assumes half', () => {
    expect(expectedHoursForJob({ id: 'a', revenueUsd: 1, pctComplete: 30, status: 'paid', lifetimeHours: 80 })).toEqual({ hours: 80, assumedHalf: false })
    expect(expectedHoursForJob({ id: 'b', revenueUsd: 1, pctComplete: 40, status: 'working', lifetimeHours: 100 })).toEqual({ hours: 250, assumedHalf: false })
    expect(expectedHoursForJob({ id: 'c', revenueUsd: 1, pctComplete: null, status: 'working', lifetimeHours: 50 })).toEqual({ hours: 100, assumedHalf: true })
    expect(expectedHoursForJob({ id: 'd', revenueUsd: 1, pctComplete: 150, status: 'working', lifetimeHours: 50 }).hours).toBe(50)
  })
})

describe('buildEarnedRevenue', () => {
  const jobs = [
    { id: 'done', revenueUsd: 10000, pctComplete: null, status: 'paid', lifetimeHours: 100 },
    { id: 'open', revenueUsd: 25000, pctComplete: 40, status: 'working', lifetimeHours: 100 },
    { id: 'nopct', revenueUsd: 8000, pctComplete: null, status: 'working', lifetimeHours: 40 },
    { id: 'tm', revenueUsd: 0, pctComplete: 50, status: 'working', lifetimeHours: 10 },
  ]
  const sessions = [
    { jobId: 'done', ymd: '2026-09-01', hours: 10 }, // 10 × (10000/100) = 1000
    { jobId: 'open', ymd: '2026-09-01', hours: 5 }, //  5 × (25000/250) = 500
    { jobId: 'open', ymd: '2026-09-02', hours: 10 }, // 1000
    { jobId: 'nopct', ymd: '2026-09-02', hours: 8 }, //  8 × (8000/80) = 800
    { jobId: 'tm', ymd: '2026-09-02', hours: 4 }, // $0
    { jobId: 'ghost', ymd: '2026-09-02', hours: 4 }, // unknown job ignored
  ]

  it('earns revenue per hour at contract ÷ expected hours, by day and by job', () => {
    const r = buildEarnedRevenue({ jobs, sessions })
    expect(r.earnedByDay.get('2026-09-01')).toBe(1500)
    expect(r.earnedByDay.get('2026-09-02')).toBe(1800)
    expect(r.earnedByJob.get('open')).toBe(1500)
    expect(r.earnedByJob.get('tm')).toBeUndefined()
    expect(r.expectedHoursByJob.get('open')).toBe(250)
    expect(r.assumedHalfJobs).toEqual(['nopct'])
    expect(r.noRevenueJobs).toEqual(['tm'])
  })

  it('a job with zero lifetime hours earns nothing (no division by zero)', () => {
    const r = buildEarnedRevenue({ jobs: [{ id: 'z', revenueUsd: 500, pctComplete: 10, status: 'working', lifetimeHours: 0 }], sessions: [{ jobId: 'z', ymd: '2026-09-01', hours: 0 }] })
    expect(r.earnedByDay.size).toBe(0)
  })
})
