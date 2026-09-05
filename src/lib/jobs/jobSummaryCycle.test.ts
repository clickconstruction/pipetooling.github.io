import { describe, expect, it } from 'vitest'
import { enrichJobSummaryRows } from './jobSummaryLedgerView'
import { bucketJobCycleByMonth, jobCycleRows, median, staleOpenJobs, summarizeJobCycle } from './jobSummaryCycle'

const mk = (id: string, o: { lastWork?: string; billed?: string[]; paid?: string[]; status?: string; amount?: number; gc?: string }) => ({
  job: {
    id,
    hcp_number: id,
    job_name: `Job ${id}`,
    pct_complete: 100,
    status: o.status ?? 'billed',
    last_work_date: o.lastWork ?? null,
    invoices: (o.billed ?? []).map((b) => ({ status: 'billed', amount: o.amount ?? 1000, billed_at: `${b}T15:00:00Z` })),
    payments: (o.paid ?? []).map((p) => ({ paid_on: p, amount: o.amount ?? 1000 })),
    gcCustomer: o.gc ? { name: o.gc } : null,
  },
  subLaborCost: 0,
  teamLaborCost: 0,
  partsCost: 0,
  totalBill: o.amount ?? 1000,
})
const rows = enrichJobSummaryRows({
  rows: [
    mk('a', { lastWork: '2026-08-01', billed: ['2026-08-05'], paid: ['2026-08-25'], status: 'paid', gc: 'Knight' }),
    mk('b', { lastWork: '2026-08-10', billed: ['2026-08-10'], paid: ['2026-09-19'], status: 'paid', gc: 'Palmer' }),
    mk('c', { lastWork: '2026-08-12', billed: ['2026-08-20'], status: 'billed', gc: 'Palmer' }),
    mk('d', { lastWork: '2026-07-20', billed: ['2026-07-18'], paid: ['2026-08-01'], status: 'paid', gc: 'Knight' }), // billed before last work → 0
    mk('e', { lastWork: '2026-08-30', status: 'working' }),
  ],
  reportPctByJobId: new Map(),
  ledger: null,
  method: 'day',
})

describe('cycle (v2.2823)', () => {
  it('median', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 4])).toBe(2.5)
  })

  it('derives the two lags per job from last work, first bill, and the paid date', () => {
    const c = jobCycleRows(rows, null)
    expect(c[0]).toMatchObject({ number: 'a', workToBillDays: 4, billToPaidDays: 20, gcLabel: 'Knight' })
    expect(c[1]).toMatchObject({ workToBillDays: 0, billToPaidDays: 40 })
    expect(c[2]).toMatchObject({ workToBillDays: 8, billToPaidDays: null, paidYmd: null })
    expect(c[3]).toMatchObject({ workToBillDays: 0, billToPaidDays: 14 })
    expect(c[4]).toMatchObject({ billYmd: null, workToBillDays: null })
  })

  it('summarizes medians and names the slowest payer (two jobs or more)', () => {
    const s = summarizeJobCycle(jobCycleRows(rows, null))
    expect(s.billedJobs).toBe(4)
    expect(s.paidJobs).toBe(3)
    expect(s.medianWorkToBill).toBe(2)
    expect(s.medianBillToPaid).toBe(20)
    expect(s.slowestPayer).toEqual({ label: 'Knight', medianDays: 17, jobs: 2 })
    expect(s.fastestPayer).toBeNull()
  })

  it('buckets medians by bill month across the window', () => {
    const months = bucketJobCycleByMonth(jobCycleRows(rows, null), '2026-07-01', '2026-08-31')
    expect(months.map((m) => [m.label, m.billed, m.medianWorkToBill, m.paid, m.medianBillToPaid])).toEqual([
      ['Jul 2026', 1, 0, 1, 14],
      ['Aug 2026', 3, 4, 2, 30],
    ])
  })

  it('lists open jobs idle at least N days, longest first, skipping billed and paid', () => {
    const jobs = [
      { id: 'x', hcp_number: '901', job_name: 'Open old', status: 'working', last_work_date: '2026-08-01', revenue: 5000, gcCustomer: { name: 'Knight' } },
      { id: 'y', hcp_number: '902', job_name: 'Open fresh', status: 'working', last_work_date: '2026-08-30', revenue: 800 },
      { id: 'z', hcp_number: '903', job_name: 'Billed', status: 'billed', last_work_date: '2026-06-01', revenue: 900 },
      { id: 'w', hcp_number: '904', job_name: 'Never worked', status: 'working', last_work_date: null, created_at: '2026-07-01T10:00:00Z', revenue: 1200 },
      { id: 'v', hcp_number: '905', job_name: 'Queued', status: 'waiting', last_work_date: null, created_at: '2026-05-01T10:00:00Z', revenue: 7000 },
    ]
    const stale = staleOpenJobs(jobs, '2026-09-05', 21, null)
    expect(stale.map((s) => [s.number, s.idleDays, s.gcLabel])).toEqual([
      ['904', 66, 'Direct'],
      ['901', 35, 'Knight'],
    ])
    expect(staleOpenJobs(jobs, '2026-09-05', 5, null).map((s) => s.number)).toEqual(['904', '901', '902'])
  })
})
