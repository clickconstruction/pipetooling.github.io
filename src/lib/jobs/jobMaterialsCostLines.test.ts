import { describe, expect, it } from 'vitest'
import {
  jobAccountSplitFromLines,
  mercuryCardTotalFromLines,
  mercuryLinesFromRows,
  supplyInvoiceTotalFromRows,
  supplyLinesFromRows,
  tallyLinesFromRows,
  tallyPartsTotalFromLines,
} from '../../../supabase/functions/_shared/jobMaterialsCostLines'

describe('jobMaterialsCostLines — the mappers the browser and dev-mcp share', () => {
  it('picks this job out of the invoice-amounts RPC, and reads a missing job as $0', () => {
    const rows = [{ job_id: 'j1', invoice_amount: '120.50' }, { job_id: 'j2', invoice_amount: 9 }]
    expect(supplyInvoiceTotalFromRows(rows, 'j1')).toBe(120.5)
    expect(supplyInvoiceTotalFromRows(rows, 'nope')).toBe(0)
    expect(supplyInvoiceTotalFromRows(null, 'j1')).toBe(0)
  })

  it('allocates an invoice by pct, unwraps array embeds, and skips an allocation whose invoice is gone', () => {
    const lines = supplyLinesFromRows([
      { pct: '25', supply_house_invoices: { invoice_number: 'S1', invoice_date: '2026-09-02T00:00:00Z', amount: '400', is_paid: false, on_job_account: true, supply_houses: [{ name: 'Morrison' }] } },
      { pct: 100, supply_house_invoices: [{ invoice_number: 'S2', invoice_date: null, amount: -30, is_paid: null, on_job_account: null, supply_houses: null }] },
      { pct: 50, supply_house_invoices: null },
    ])
    expect(lines).toEqual([
      { pct: 25, invoiceNumber: 'S1', invoiceDate: '2026-09-02', invoiceAmount: 400, allocatedAmount: 100, supplyHouseName: 'Morrison', isPaid: false, onJobAccount: true },
      { pct: 100, invoiceNumber: 'S2', invoiceDate: '', invoiceAmount: -30, allocatedAmount: -30, supplyHouseName: null, isPaid: false, onJobAccount: false },
    ])
    // The exposure split counts unpaid, non-credit lines only.
    expect(jobAccountSplitFromLines(lines)).toEqual({ unpaidTotal: 100, unpaidOnJobAccount: 100 })
  })

  it('maps card allocations and reads the card id out of the bank transaction', () => {
    const lines = mercuryLinesFromRows([
      { id: 'a1', amount: '-45.25', note: 'PVC', mercury_transactions: { posted_at: '2026-09-02', counterparty_name: 'Home Depot', raw: { details: { debitCardInfo: { id: '0A1B2C3D-0000-4000-8000-000000000001' } } } } },
      { id: 'a2', amount: 10, mercury_transactions: null },
    ])
    expect(lines[0]).toEqual({ id: 'a1', allocationAmount: -45.25, note: 'PVC', postedAt: '2026-09-02', counterpartyName: 'Home Depot', debitCardId: '0a1b2c3d-0000-4000-8000-000000000001' })
    expect(lines[1]).toEqual({ id: 'a2', allocationAmount: 10, note: null, postedAt: null, counterpartyName: null, debitCardId: null })
    expect(mercuryCardTotalFromLines(lines)).toBeCloseTo(mercuryCardTotalFromLines([lines[0]!]) + mercuryCardTotalFromLines([lines[1]!]))
  })

  it('keeps only this job from the all-jobs tally RPC: a part prices at price-at-time, a bare fixture at its cost', () => {
    const lines = tallyLinesFromRows(
      [
        { id: 't1', job_id: 'j1', quantity: '2', part_id: 'p1', price_at_time: '12.5', fixture_cost: 99, fixture_name: 'WC', part_name: ' Wax ring ', created_at: '2026-09-01', created_by_name: 'Al' },
        { id: 't2', job_id: 'j1', quantity: 3, part_id: '', price_at_time: 1, fixture_cost: '20', fixture_name: null, part_name: '  ', created_at: null, created_by_name: '' },
        { id: 't3', job_id: 'other', quantity: 1, part_id: 'p9', price_at_time: 500 },
      ],
      'j1',
    )
    expect(lines.map((l) => [l.id, l.lineTotal, l.partName, l.createdByName])).toEqual([
      ['t1', 25, ' Wax ring ', 'Al'],
      ['t2', 60, null, null],
    ])
    expect(tallyPartsTotalFromLines(lines)).toBe(85)
  })
})
