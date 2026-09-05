import { describe, expect, it } from 'vitest'
import {
  STALE_DRAFT_BILLS_ON_PAID_JOBS_SELECT,
  formatStaleDraftBillAmount,
  mapStaleDraftBillRows,
  summarizeStaleDraftBills,
  type StaleDraftBillJoinRow,
} from './staleDraftBillsOnPaidJobs'

function row(over: Partial<StaleDraftBillJoinRow> = {}, jl: Partial<NonNullable<StaleDraftBillJoinRow['jobs_ledger']>> = {}): StaleDraftBillJoinRow {
  return {
    id: 'inv-1',
    job_id: 'job-903',
    amount: 185,
    created_at: '2026-08-01T00:00:00Z',
    is_primary_rtb_bundle: true,
    jobs_ledger: { hcp_number: '903', click_number: null, job_name: 'Water heater swap', status: 'paid', ...jl },
    ...over,
  }
}

describe('staleDraftBillsOnPaidJobs kernel (v2.2846 one-time sweep)', () => {
  it('maps the two live specimens (688 $5,500 · 903 $185) to display rows', () => {
    const rows = mapStaleDraftBillRows([
      row({ id: 'inv-688', job_id: 'job-688', amount: '5500.00' }, { hcp_number: '688', job_name: 'Repipe' }),
      row(),
    ])
    expect(rows).toEqual([
      {
        invoiceId: 'inv-688',
        jobId: 'job-688',
        jobNumber: '688',
        jobName: 'Repipe',
        amount: 5500,
        createdAt: '2026-08-01T00:00:00Z',
        isPrimaryRemainder: true,
      },
      {
        invoiceId: 'inv-1',
        jobId: 'job-903',
        jobNumber: '903',
        jobName: 'Water heater swap',
        amount: 185,
        createdAt: '2026-08-01T00:00:00Z',
        isPrimaryRemainder: true,
      },
    ])
  })

  it('keeps only drafts whose job is paid, even if the server filter let something through', () => {
    const rows = mapStaleDraftBillRows([
      row({ id: 'keep' }),
      row({ id: 'working' }, { status: 'working' }),
      row({ id: 'billed' }, { status: 'billed' }),
      row({ id: 'nojoin', jobs_ledger: null }),
    ])
    expect(rows.map((r) => r.invoiceId)).toEqual(['keep'])
  })

  it('falls back to the Click number and to dashes', () => {
    const [r] = mapStaleDraftBillRows([row({}, { hcp_number: null, click_number: '77', job_name: '  ' })])
    expect(r?.jobNumber).toBe('77')
    expect(r?.jobName).toBe('—')
    const [none] = mapStaleDraftBillRows([row({}, { hcp_number: null, click_number: null })])
    expect(none?.jobNumber).toBe('—')
  })

  it('summarizes count and total to the cent', () => {
    const rows = mapStaleDraftBillRows([row({ amount: 5500 }), row({ id: 'b', amount: 185.005 })])
    expect(summarizeStaleDraftBills(rows)).toEqual({ count: 2, totalDollars: 5685.01 })
    expect(summarizeStaleDraftBills([])).toEqual({ count: 0, totalDollars: 0 })
  })

  it('formats money', () => {
    expect(formatStaleDraftBillAmount(5500)).toBe('$5,500.00')
    expect(formatStaleDraftBillAmount(185)).toBe('$185.00')
  })

  it('the select embeds the job with its status so the caller can filter on jobs_ledger.status', () => {
    expect(STALE_DRAFT_BILLS_ON_PAID_JOBS_SELECT).toContain('jobs_ledger!inner(')
    expect(STALE_DRAFT_BILLS_ON_PAID_JOBS_SELECT).toMatch(/jobs_ledger!inner\([^)]*\bstatus\b[^)]*\)/)
  })
})
