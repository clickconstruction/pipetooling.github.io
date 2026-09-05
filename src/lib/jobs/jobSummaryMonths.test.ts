import { describe, expect, it } from 'vitest'
import { buildJobDayLedger } from './jobDayLedger'
import { enrichJobSummaryRows } from './jobSummaryLedgerView'
import { bucketJobSummaryByMonth, monthLabel, monthsBetween } from './jobSummaryMonths'
import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'

const line = (ymd: string, job: string, hours: number): OtherJobsLaborDetailLine => ({
  sessionId: `${ymd}-${job}`,
  workDate: ymd,
  userName: 'Terry',
  hours,
  laborUsd: hours * 30,
  missingWage: false,
  jobLedgerId: job,
  notes: null,
})

// Window Jul 25 → Aug 10. j1 worked Jul 30 (8h) and Aug 3 (8h); j2 worked Aug 5 (4h); j3 has no hours.
const detail = new Map<string, OtherJobsLaborDetailLine[]>([
  ['2026-07-30', [line('2026-07-30', 'j1', 8)]],
  ['2026-08-03', [line('2026-08-03', 'j1', 8)]],
  ['2026-08-05', [line('2026-08-05', 'j2', 4)]],
])
const pool = new Map<string, number>([
  ['2026-07-26', 100], // Sunday, no field work → unallocated
  ['2026-07-30', 200],
  ['2026-08-03', 300],
  ['2026-08-05', 50],
])
const ledger = buildJobDayLedger({ startYmd: '2026-07-25', endYmd: '2026-08-10', officeJobLedgerId: 'office', fieldDetailByDay: detail, poolUsdByDay: pool, addDays: ymdAddDays })
const mk = (id: string, totalBill: number, last_bill_date: string | null, teamLaborCost = 0, partsCost = 0) => ({
  job: { id, hcp_number: id, job_name: id, pct_complete: 100, last_bill_date },
  subLaborCost: 0,
  teamLaborCost,
  partsCost,
  totalBill,
})
const rows = enrichJobSummaryRows({
  rows: [mk('j1', 1000, '2026-08-06', 480, 100), mk('j2', 400, null, 120, 0), mk('j3', 900, '2026-07-28')],
  reportPctByJobId: new Map(),
  ledger,
  method: 'day',
})

describe('months (v2.2821)', () => {
  it('lists months and labels them', () => {
    expect(monthsBetween('2026-07-25', '2026-08-10')).toEqual(['2026-07', '2026-08'])
    expect(monthsBetween('2025-11-03', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthLabel('2026-08')).toBe('Aug 2026')
  })

  it('work booking spreads each job by its hours per month; overhead is the month pool, unallocated included', () => {
    const s = bucketJobSummaryByMonth({ rows, ledger, bookBy: 'work', startYmd: '2026-07-25', endYmd: '2026-08-10' })
    expect(s.months.map((m) => m.label)).toEqual(['Jul 2026', 'Aug 2026'])
    const [jul, aug] = s.months
    // j1: half its hours in Jul, half in Aug → revenue 500/500, labor 240/240, parts 50/50; j2 all Aug.
    expect(jul).toMatchObject({ jobs: 1, revenueUsd: 500, laborUsd: 240, partsUsd: 50, overheadUsd: 300, unallocatedUsd: 100, fieldHours: 8 })
    expect(aug).toMatchObject({ jobs: 2, revenueUsd: 900, laborUsd: 360, partsUsd: 50, overheadUsd: 350, unallocatedUsd: 0, fieldHours: 12 })
    expect(jul!.trueProfitUsd).toBeCloseTo(500 - 240 - 50 - 300)
    expect(aug!.trueMarginPct).toBeCloseTo(((900 - 360 - 50 - 350) / 900) * 100)
    // j3 has no hours → counted aside, not silently dropped
    expect(s.unplacedJobs).toBe(1)
    expect(s.unplacedRevenueUsd).toBe(900)
    expect(s.totals.overheadUsd).toBe(650)
    expect(s.totals.trueProfitUsd).toBeCloseTo(1400 - 600 - 100 - 650)
    expect(s.best?.label).toBe('Aug 2026')
  })

  it('bill booking places whole jobs by last bill date and sets unbilled aside', () => {
    const s = bucketJobSummaryByMonth({ rows, ledger, bookBy: 'bill', startYmd: '2026-07-25', endYmd: '2026-08-10' })
    const [jul, aug] = s.months
    expect(jul).toMatchObject({ jobs: 1, revenueUsd: 900 })
    expect(aug).toMatchObject({ jobs: 1, revenueUsd: 1000, laborUsd: 480 })
    expect(s.unplacedJobs).toBe(1) // j2, never billed
  })

  it('leaves overhead and true profit null without a ledger', () => {
    const noLedger = enrichJobSummaryRows({ rows: [mk('j1', 1000, '2026-08-06')], reportPctByJobId: new Map(), ledger: null, method: 'day' })
    const s = bucketJobSummaryByMonth({ rows: noLedger, ledger: null, bookBy: 'bill', startYmd: '2026-08-01', endYmd: '2026-08-31' })
    expect(s.months[0]).toMatchObject({ overheadUsd: null, trueProfitUsd: null, revenueUsd: 1000 })
    expect(s.totals.trueProfitUsd).toBeNull()
  })
})
