import { describe, expect, it } from 'vitest'
import { buildCourseModel } from './courseModel'
import type { VectorSession, VectorWage } from './vectors'
import { addDayMaps, buildRecordedReading, buildWaitingDays } from './waitingDays'

const wages: VectorWage[] = [
  { userId: 'sam', fieldWage: 30, officeWage: 25, isSalary: false },
  { userId: 'dana', fieldWage: 40, officeWage: 40, isSalary: true },
]
const rates = new Map([
  ['job-a', 100],
  ['job-b', 80],
])
const session = (over: Partial<VectorSession> & Pick<VectorSession, 'userId' | 'workDate' | 'hours'>): VectorSession => ({ jobId: 'job-a', onBid: false, officeJob: false, approved: true, pending: false, ...over })
const waits = { approved: false, pending: true }
const range = { start: '2026-10-01', end: '2026-10-14', wages, ratePerHourByJob: rates }
const rows = (m: ReadonlyMap<string, number>): Array<[string, number]> => [...m].sort(([a], [b]) => (a < b ? -1 : 1))

describe('buildWaitingDays', () => {
  it('adds nothing when every hour is approved', () => {
    const w = buildWaitingDays({ ...range, sessions: [session({ userId: 'sam', workDate: '2026-10-05', hours: 8 }), session({ userId: 'sam', workDate: '2026-10-06', hours: 6, jobId: 'job-b' })] })
    expect(w.hours).toBe(0)
    expect(w.earnedByDay.size).toBe(0)
    expect(w.laborByDay.size).toBe(0)
  })

  it('prices a waiting field hour at the job’s rate and the person’s wage, on its work day', () => {
    const w = buildWaitingDays({
      ...range,
      sessions: [
        session({ userId: 'sam', workDate: '2026-10-05', hours: 8 }),
        session({ userId: 'sam', workDate: '2026-10-07', hours: 5, ...waits }),
        session({ userId: 'sam', workDate: '2026-10-08', hours: 4, jobId: 'job-b', ...waits }),
      ],
    })
    expect(w.hours).toBe(9)
    expect(rows(w.earnedByDay)).toEqual([
      ['2026-10-07', 500],
      ['2026-10-08', 320],
    ])
    expect(rows(w.laborByDay)).toEqual([
      ['2026-10-07', 150],
      ['2026-10-08', 120],
    ])
  })

  it('takes only the waiting part of a day that has approved hours too', () => {
    const w = buildWaitingDays({
      ...range,
      sessions: [session({ userId: 'sam', workDate: '2026-10-05', hours: 6 }), session({ userId: 'sam', workDate: '2026-10-05', hours: 2, ...waits })],
    })
    expect(w.hours).toBe(2)
    expect(rows(w.earnedByDay)).toEqual([['2026-10-05', 200]])
    expect(rows(w.laborByDay)).toEqual([['2026-10-05', 60]])
  })

  it('leaves out waiting office and bid hours, hours out of range, and hours that were turned down', () => {
    const w = buildWaitingDays({
      ...range,
      sessions: [
        session({ userId: 'sam', workDate: '2026-10-05', hours: 3, officeJob: true, ...waits }),
        session({ userId: 'sam', workDate: '2026-10-06', hours: 3, jobId: null, onBid: true, ...waits }),
        session({ userId: 'sam', workDate: '2026-09-30', hours: 8, ...waits }),
        session({ userId: 'sam', workDate: '2026-10-15', hours: 8, ...waits }),
        session({ userId: 'sam', workDate: '2026-10-07', hours: 8, approved: false, pending: false }),
      ],
    })
    expect(w).toEqual({ earnedByDay: new Map(), laborByDay: new Map(), hours: 0 })
  })

  it('charges the wage and earns nothing on a job with no rate', () => {
    const w = buildWaitingDays({ ...range, sessions: [session({ userId: 'sam', workDate: '2026-10-05', hours: 4, jobId: 'job-none', ...waits })] })
    expect(w.hours).toBe(4)
    expect(w.earnedByDay.size).toBe(0)
    expect(rows(w.laborByDay)).toEqual([['2026-10-05', 120]])
  })

  it('charges a salaried day once: nothing more on a day already approved, the flat day when all of it waits', () => {
    const w = buildWaitingDays({
      ...range,
      sessions: [
        // Monday: four hours approved, four waiting. The flat day is already in the approved reading.
        session({ userId: 'dana', workDate: '2026-10-05', hours: 4 }),
        session({ userId: 'dana', workDate: '2026-10-05', hours: 4, ...waits }),
        // Tuesday: all of it waits, so the whole flat day comes with it (8 × $40).
        session({ userId: 'dana', workDate: '2026-10-06', hours: 5, ...waits }),
      ],
    })
    expect(w.hours).toBe(9)
    expect(rows(w.earnedByDay)).toEqual([
      ['2026-10-05', 400],
      ['2026-10-06', 500],
    ])
    expect(rows(w.laborByDay)).toEqual([['2026-10-06', 320]])
  })
})

describe('addDayMaps', () => {
  it('sums two maps into a new one and leaves both alone', () => {
    const a = new Map([['2026-10-05', 100]])
    const b = new Map([
      ['2026-10-05', 20],
      ['2026-10-06', 7],
    ])
    expect(rows(addDayMaps(a, b))).toEqual([
      ['2026-10-05', 120],
      ['2026-10-06', 7],
    ])
    expect(rows(a)).toEqual([['2026-10-05', 100]])
    expect(b.size).toBe(2)
  })
})

describe('buildRecordedReading', () => {
  const approved = {
    todayYmd: '2026-10-14',
    daysBack: 13,
    earnedByDay: new Map([
      ['2026-10-05', 1400],
      ['2026-10-12', 700],
    ]),
    directByDay: new Map([
      ['2026-10-05', 700],
      ['2026-10-12', 350],
    ]),
    overheadByDay: new Map([['2026-10-06', 140]]),
    overheadPerDayBaseline: 50,
    totals: { earnedUsd: 2100, fieldLaborUsd: 600, materialsUsd: 300, subLaborUsd: 150, overheadUsd: 140 },
  }

  it('reads exactly the approved figures when nothing waits', () => {
    const r = buildRecordedReading({ ...approved, waiting: { earnedByDay: new Map(), laborByDay: new Map(), hours: 0 } })
    const was = buildCourseModel({ todayYmd: approved.todayYmd, daysBack: approved.daysBack, daysAhead: 1, earnedByDay: approved.earnedByDay, directByDay: approved.directByDay, overheadByDay: approved.overheadByDay, targetUsd: null, overheadPerDayBaseline: 50 })
    expect(r.speed).toEqual(was.speed)
    expect(r.contributionMargin).toBe(was.contributionMargin)
    expect(r.totals).toEqual(approved.totals)
    expect(rows(r.earnedByDay)).toEqual(rows(approved.earnedByDay))
    expect(rows(r.directByDay)).toEqual(rows(approved.directByDay))
  })

  it('adds what the waiting hours earn and cost to the days, the rates, the margin and the totals', () => {
    const waiting = { earnedByDay: new Map([['2026-10-13', 1400]]), laborByDay: new Map([['2026-10-13', 420]]), hours: 14 }
    const r = buildRecordedReading({ ...approved, waiting })
    expect(rows(r.earnedByDay)).toEqual([
      ['2026-10-05', 1400],
      ['2026-10-12', 700],
      ['2026-10-13', 1400],
    ])
    expect(rows(r.directByDay)).toEqual([
      ['2026-10-05', 700],
      ['2026-10-12', 350],
      ['2026-10-13', 420],
    ])
    // Fourteen days: earned 3,500, job costs 1,470, overhead at its baseline.
    expect(r.speed).toEqual({ days: 14, earnedPerDay: 250, directPerDay: 105, overheadPerDay: 50, burnPerDay: 155, climbPerDay: 95 })
    expect(r.contributionMargin).toBeCloseTo(0.58, 10)
    expect(r.totals).toEqual({ earnedUsd: 3500, fieldLaborUsd: 1020, materialsUsd: 300, subLaborUsd: 150, overheadUsd: 140 })
    // The approved maps are not touched.
    expect(approved.earnedByDay.has('2026-10-13')).toBe(false)
  })
})
