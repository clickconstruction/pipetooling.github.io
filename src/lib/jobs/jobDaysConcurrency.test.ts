import { describe, expect, it } from 'vitest'
import { buildJobDayLedger } from './jobDayLedger'
import { buildJobDaysChartSeries, buildJobDaysRows, orderJobDaysRows, summarizeJobDays } from './jobDaysConcurrency'
import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'

const line = (ymd: string, job: string, user: string, hours: number): OtherJobsLaborDetailLine => ({
  sessionId: `${ymd}-${job}-${user}`,
  workDate: ymd,
  userName: user,
  hours,
  laborUsd: hours * 30,
  missingWage: false,
  jobLedgerId: job,
  notes: null,
})

const ledger = buildJobDayLedger({
  startYmd: '2026-08-29',
  endYmd: '2026-09-02',
  officeJobLedgerId: 'office',
  fieldDetailByDay: new Map([
    ['2026-08-31', [line('2026-08-31', 'j931', 'Terry', 8), line('2026-08-31', 'j904', 'Paige', 24), line('2026-08-31', 'j904', 'Isiah', 8.6), line('2026-08-31', 'j990', 'Micah', 4)]],
    ['2026-09-01', [line('2026-09-01', 'j904', 'Paige', 24), line('2026-09-01', 'j878', 'Terry', 16), line('2026-09-01', 'j990', 'Micah', 8.4)]],
    ['2026-09-02', [line('2026-09-02', 'j931', 'Terry', 25.9), line('2026-09-02', 'j931', 'Darren', 4.7), line('2026-09-02', 'j878', 'Isiah', 2.4), line('2026-09-02', 'j983', 'Paige', 2.3), line('2026-09-02', 'j843', 'Tristen', 1.3)]],
  ]),
  poolUsdByDay: new Map([
    ['2026-08-29', 118],
    ['2026-08-31', 412],
    ['2026-09-01', 299],
    ['2026-09-02', 1180],
  ]),
  addDays: ymdAddDays,
})

describe('buildJobDaysRows', () => {
  const rows = buildJobDaysRows(ledger)

  it('one row per calendar day with jobs, people, hours, pool, and per job-day', () => {
    expect(rows.map((r) => r.ymd)).toEqual(['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
    const aug31 = rows[2]!
    expect(aug31.jobs).toBe(3)
    expect(aug31.people).toBe(4)
    expect(aug31.fieldHours).toBeCloseTo(44.6, 5)
    expect(aug31.poolUsd).toBe(412)
    expect(aug31.perJobDayUsd).toBeCloseTo(412 / 3, 6)
    expect(aug31.slices.map((s) => s.jobId)).toEqual(['j904', 'j931', 'j990'])
    expect(aug31.slices[0]).toMatchObject({ hours: 32.6, people: ['Paige', 'Isiah'] })
  })

  it('quiet days carry zero jobs and a null per job-day', () => {
    expect(rows[0]).toMatchObject({ ymd: '2026-08-29', jobs: 0, people: 0, poolUsd: 118, perJobDayUsd: null, slices: [] })
    expect(rows[1]).toMatchObject({ ymd: '2026-08-30', jobs: 0, poolUsd: 0 })
  })
})

describe('summarizeJobDays', () => {
  const s = summarizeJobDays(buildJobDaysRows(ledger))

  it('counts workdays, job-days, and the jobs-per-workday spread', () => {
    expect(s.calendarDays).toBe(5)
    expect(s.workdays).toBe(3)
    expect(s.jobDays).toBe(3 + 3 + 4)
    expect(s.avgJobsPerWorkday).toBeCloseTo(10 / 3, 6)
    expect(s.medianJobsPerWorkday).toBe(3)
    expect(s.maxJobsPerWorkday).toBe(4)
    expect(s.histogram).toEqual([0, 0, 0, 2, 1])
  })

  it('prices a job-day from the pool on workdays and reports the unallocated rest', () => {
    expect(s.overheadPerJobDayUsd).toBeCloseTo((412 + 299 + 1180) / 10, 6)
    expect(s.unallocatedUsd).toBe(118)
    expect(s.totalFieldHours).toBeCloseTo(44.6 + 48.4 + 36.6, 5)
    expect(s.totalPeopleDays).toBe(4 + 3 + 5)
  })

  it('handles an empty window', () => {
    const empty = summarizeJobDays([])
    expect(empty).toMatchObject({ calendarDays: 0, workdays: 0, jobDays: 0, avgJobsPerWorkday: null, medianJobsPerWorkday: null, maxJobsPerWorkday: 0, overheadPerJobDayUsd: null, histogram: [0] })
  })
})

describe('chart series + ordering', () => {
  const rows = buildJobDaysRows(ledger)

  it('keeps the top jobs by hours as keyed segments and folds the rest into other', () => {
    const series = buildJobDaysChartSeries(rows, 3)
    expect(series.keyJobIds).toEqual(['j904', 'j931', 'j878'])
    const sep2 = series.days[4]!
    expect(sep2.segments.map((s) => s.jobId)).toEqual(['j931', 'j878', null])
    expect(sep2.segments[2]!.hours).toBeCloseTo(3.6, 5)
    expect(sep2.jobs).toBe(4)
    expect(series.maxHours).toBeCloseTo(48.4, 5)
    expect(series.days[1]!.segments).toEqual([])
  })

  it('orders newest first and drops fully quiet days unless asked', () => {
    expect(orderJobDaysRows(rows, { includeQuiet: false }).map((r) => r.ymd)).toEqual(['2026-09-02', '2026-09-01', '2026-08-31', '2026-08-29'])
    expect(orderJobDaysRows(rows, { includeQuiet: true }).map((r) => r.ymd)).toEqual(['2026-09-02', '2026-09-01', '2026-08-31', '2026-08-30', '2026-08-29'])
  })
})
