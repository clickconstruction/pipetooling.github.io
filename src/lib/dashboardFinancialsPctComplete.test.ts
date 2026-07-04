// Separate from dashboardFinancials.test.ts only to keep this change self-contained;
// covers the pct_complete → pctComplete pass-through on Not-billed items.
import { describe, expect, it } from 'vitest'
import { buildUnbilledBucket, type FinancialJobRow } from './dashboardFinancials'

function job(overrides: Partial<FinancialJobRow>): FinancialJobRow {
  return {
    id: 'j1',
    hcp_number: '500',
    click_number: null,
    job_name: 'Smith House',
    status: 'working',
    revenue: 1000,
    payments_made: 0,
    last_bill_date: null,
    last_work_date: '2026-06-18',
    ...overrides,
  }
}

describe('buildUnbilledBucket pctComplete', () => {
  it('carries jobs_ledger.pct_complete onto the item', () => {
    const bucket = buildUnbilledBucket([job({ pct_complete: 65 })], [])
    expect(bucket.items[0]?.pctComplete).toBe(65)
  })

  it('is null when the job has no % complete set (unset or absent field)', () => {
    const bucket = buildUnbilledBucket(
      [job({ id: 'j1', pct_complete: null }), job({ id: 'j2', hcp_number: '501' })],
      [],
    )
    expect(bucket.items.map((i) => i.pctComplete)).toEqual([null, null])
  })

  it('keeps 0% distinct from unset', () => {
    const bucket = buildUnbilledBucket([job({ pct_complete: 0 })], [])
    expect(bucket.items[0]?.pctComplete).toBe(0)
  })
})
