import { describe, expect, it } from 'vitest'
import { buildFixBillLineItems } from './fixBillLines'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

function job(p: Partial<Record<string, unknown>>): JobWithDetails {
  return {
    id: 'j1',
    hcp_number: '964',
    click_number: null,
    job_name: 'Pondhill demo',
    customer_name: 'Knight Contracting',
    revenue: 500,
    payments_made: 0,
    payments: [],
    invoices: [],
    ...p,
  } as unknown as JobWithDetails
}

describe('buildFixBillLineItems', () => {
  it('lists open shells biggest-first; skips invoice rows and paid-to-zero shells', () => {
    const small: StageRow = { kind: 'job', job: job({ id: 'a', revenue: 200 }) }
    const big: StageRow = { kind: 'job', job: job({ id: 'b', revenue: 900, job_name: 'Big job' }) }
    const paid: StageRow = { kind: 'job', job: job({ id: 'c', revenue: 300, payments_made: 300 }) }
    const invoiceRow = {
      kind: 'invoice',
      job: job({ id: 'd' }),
      inv: { id: 'i1', amount: 100, status: 'billed', billed_at: '2026-08-01T00:00:00Z', estimated_bill_date: null, sequence_order: 1 },
    } as unknown as StageRow
    const items = buildFixBillLineItems([small, big, paid, invoiceRow])
    expect(items.map((i) => i.jobId)).toEqual(['b', 'a'])
    expect(items[0]).toEqual({ jobId: 'b', label: '964 · Big job', customerName: 'Knight Contracting', open: 900 })
  })

  it('falls back to the bare number when the job has no name', () => {
    const r: StageRow = { kind: 'job', job: job({ job_name: '  ', customer_name: null }) }
    expect(buildFixBillLineItems([r])[0]).toMatchObject({ label: '964', customerName: null })
  })
})
