import { describe, expect, it } from 'vitest'
import { buildEarnedRevenue } from './earnedRevenue'
import { buildVectors, compareVectorRows, ratePerHourByJob, type VectorSession } from './vectors'

const week = { weekStart: '2026-09-06', weekEnd: '2026-09-12' }
const people = [
  { userId: 'u-abe', name: 'Abraham', role: 'helpers', archived: false },
  { userId: 'u-tau', name: 'Taunya', role: 'assistant', archived: false },
  { userId: 'u-wen', name: 'Wendi', role: 'estimator', archived: false },
  { userId: 'u-idle', name: 'Nobody', role: 'helpers', archived: false },
]
const wages = [
  { userId: 'u-abe', fieldWage: 25, officeWage: null, isSalary: false },
  { userId: 'u-tau', fieldWage: 20, officeWage: 22, isSalary: true },
]
const session = (o: Partial<VectorSession> & { userId: string; hours: number }): VectorSession => ({
  workDate: '2026-09-08',
  jobId: 'j1',
  onBid: false,
  officeJob: false,
  approved: true,
  pending: false,
  ...o,
})
const empty = { invoiceSends: [], payments: [], pctUpdates: [], fieldReports: [], bidsSent: [], bidsWon: [] }

describe('ratePerHourByJob', () => {
  it('matches the earned kernel: a person’s earned dollars are the Bridge’s earned dollars on their hours', () => {
    const jobs = [
      { id: 'j1', revenueUsd: 50_000, pctComplete: 40, status: 'working', lifetimeHours: 100 },
      { id: 'j0', revenueUsd: null, pctComplete: null, status: 'working', lifetimeHours: 10 },
    ]
    const earned = buildEarnedRevenue({ jobs, sessions: [{ jobId: 'j1', ymd: '2026-09-08', hours: 8 }] })
    const rates = ratePerHourByJob(jobs, earned.expectedHoursByJob)
    expect(rates.get('j1')).toBe(200) // 50k ÷ 250 expected hours
    expect(rates.has('j0')).toBe(false)
    expect(earned.earnedByDay.get('2026-09-08')).toBe(1600)
    expect(8 * rates.get('j1')!).toBe(1600)
  })
})

describe('buildVectors', () => {
  it('builds one row per person who moved something, with contribution = earned − field labor', () => {
    const v = buildVectors({
      ...week,
      people,
      wages,
      sessions: [
        session({ userId: 'u-abe', hours: 8 }),
        session({ userId: 'u-abe', hours: 2, workDate: '2026-09-09', jobId: 'j-office', officeJob: true }),
        session({ userId: 'u-abe', hours: 3, workDate: '2026-09-10', approved: false, pending: true }),
        session({ userId: 'u-abe', hours: 5, workDate: '2026-09-05' }), // last week — ignored
        session({ userId: 'u-tau', hours: 6, jobId: null, onBid: true }),
      ],
      ratePerHourByJob: new Map([['j1', 200]]),
      ...empty,
    })
    expect(v.rows.map((r) => r.name)).toEqual(['Abraham', 'Taunya'])
    const abe = v.rows[0]!
    expect(abe).toMatchObject({ fieldHours: 8, officeBidHours: 2, pendingHours: 3, earnedUsd: 1600, laborUsd: 250, contributionUsd: 1400, contributionPerHour: 175, unratedHours: 0 })
    const tau = v.rows[1]!
    expect(tau).toMatchObject({ fieldHours: 0, officeBidHours: 6, laborUsd: 132, contributionUsd: null, isSalary: true })
    expect(v.totals).toMatchObject({ fieldHours: 8, officeBidHours: 8, pendingHours: 3, earnedUsd: 1600, laborUsd: 382, contributionUsd: 1400 })
  })

  it('marks earned dollars that rest on an assumed-half job as guessed, on the row and the total', () => {
    const v = buildVectors({
      ...week,
      people,
      wages,
      sessions: [session({ userId: 'u-abe', hours: 8 }), session({ userId: 'u-abe', hours: 2, jobId: 'j-guess' })],
      ratePerHourByJob: new Map([['j1', 100], ['j-guess', 5000]]),
      assumedHalfJobs: new Set(['j-guess']),
      ...empty,
    })
    expect(v.rows[0]).toMatchObject({ earnedUsd: 10_800, guessedEarnedUsd: 10_000 })
    expect(v.totals.guessedEarnedUsd).toBe(10_000)
  })

  it('counts field hours on jobs without a rate as unrated instead of earning $0 silently', () => {
    const v = buildVectors({ ...week, people, wages, sessions: [session({ userId: 'u-abe', hours: 4, jobId: 'j-nocontract' })], ratePerHourByJob: new Map(), ...empty })
    expect(v.rows[0]).toMatchObject({ fieldHours: 4, unratedHours: 4, earnedUsd: 0, laborUsd: 100, contributionUsd: -100 })
  })

  it('flags a person with no pay config and costs their hours at $0', () => {
    const v = buildVectors({ ...week, people, wages: [], sessions: [session({ userId: 'u-abe', hours: 4 })], ratePerHourByJob: new Map([['j1', 100]]), ...empty })
    expect(v.rows[0]).toMatchObject({ noWage: true, laborUsd: 0, earnedUsd: 400, contributionUsd: 400 })
  })

  it('attributes billed, collected, % reports and bids to their actors, and keeps the rest as unattributed', () => {
    const v = buildVectors({
      ...week,
      people,
      wages,
      sessions: [],
      ratePerHourByJob: new Map(),
      invoiceSends: [
        { userId: 'u-tau', ymd: '2026-09-07', usd: 12_000 },
        { userId: null, ymd: '2026-09-07', usd: 500 },
        { userId: 'u-tau', ymd: '2026-09-01', usd: 99_999 }, // last week
      ],
      payments: [
        { userId: 'u-tau', ymd: '2026-09-09', usd: 4000 },
        { userId: 'u-gone', ymd: '2026-09-09', usd: 300 },
      ],
      pctUpdates: [{ userId: 'u-abe', ymd: '2026-09-08' }, { userId: null, ymd: '2026-09-08' }],
      fieldReports: [{ userId: 'u-abe', ymd: '2026-09-08' }],
      bidsSent: [{ userId: 'u-wen', ymd: '2026-09-08', usd: 80_000, label: 'BP500' }],
      bidsWon: [
        { userId: 'u-wen', ymd: '2026-09-10', usd: 45_000, label: 'BP480' },
        { userId: null, ymd: '2026-09-10', usd: 1000, label: 'BP1' },
      ],
    })
    const by = Object.fromEntries(v.rows.map((r) => [r.name, r]))
    expect(by.Taunya).toMatchObject({ billedCount: 1, billedUsd: 12_000, collectedCount: 1, collectedUsd: 4000 })
    expect(by.Abraham).toMatchObject({ pctReports: 2 })
    expect(by.Wendi).toMatchObject({ bidsSentCount: 1, bidsSentUsd: 80_000, bidsWonCount: 1, bidsWonUsd: 45_000 })
    expect(by.Nobody).toBeUndefined()
    expect(v.unattributed).toEqual({ billedUsd: 500, collectedUsd: 300, pctReports: 1, bidsWonUsd: 1000 })
    expect(v.totals).toMatchObject({ billedUsd: 12_000, collectedUsd: 4000, bidsWonUsd: 45_000 })
    // Order: no field contributors, so by what they moved.
    expect(v.rows.map((r) => r.name)).toEqual(['Wendi', 'Taunya', 'Abraham'])
  })

  it('sorts field contributors first by contribution, then movers, then names', () => {
    const rows = buildVectors({
      ...week,
      people,
      wages,
      sessions: [session({ userId: 'u-abe', hours: 8 }), session({ userId: 'u-tau', hours: 8, jobId: 'j1' })],
      ratePerHourByJob: new Map([['j1', 100]]),
      ...empty,
      bidsWon: [{ userId: 'u-wen', ymd: '2026-09-10', usd: 1_000_000, label: 'big' }],
    }).rows
    // Taunya's field wage is 20 → contribution 640 beats Abraham's 600; Wendi (no field hours) sorts after both.
    expect(rows.map((r) => r.name)).toEqual(['Taunya', 'Abraham', 'Wendi'])
    expect([...rows].sort(compareVectorRows).map((r) => r.name)).toEqual(['Taunya', 'Abraham', 'Wendi'])
  })
})
