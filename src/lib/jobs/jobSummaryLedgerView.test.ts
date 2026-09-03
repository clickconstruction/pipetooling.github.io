import { describe, expect, it } from 'vitest'
import {
  JOB_SUMMARY_VIEW_DEFAULTS,
  enrichJobSummaryRows,
  filterAndSortJobSummaryRows,
  jobSummaryHygiene,
  jobSummaryRowInWindow,
  jobSummaryWindowStartYmd,
  readJobSummaryViewPrefs,
  sortJobSummaryRows,
  summarizeJobSummaryRows,
  type JobSummaryLedgerRowInput,
} from './jobSummaryLedgerView'
import { buildJobDayLedger } from './jobDayLedger'
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
  startYmd: '2026-09-01',
  endYmd: '2026-09-03',
  officeJobLedgerId: 'office',
  fieldDetailByDay: new Map([
    ['2026-09-01', [line('2026-09-01', 'j931', 'Terry', 8), line('2026-09-01', 'j904', 'Paige', 24)]],
    ['2026-09-02', [line('2026-09-02', 'j931', 'Terry', 16)]],
  ]),
  poolUsdByDay: new Map([
    ['2026-09-01', 320],
    ['2026-09-02', 200],
    ['2026-09-03', 90],
  ]),
  priorHoursByJob: new Map([['j904', 40]]),
  pendingFieldSessions: 2,
  pendingFieldHours: 9,
  invoicedRevenueUsd: 20_000,
  addDays: ymdAddDays,
})

type Row = JobSummaryLedgerRowInput & { job: { job_address?: string | null } }
const row = (id: string, hcp: string, over: Omit<Partial<Row>, 'job'> & { job?: Partial<Row['job']> } = {}): Row => ({
  job: { id, hcp_number: hcp, click_number: null, job_name: `Job ${hcp}`, pct_complete: null, invoices: [], last_work_date: null, created_at: '2026-01-15T00:00:00Z', job_address: null, ...(over.job ?? {}) },
  subLaborCost: over.subLaborCost ?? 0,
  teamLaborCost: over.teamLaborCost ?? 0,
  partsCost: over.partsCost ?? 0,
  totalBill: over.totalBill ?? 0,
})

const rows: Row[] = [
  row('j931', '931', { totalBill: 48_700, teamLaborCost: 1_861, partsCost: 2_325, job: { invoices: [{ status: 'paid', amount: 48_700 }] } }),
  row('j904', '904', { totalBill: 21_400, teamLaborCost: 6_912, subLaborCost: 1_250, partsCost: 4_880, job: { pct_complete: 100 } }),
  row('j990', '990', { totalBill: 10_000, teamLaborCost: 2_000, job: { pct_complete: 40 } }),
  row('j827', '827', { totalBill: 5_983, job: { pct_complete: 100, last_work_date: '2026-08-20' } }),
  row('j000', '', { totalBill: 0, teamLaborCost: 500 }),
]
const reportPct = new Map<string, number>([['j990', 60]])

describe('prefs + window', () => {
  it('reads valid prefs and falls back per field', () => {
    expect(readJobSummaryViewPrefs(null)).toEqual(JOB_SUMMARY_VIEW_DEFAULTS)
    expect(readJobSummaryViewPrefs('{bad')).toEqual(JOB_SUMMARY_VIEW_DEFAULTS)
    expect(readJobSummaryViewPrefs(JSON.stringify({ view: 'days', status: 'all', window: 'nope', method: 'B', sortKey: 'pct', sortDir: 'up' }))).toEqual({
      view: 'days',
      status: 'all',
      window: 'ytd',
      method: 'B',
      sortKey: 'pct',
      sortDir: 'desc',
    })
  })

  it('computes window starts', () => {
    expect(jobSummaryWindowStartYmd('2026-09-03', '90d', ymdAddDays)).toBe('2026-06-06')
    expect(jobSummaryWindowStartYmd('2026-09-03', 'ytd', ymdAddDays)).toBe('2026-01-01')
    expect(jobSummaryWindowStartYmd('2026-09-03', '12mo', ymdAddDays)).toBe('2025-09-04')
    expect(jobSummaryWindowStartYmd('2026-09-03', 'all', ymdAddDays)).toBe('2025-01-01')
  })
})

describe('enrichJobSummaryRows', () => {
  const enriched = enrichJobSummaryRows({ rows, reportPctByJobId: reportPct, ledger, method: 'day' })
  const byId = new Map(enriched.map((r) => [r.row.job.id, r]))

  it('finished jobs show contract; the % resolves paid invoices → report → pct_complete', () => {
    const j931 = byId.get('j931')!
    expect(j931.pct).toBe(100)
    expect(j931.finished).toBe(true)
    expect(j931.revenueUsd).toBe(48_700)
    expect(j931.grossUsd).toBe(48_700 - 1_861 - 2_325)
    expect(j931.marginPct).toBeCloseTo(((48_700 - 4_186) / 48_700) * 100, 6)
  })

  it('in-progress jobs show earned revenue = contract × % (report wins over pct_complete)', () => {
    const j990 = byId.get('j990')!
    expect(j990.pct).toBe(60)
    expect(j990.finished).toBe(false)
    expect(j990.revenueUsd).toBe(6_000)
    expect(j990.flags).toContain('earned')
    expect(j990.flags).not.toContain('assumed-50')
  })

  it('no % on an open job assumes 50% and says so', () => {
    const j000 = byId.get('j000')!
    expect(j000.pct).toBeNull()
    expect(j000.flags).toEqual(expect.arrayContaining(['assumed-50', 'no-pct', 'no-revenue', 'no-hours']))
    expect(j000.revenueUsd).toBe(0)
  })

  it('charges day-share overhead from the ledger and flags prior hours', () => {
    const j931 = byId.get('j931')!
    // Sep 1: 8 of 32 h × $320 = $80; Sep 2: 16 of 16 h × $200 = $200.
    expect(j931.overheadUsd).toBeCloseTo(280, 6)
    expect(j931.hoursInWindow).toBe(24)
    expect(j931.daysInWindow).toBe(2)
    expect(j931.trueProfitUsd).toBeCloseTo(48_700 - 4_186 - 280, 6)
    expect(j931.trueMarginPct).toBeCloseTo(((48_700 - 4_186 - 280) / 48_700) * 100, 6)
    expect(j931.overheadLines.map((l) => l.ymd)).toEqual(['2026-09-01', '2026-09-02'])
    const j904 = byId.get('j904')!
    expect(j904.overheadUsd).toBeCloseTo(240, 6)
    expect(j904.priorHours).toBe(40)
    expect(j904.flags).toContain('prior-hours')
    expect(byId.get('j827')!.overheadUsd).toBe(0)
    expect(byId.get('j827')!.flags).toContain('no-hours')
  })

  it('switches to the lens methods on request', () => {
    const a = enrichJobSummaryRows({ rows, reportPctByJobId: reportPct, ledger, method: 'A' })
    const j931 = a.find((r) => r.row.job.id === 'j931')!
    expect(j931.overheadUsd).toBeCloseTo(24 * (610 / 48), 6)
    const b = enrichJobSummaryRows({ rows, reportPctByJobId: reportPct, ledger, method: 'B' })
    expect(b.find((r) => r.row.job.id === 'j931')!.overheadUsd).toBeCloseTo(48_700 * (610 / 20_000), 6)
  })

  it('leaves overhead and true profit null when the ledger has not loaded', () => {
    const none = enrichJobSummaryRows({ rows, reportPctByJobId: reportPct, ledger: null, method: 'day' })
    expect(none[0]!.overheadUsd).toBeNull()
    expect(none[0]!.trueProfitUsd).toBeNull()
    expect(none[0]!.flags).not.toContain('no-hours')
  })
})

describe('filter + sort + totals', () => {
  const enriched = enrichJobSummaryRows({ rows, reportPctByJobId: reportPct, ledger, method: 'day' })

  it('window membership uses ledger hours, then last work / created date', () => {
    const j827 = enriched.find((r) => r.row.job.id === 'j827')!
    expect(jobSummaryRowInWindow(j827, 'ytd', '2026-01-01', '2026-09-03')).toBe(true)
    expect(jobSummaryRowInWindow(j827, '90d', '2026-06-06', '2026-09-03')).toBe(true)
    expect(jobSummaryRowInWindow(j827, '90d', '2026-08-25', '2026-09-03')).toBe(false)
    expect(jobSummaryRowInWindow(j827, 'all', '2025-01-01', '2026-09-03')).toBe(true)
    const j931 = enriched.find((r) => r.row.job.id === 'j931')!
    expect(jobSummaryRowInWindow(j931, '90d', '2026-08-25', '2026-09-03')).toBe(true)
  })

  it('defaults to finished jobs sorted by true profit, honours search and status', () => {
    const visible = filterAndSortJobSummaryRows({ rows: enriched, prefs: JOB_SUMMARY_VIEW_DEFAULTS, search: '', startYmd: '2026-01-01', endYmd: '2026-09-03' })
    expect(visible.map((r) => r.row.job.id)).toEqual(['j931', 'j904', 'j827'])
    const inProgress = filterAndSortJobSummaryRows({ rows: enriched, prefs: { ...JOB_SUMMARY_VIEW_DEFAULTS, status: 'in_progress' }, search: '', startYmd: '2026-01-01', endYmd: '2026-09-03' })
    expect(inProgress.map((r) => r.row.job.id)).toEqual(['j990', 'j000'])
    const searched = filterAndSortJobSummaryRows({ rows: enriched, prefs: { ...JOB_SUMMARY_VIEW_DEFAULTS, status: 'all' }, search: '904', startYmd: '2026-01-01', endYmd: '2026-09-03' })
    expect(searched.map((r) => r.row.job.id)).toEqual(['j904'])
  })

  it('sorts by any key with nulls last, and by job number numeric-aware with blanks first', () => {
    expect(sortJobSummaryRows(enriched, 'pct', 'asc').map((r) => r.row.job.id)).toEqual(['j990', 'j931', 'j904', 'j827', 'j000'])
    expect(sortJobSummaryRows(enriched, 'job', 'desc').map((r) => r.row.job.id)).toEqual(['j000', 'j990', 'j931', 'j904', 'j827'])
    expect(sortJobSummaryRows(enriched, 'margin', 'desc').map((r) => r.row.job.id)).toEqual(['j827', 'j931', 'j990', 'j904', 'j000'])
  })

  it('totals the visible rows and counts the flags', () => {
    const visible = filterAndSortJobSummaryRows({ rows: enriched, prefs: JOB_SUMMARY_VIEW_DEFAULTS, search: '', startYmd: '2026-01-01', endYmd: '2026-09-03' })
    const t = summarizeJobSummaryRows(visible)
    expect(t.jobs).toBe(3)
    expect(t.revenueUsd).toBe(48_700 + 21_400 + 5_983)
    expect(t.grossUsd).toBe(48_700 - 4_186 + (21_400 - 6_912 - 1_250 - 4_880) + 5_983)
    expect(t.overheadUsd).toBeCloseTo(520, 6)
    expect(t.trueProfitUsd).toBeCloseTo(t.grossUsd - 520, 6)
    expect(t.hours).toBe(48)
    expect(t.truePerHourUsd).toBeCloseTo((t.grossUsd - 520) / 48, 6)
    expect(t.noHoursJobs).toBe(1)
    expect(t.priorHoursJobs).toBe(1)
    expect(t.earnedRows).toBe(0)
  })

  it('reports unallocated overhead and pending sessions from the ledger', () => {
    expect(jobSummaryHygiene(ledger)).toEqual({ unallocatedUsd: 90, unallocatedDays: 1, pendingFieldSessions: 2, pendingFieldHours: 9 })
    expect(jobSummaryHygiene(null)).toBeNull()
  })
})
