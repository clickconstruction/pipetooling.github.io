import { describe, expect, it } from 'vitest'
import { buildJobDayLedger } from './jobDayLedger'
import { jobDaysDeltaJumps, jobDaysDeltaSince } from './jobDaysDelta'
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

// Window Aug 1 → Aug 31. j1 billed Aug 26 (open a week ago, closed since); j2 billed Aug 10, paid Aug 28; j3 opened Aug 27, still open.
const detail = new Map<string, OtherJobsLaborDetailLine[]>()
const add = (ymd: string, job: string) => detail.set(ymd, [...(detail.get(ymd) ?? []), line(ymd, job)])
for (const d of ['2026-08-01', '2026-08-05', '2026-08-20', '2026-08-25']) add(d, 'j1')
for (const d of ['2026-08-03', '2026-08-04']) add(d, 'j2')
for (const d of ['2026-08-28', '2026-08-29', '2026-08-30']) add(d, 'j3')

const ledger = buildJobDayLedger({
  startYmd: '2026-08-01',
  endYmd: '2026-08-31',
  officeJobLedgerId: 'office',
  fieldDetailByDay: detail,
  poolUsdByDay: new Map(),
  jobLabels: new Map([
    ['j1', { number: 'J1', name: 'One', status: 'billed' }],
    ['j2', { number: 'J2', name: 'Two', status: 'paid' }],
    ['j3', { number: 'J3', name: 'Three', status: 'working' }],
  ]),
  statusSpansByJob: new Map([
    ['j1', { startYmd: '2026-07-20', endYmd: '2026-08-26', billedYmd: '2026-08-26', paidYmd: null }],
    ['j2', { startYmd: '2026-08-03', endYmd: '2026-08-10', billedYmd: '2026-08-10', paidYmd: '2026-08-28' }],
    ['j3', { startYmd: '2026-08-27', endYmd: null }],
  ]),
  addDays: ymdAddDays,
})
const TODAY = '2026-08-31'
const noStatus = new Map<string, string | null | undefined>()

describe('jobDaysDeltaJumps', () => {
  it('offers only the week chips that fit inside the window, never today', () => {
    expect(jobDaysDeltaJumps(31).map((j) => j.daysBack)).toEqual([7, 14, 21, 28])
    expect(jobDaysDeltaJumps(90).map((j) => j.label)).toEqual(['1 wk', '2 wk', '3 wk', '4 wk', '8 wk'])
    expect(jobDaysDeltaJumps(8).map((j) => j.daysBack)).toEqual([7])
    expect(jobDaysDeltaJumps(1)).toEqual([])
    expect(jobDaysDeltaJumps(0)).toEqual([])
  })
})

describe('jobDaysDeltaSince', () => {
  it('counts what changed since a week ago from the ledger’s own status spans', () => {
    const r = jobDaysDeltaSince({ ledger, statusByJob: noStatus, todayYmd: TODAY, daysBack: 7 })
    expect(r).toEqual({ asOfYmd: '2026-08-24', delta: { opened: 1, billed: 1, paid: 1, stillOpen: 0 } })
  })
  it('lets the page’s status list win over the ledger snapshot', () => {
    // The page says j3 is already billed — the span has no billed move, so the bucket flips but the counts since Aug 24 stay.
    const r = jobDaysDeltaSince({ ledger, statusByJob: new Map([['j3', 'billed']]), todayYmd: TODAY, daysBack: 7 })
    expect(r?.delta.opened).toBe(1)
  })
  it('clamps the as-of day to the window’s first day', () => {
    const r = jobDaysDeltaSince({ ledger, statusByJob: noStatus, todayYmd: TODAY, daysBack: 56 })
    expect(r?.asOfYmd).toBe('2026-08-01')
    expect(r?.delta).toEqual({ opened: 2, billed: 2, paid: 1, stillOpen: 0 })
  })
  it('returns null when there is nothing to rewind to', () => {
    expect(jobDaysDeltaSince({ ledger, statusByJob: noStatus, todayYmd: TODAY, daysBack: 0 })).toBeNull()
    expect(jobDaysDeltaSince({ ledger, statusByJob: noStatus, todayYmd: '2026-08-01', daysBack: 7 })).toBeNull()
    const empty = buildJobDayLedger({ startYmd: '2026-08-02', endYmd: '2026-08-01', officeJobLedgerId: null, fieldDetailByDay: new Map(), poolUsdByDay: new Map(), addDays: ymdAddDays })
    expect(jobDaysDeltaSince({ ledger: empty, statusByJob: noStatus, todayYmd: TODAY, daysBack: 7 })).toBeNull()
  })
})
