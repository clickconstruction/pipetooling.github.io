import { describe, expect, it } from 'vitest'
import { buildEarnedRevenue, earnedRevenueInWindow, expectedHoursForJob } from './earnedRevenue'

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

describe("earnedRevenueInWindow with the caller's own word on done (v2.6388)", () => {
  // J804: $32,600 contract, status billed, % column 40, 139.7 h all inside the window.
  const j804 = { contractUsd: 32_600, pctComplete: 40, status: 'billed', hoursInWindow: 139.7, lifetimeHours: 139.7 }
  it('finished: false earns by the % whatever the status says — a billed job at 40 % earns $13,040, not the contract', () => {
    const w = earnedRevenueInWindow({ ...j804, finished: false })
    expect(w?.expectedHours).toBeCloseTo(139.7 / 0.4, 9)
    expect(w?.usd).toBeCloseTo(13_040, 6)
    expect(w?.assumedHalf).toBe(false)
  })
  it('omitted, the status decides as the Bridge does: billed = done, the whole contract across its hours', () => {
    expect(earnedRevenueInWindow(j804)?.usd).toBeCloseTo(32_600, 6)
  })
  it('finished: true on a working job earns the whole contract across its hours', () => {
    const w = earnedRevenueInWindow({ contractUsd: 10_000, pctComplete: 40, status: 'working', finished: true, hoursInWindow: 30, lifetimeHours: 100 })
    expect(w?.expectedHours).toBe(100)
    expect(w?.usd).toBeCloseTo(3_000, 6)
  })
  it('expectedHoursForJob takes the same override; without it the status rule is unchanged', () => {
    const job = { id: 'j804', revenueUsd: 32_600, pctComplete: 40, status: 'billed', lifetimeHours: 139.7 }
    expect(expectedHoursForJob(job).hours).toBe(139.7)
    expect(expectedHoursForJob(job, { finished: false }).hours).toBeCloseTo(349.25, 9)
    expect(expectedHoursForJob(job, {}).hours).toBe(139.7)
  })
})
