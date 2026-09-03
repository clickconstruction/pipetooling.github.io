import { describe, expect, it } from 'vitest'
import {
  allocateJobOverheadDayShare,
  buildJobDayLedger,
  deserializeJobDayLedger,
  jobOverheadByMethod,
  serializeJobDayLedger,
  unallocatedJobDayOverhead,
} from './jobDayLedger'
import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'

const line = (ymd: string, job: string, user: string, hours: number, wage = 30): OtherJobsLaborDetailLine => ({
  sessionId: `${ymd}-${job}-${user}`,
  workDate: ymd,
  userName: user,
  hours,
  laborUsd: hours * wage,
  missingWage: false,
  jobLedgerId: job,
  notes: null,
})

function ledger() {
  const fieldDetailByDay = new Map<string, OtherJobsLaborDetailLine[]>([
    ['2026-08-31', [line('2026-08-31', 'j931', 'Terry', 8), line('2026-08-31', 'j904', 'Paige', 24), line('2026-08-31', 'j904', 'Isiah', 8.6)]],
    ['2026-09-01', [line('2026-09-01', 'j904', 'Paige', 24), line('2026-09-01', 'j878', 'Terry', 16), line('2026-09-01', 'j990', 'Micah', 8.4)]],
    ['2026-09-02', [line('2026-09-02', 'j931', 'Terry', 25.9), line('2026-09-02', 'j931', 'Darren', 4.7), line('2026-09-02', 'j878', 'Isiah', 2.4)]],
  ])
  const poolUsdByDay = new Map<string, number>([
    ['2026-08-29', 118], // Saturday: office parts only, no field work
    ['2026-08-31', 412],
    ['2026-09-01', 299],
    ['2026-09-02', 1180],
  ])
  return buildJobDayLedger({
    startYmd: '2026-08-29',
    endYmd: '2026-09-02',
    officeJobLedgerId: 'office',
    fieldDetailByDay,
    poolUsdByDay,
    priorHoursByJob: new Map([['j931', 22.1]]),
    pendingFieldSessions: 3,
    pendingFieldHours: 14.5,
    invoicedRevenueUsd: 40_000,
    addDays: ymdAddDays,
  })
}

describe('buildJobDayLedger', () => {
  it('zero-fills every day, sums field hours per day, and rolls jobs up', () => {
    const l = ledger()
    expect(l.days.map((d) => d.ymd)).toEqual(['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
    expect(l.dayByYmd.get('2026-08-30')).toMatchObject({ poolUsd: 0, fieldHours: 0 })
    expect(l.dayByYmd.get('2026-08-31')!.fieldHours).toBeCloseTo(40.6, 5)
    const j931Day = l.dayByYmd.get('2026-09-02')!.byJob.get('j931')!
    expect(j931Day.hours).toBeCloseTo(30.6, 5)
    expect(j931Day.people).toEqual(['Terry', 'Darren'])
    expect(l.jobs.get('j931')!.hours).toBeCloseTo(38.6, 5)
    expect(l.jobs.get('j931')).toMatchObject({ days: 2, firstYmd: '2026-08-31', lastYmd: '2026-09-02' })
    expect(l.jobs.get('j904')).toMatchObject({ days: 2 })
    expect(l.totals.poolUsd).toBe(2009)
    expect(l.totals.fieldHours).toBeCloseTo(122, 5)
    expect(l.priorHoursByJob.get('j931')).toBe(22.1)
    expect(l.pendingFieldHours).toBe(14.5)
  })

  it('computes the three reference lenses over the window', () => {
    const l = ledger()
    expect(l.rates.methodA).toBeCloseTo(2009 / 122, 6)
    expect(l.rates.methodB).toBeCloseTo(2009 / 40_000, 6)
    expect(l.rates.methodC).toBeCloseTo(2009 / (122 * 30), 6)
  })
})

describe('day-share allocation', () => {
  it('hands each day’s pool to the jobs worked that day by hour share, and lists the lines', () => {
    const l = ledger()
    const s = allocateJobOverheadDayShare(l, 'j931')
    expect(s.lines).toHaveLength(2)
    expect(s.lines[0]).toMatchObject({ ymd: '2026-08-31', jobHours: 8, fieldHours: 40.6, poolUsd: 412 })
    expect(s.lines[0]!.shareUsd).toBeCloseTo(412 * (8 / 40.6), 6)
    expect(s.lines[1]!.shareUsd).toBeCloseTo(1180 * (30.6 / 33), 6)
    expect(s.overheadUsd).toBeCloseTo(412 * (8 / 40.6) + 1180 * (30.6 / 33), 6)
    expect(s.hoursInWindow).toBeCloseTo(38.6, 5)
    expect(s.daysInWindow).toBe(2)
  })

  it('reconciles: the shares across all jobs on a worked day equal that day’s pool', () => {
    const l = ledger()
    const jobs = ['j931', 'j904', 'j878', 'j990']
    let charged = 0
    for (const j of jobs) charged += allocateJobOverheadDayShare(l, j).overheadUsd
    const un = unallocatedJobDayOverhead(l)
    expect(charged + un.usd).toBeCloseTo(l.totals.poolUsd, 6)
    expect(un).toEqual({ usd: 118, days: 1 })
  })

  it('returns nothing for a job with no sessions in the window', () => {
    expect(allocateJobOverheadDayShare(ledger(), 'nope')).toEqual({ overheadUsd: 0, lines: [], hoursInWindow: 0, daysInWindow: 0 })
  })
})

describe('jobOverheadByMethod', () => {
  it('routes to day-share, A (hours), B (revenue), C (labor $)', () => {
    const l = ledger()
    expect(jobOverheadByMethod(l, 'j931', 'day', { revenueUsd: 48_700 })).toBeCloseTo(allocateJobOverheadDayShare(l, 'j931').overheadUsd, 9)
    expect(jobOverheadByMethod(l, 'j931', 'A', { revenueUsd: 48_700 })).toBeCloseTo(38.6 * (2009 / 122), 6)
    expect(jobOverheadByMethod(l, 'j931', 'B', { revenueUsd: 48_700 })).toBeCloseTo(48_700 * (2009 / 40_000), 6)
    expect(jobOverheadByMethod(l, 'j931', 'C', { revenueUsd: 48_700 })).toBeCloseTo(38.6 * 30 * (2009 / (122 * 30)), 6)
  })

  it('is null when a lens has no denominator', () => {
    const l = buildJobDayLedger({ startYmd: '2026-09-01', endYmd: '2026-09-01', officeJobLedgerId: null, fieldDetailByDay: new Map(), poolUsdByDay: new Map([['2026-09-01', 50]]), addDays: ymdAddDays })
    expect(jobOverheadByMethod(l, 'x', 'A', { revenueUsd: 100 })).toBeNull()
    expect(jobOverheadByMethod(l, 'x', 'B', { revenueUsd: 100 })).toBeNull()
    expect(jobOverheadByMethod(l, 'x', 'day', { revenueUsd: 100 })).toBe(0)
  })
})

describe('serialization', () => {
  it('round-trips through JSON with the same totals, jobs, and rates', () => {
    const l = ledger()
    const back = deserializeJobDayLedger(JSON.parse(JSON.stringify(serializeJobDayLedger(l))))
    expect(back.totals).toEqual(l.totals)
    expect(back.rates).toEqual(l.rates)
    expect(back.jobs.get('j931')!.hours).toBeCloseTo(l.jobs.get('j931')!.hours, 9)
    expect(back.jobs.get('j931')!.days).toBe(l.jobs.get('j931')!.days)
    expect(back.priorHoursByJob.get('j931')).toBe(22.1)
    expect(allocateJobOverheadDayShare(back, 'j904').overheadUsd).toBeCloseTo(allocateJobOverheadDayShare(l, 'j904').overheadUsd, 9)
  })
})
