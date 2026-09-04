import { describe, expect, it } from 'vitest'
import { buildJobDayLedger } from './jobDayLedger'
import {
  buildRunningSeries,
  buildRunningSeriesBy,
  buildStatusSpans,
  buildWorkedSpans,
  colorSegmentsForRow,
  jobRunBucket,
  monthTicks,
  runLengthBand,
  stateOnDay,
  summarizeJobRuns,
  ymdToDayNumber,
} from './jobRunningTimeline'
import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'

const line = (ymd: string, job: string, hours = 8): OtherJobsLaborDetailLine => ({
  sessionId: `${ymd}-${job}`,
  workDate: ymd,
  userName: 'Terry',
  hours,
  laborUsd: hours * 30,
  missingWage: false,
  jobLedgerId: job,
  notes: null,
})

// Window Aug 1 → Aug 31. j1 worked Aug 1–5 and Aug 20–25 (14 idle days between);
// j2 worked Aug 3–4 only; j3 worked Aug 28–30 and is still open.
const detail = new Map<string, OtherJobsLaborDetailLine[]>()
const add = (ymd: string, job: string) => detail.set(ymd, [...(detail.get(ymd) ?? []), line(ymd, job)])
for (const d of ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25']) add(d, 'j1')
for (const d of ['2026-08-03', '2026-08-04']) add(d, 'j2')
for (const d of ['2026-08-28', '2026-08-29', '2026-08-30']) add(d, 'j3')

const ledger = buildJobDayLedger({
  startYmd: '2026-08-01',
  endYmd: '2026-08-31',
  officeJobLedgerId: 'office',
  fieldDetailByDay: detail,
  poolUsdByDay: new Map(),
  jobLabels: new Map([
    ['j1', { number: 'J1', name: 'One' }],
    ['j2', { number: 'J2', name: 'Two' }],
    ['j3', { number: 'J3', name: 'Three' }],
  ]),
  addDays: ymdAddDays,
})
const status = new Map<string, string>([
  ['j1', 'billed'],
  ['j2', 'paid'],
  ['j3', 'working'],
])
const TODAY = '2026-08-31'

describe('jobRunBucket + day math', () => {
  it('buckets statuses and counts days', () => {
    expect(jobRunBucket('paid')).toBe('paid')
    expect(jobRunBucket('billed')).toBe('billed')
    expect(jobRunBucket('working')).toBe('working')
    expect(jobRunBucket(null)).toBe('working')
    expect(ymdToDayNumber('2026-08-31') - ymdToDayNumber('2026-08-01')).toBe(30)
  })
})

describe('buildWorkedSpans', () => {
  it('splits a run at a gap longer than the rule and extends open jobs to today', () => {
    const rows = buildWorkedSpans({ ledger, statusByJob: status, todayYmd: TODAY, gapDays: 7 })
    expect(rows.map((r) => r.jobId)).toEqual(['j1', 'j2', 'j3'])
    const j1 = rows[0]!
    expect(j1.segments).toEqual([
      { startYmd: '2026-08-01', endYmd: '2026-08-05' },
      { startYmd: '2026-08-20', endYmd: '2026-08-25' },
    ])
    expect(j1.bucket).toBe('billed')
    expect(j1.runDays).toBe(11)
    expect(j1.open).toBe(false)
    const j3 = rows[2]!
    expect(j3.segments).toEqual([{ startYmd: '2026-08-28', endYmd: '2026-08-31' }])
    expect(j3.open).toBe(true)
    expect(j3.label).toEqual({ number: 'J3', name: 'Three' })
  })

  it('a 14-day gap rule bridges the pause; gap 0 keeps only worked days', () => {
    const wide = buildWorkedSpans({ ledger, statusByJob: status, todayYmd: TODAY, gapDays: 14 })
    expect(wide[0]!.segments).toEqual([{ startYmd: '2026-08-01', endYmd: '2026-08-25' }])
    const none = buildWorkedSpans({ ledger, statusByJob: status, todayYmd: TODAY, gapDays: 0 })
    expect(none[0]!.segments).toHaveLength(2)
    expect(none[0]!.runDays).toBe(11)
    // gap 0: an open job touched yesterday does not stretch to today unless the run is contiguous
    expect(none[2]!.segments).toEqual([{ startYmd: '2026-08-28', endYmd: '2026-08-31' }])
  })

  it('an open job idle beyond the gap is not running today', () => {
    const stale = buildWorkedSpans({ ledger, statusByJob: new Map([['j1', 'working']]), todayYmd: '2026-09-15', gapDays: 7 })
    expect(stale[0]!.segments[1]).toEqual({ startYmd: '2026-08-20', endYmd: '2026-08-25' })
    expect(stale[0]!.open).toBe(false)
  })
})

describe('buildStatusSpans', () => {
  it('clips to the window and runs open spans to today', () => {
    const rows = buildStatusSpans({
      ledger,
      statusSpansByJob: new Map([
        ['j1', { startYmd: '2026-07-20', endYmd: '2026-08-26' }],
        ['j3', { startYmd: '2026-08-27', endYmd: null }],
        ['jx', { startYmd: '2026-09-02', endYmd: null }],
      ]),
      statusByJob: status,
      todayYmd: TODAY,
    })
    expect(rows.map((r) => r.jobId)).toEqual(['j1', 'j3'])
    expect(rows[0]!.segments).toEqual([{ startYmd: '2026-08-01', endYmd: '2026-08-26' }])
    expect(rows[1]!.segments).toEqual([{ startYmd: '2026-08-27', endYmd: '2026-08-31' }])
    expect(rows[1]!.open).toBe(true)
  })
})

describe('buildRunningSeries + summary', () => {
  const rows = buildWorkedSpans({ ledger, statusByJob: status, todayYmd: TODAY, gapDays: 7 })
  const days = ledger.days.map((d) => d.ymd)
  const series = buildRunningSeries(rows, days, TODAY)

  it('counts spans crossing each day, split by bucket', () => {
    const aug3 = series.days[2]!
    expect(aug3).toMatchObject({ ymd: '2026-08-03', billed: 1, paid: 1, working: 0, total: 2 })
    expect(aug3.jobIds.sort()).toEqual(['j1', 'j2'])
    expect(series.days[10]!.total).toBe(0) // Aug 11, inside the pause
    expect(series.days[30]!).toMatchObject({ ymd: '2026-08-31', working: 1, total: 1 })
  })

  it('reports peak, today, average, and a trailing 7-day mean', () => {
    expect(series.peak).toEqual({ ymd: '2026-08-03', total: 2 })
    expect(series.todayTotal).toBe(1)
    // Running-days: j1 11 + j2 2 + j3 4 = 17 job-days over 31 calendar days.
    expect(series.averageTotal).toBeCloseTo(17 / 31, 6)
    expect(series.avg7[0]).toBe(1)
    expect(series.avg7[4]).toBeCloseTo((1 + 1 + 2 + 2 + 1) / 5, 6)
  })

  it('summarizes rows', () => {
    expect(summarizeJobRuns(rows)).toEqual({ jobs: 3, open: 1, finished: 2, medianRunDays: 4 })
    expect(summarizeJobRuns([])).toEqual({ jobs: 0, open: 0, finished: 0, medianRunDays: null })
  })

  it('month ticks mark the first of each month and the window start', () => {
    expect(monthTicks(days)).toEqual([{ index: 0, label: 'Aug' }])
    const twoMonths = ['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02']
    expect(monthTicks(twoMonths)).toEqual([{ index: 2, label: 'Aug' }])
    const far = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-08-01']
    expect(monthTicks(far)).toEqual([
      { index: 0, label: 'Jul' },
      { index: 5, label: 'Aug' },
    ])
  })
})

describe('colorings (v2.2745)', () => {
  const ledgerWithMoves = buildJobDayLedger({
    startYmd: '2026-08-01',
    endYmd: '2026-08-31',
    officeJobLedgerId: 'office',
    fieldDetailByDay: detail,
    poolUsdByDay: new Map(),
    jobLabels: new Map([['j1', { number: 'J1', name: 'One' }]]),
    // j1 was billed Aug 4 and paid Aug 22; j2 billed Aug 10 (paid later, outside its run); j3 never billed.
    statusSpansByJob: new Map([
      ['j1', { startYmd: '2026-07-20', endYmd: '2026-08-04', billedYmd: '2026-08-04', paidYmd: '2026-08-22' }],
      ['j2', { startYmd: '2026-08-03', endYmd: '2026-08-10', billedYmd: '2026-08-10', paidYmd: '2026-09-01' }],
    ]),
    addDays: ymdAddDays,
  })
  const rows = buildWorkedSpans({ ledger: ledgerWithMoves, statusByJob: status, todayYmd: TODAY, gapDays: 7 })
  const days = ledgerWithMoves.days.map((d) => d.ymd)

  it('rows carry the billed and paid moves', () => {
    expect(rows[0]).toMatchObject({ jobId: 'j1', billedYmd: '2026-08-04', paidYmd: '2026-08-22' })
    expect(rows[2]).toMatchObject({ jobId: 'j3', billedYmd: null, paidYmd: null })
  })

  it('run length bands: 1 day, 2–5, 6+', () => {
    expect(runLengthBand(1)).toBe('d1')
    expect(runLengthBand(5)).toBe('d2_5')
    expect(runLengthBand(6)).toBe('d6p')
    expect(rows.map((r) => runLengthBand(r.runDays))).toEqual(['d6p', 'd2_5', 'd2_5'])
  })

  it('state on the day follows the moves, not today’s status', () => {
    const j1 = rows[0]!
    expect(stateOnDay(j1, '2026-08-01')).toBe('working')
    expect(stateOnDay(j1, '2026-08-04')).toBe('billed')
    expect(stateOnDay(j1, '2026-08-22')).toBe('paid')
    expect(stateOnDay(rows[2]!, '2026-08-29')).toBe('working')
  })

  it('the band series splits the same totals three ways', () => {
    const byStatus = buildRunningSeriesBy(rows, days, TODAY, 'status')
    const byDay = buildRunningSeriesBy(rows, days, TODAY, 'stateOnDay')
    const byLen = buildRunningSeriesBy(rows, days, TODAY, 'runLength')
    for (let i = 0; i < days.length; i++) {
      expect(byDay.days[i]!.total).toBe(byStatus.days[i]!.total)
      expect(byLen.days[i]!.total).toBe(byStatus.days[i]!.total)
    }
    // Aug 3: j1 (billed today, but still working on Aug 3) + j2 (paid today, working on Aug 3)
    expect(byStatus.days[2]!.counts).toMatchObject({ billed: 1, paid: 1, working: 0 })
    expect(byDay.days[2]!.counts).toMatchObject({ working: 2, billed: 0, paid: 0 })
    // Aug 4: j1 billed that day; j2 still working
    expect(byDay.days[3]!.counts).toMatchObject({ working: 1, billed: 1 })
    // Aug 22: j1's second run (20–25) is paid from the 22nd
    expect(byDay.days[21]!.counts).toMatchObject({ paid: 1 })
    expect(byLen.days[2]!.counts).toMatchObject({ d6p: 1, d2_5: 1, d1: 0 })
    expect(byLen.bands).toEqual(['d6p', 'd2_5', 'd1'])
    expect(byStatus.peak).toEqual(buildRunningSeries(rows, days, TODAY).peak)
  })

  it('bar pieces split at the Billed and Paid moves for state on the day', () => {
    const j1 = rows[0]!
    expect(colorSegmentsForRow(j1, 'status').map((s) => s.band)).toEqual(['billed', 'billed'])
    expect(colorSegmentsForRow(j1, 'runLength').map((s) => s.band)).toEqual(['d6p', 'd6p'])
    expect(colorSegmentsForRow(j1, 'stateOnDay')).toEqual([
      { startYmd: '2026-08-01', endYmd: '2026-08-03', band: 'working' },
      { startYmd: '2026-08-04', endYmd: '2026-08-05', band: 'billed' },
      { startYmd: '2026-08-20', endYmd: '2026-08-21', band: 'billed' },
      { startYmd: '2026-08-22', endYmd: '2026-08-25', band: 'paid' },
    ])
    expect(colorSegmentsForRow(rows[2]!, 'stateOnDay')).toEqual([{ startYmd: '2026-08-28', endYmd: '2026-08-31', band: 'working' }])
  })
})
