import { describe, expect, it } from 'vitest'
import { fixturesForInvoiceBill } from './invoiceScopedFixtures'

describe('fixturesForInvoiceBill', () => {
  const rows = [
    { id: 'a', invoice_id: null },
    { id: 'b', invoice_id: 'inv-1' },
    { id: 'c', invoice_id: 'inv-1' },
    { id: 'd', invoice_id: 'inv-2' },
  ]

  it('returns only the rows linked to the invoice when any exist', () => {
    expect(fixturesForInvoiceBill(rows, 'inv-1').map((r) => r.id)).toEqual(['b', 'c'])
    expect(fixturesForInvoiceBill(rows, 'inv-2').map((r) => r.id)).toEqual(['d'])
  })

  it('falls back to all rows for a dollar invoice with no linked fixtures', () => {
    expect(fixturesForInvoiceBill(rows, 'inv-unlinked').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns all rows without an invoice id, and [] for empty input', () => {
    expect(fixturesForInvoiceBill(rows, null)).toHaveLength(4)
    expect(fixturesForInvoiceBill(undefined, 'inv-1')).toEqual([])
  })
})
