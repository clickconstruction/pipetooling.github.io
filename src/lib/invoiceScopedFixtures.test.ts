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

describe('fixturesForInvoiceBill — primary remainder composition (v2.2469)', () => {
  const primary = (amount: number) => ({ is_primary_rtb_bundle: true, amount })
  const rows = [
    { id: 'co', invoice_id: 'inv-1', name: 'Change order', count: 1, line_unit_price: 1980 },
    { id: 'hvac', invoice_id: null, name: 'HVAC to spec', count: 1, line_unit_price: 1650 },
  ]

  it('an unlinked primary bills the unlinked segments when they sum exactly to its amount', () => {
    expect(fixturesForInvoiceBill(rows, 'auto-id', primary(1650)).map((r) => r.id)).toEqual(['hvac'])
  })

  it('composes multiple unlinked segments (and applies quantity)', () => {
    const many = [
      { id: 'a', invoice_id: 'inv-1', name: 'Done', count: 1, line_unit_price: 500 },
      { id: 'b', invoice_id: null, name: 'Rough In', count: 2, line_unit_price: 400 },
      { id: 'c', invoice_id: null, name: 'Trim', count: 1, line_unit_price: 700 },
    ]
    expect(fixturesForInvoiceBill(many, 'auto-id', primary(1500)).map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('falls back to whole-job proration when the sum does not match (payment/carve/rider took a bite)', () => {
    expect(fixturesForInvoiceBill(rows, 'auto-id', primary(1400)).map((r) => r.id)).toEqual(['co', 'hvac'])
  })

  it('never composes for a non-primary invoice, even on an exact sum', () => {
    expect(fixturesForInvoiceBill(rows, 'carve-id', { is_primary_rtb_bundle: false, amount: 1650 }).map((r) => r.id)).toEqual([
      'co',
      'hvac',
    ])
    expect(fixturesForInvoiceBill(rows, 'carve-id').map((r) => r.id)).toEqual(['co', 'hvac'])
  })

  it('ignores unnamed and zero-dollar rows in the equality', () => {
    const noisy = [
      ...rows,
      { id: 'unnamed', invoice_id: null, name: '  ', count: 1, line_unit_price: 999 },
      { id: 'free', invoice_id: null, name: 'Freebie', count: 1, line_unit_price: 0 },
    ]
    expect(fixturesForInvoiceBill(noisy, 'auto-id', primary(1650)).map((r) => r.id)).toEqual(['hvac'])
  })

  it('linked rows still win over composition', () => {
    const linked = [{ id: 'x', invoice_id: 'auto-id', name: 'Adopted', count: 1, line_unit_price: 100 }, ...rows]
    expect(fixturesForInvoiceBill(linked, 'auto-id', primary(1650)).map((r) => r.id)).toEqual(['x'])
  })

  it('rejects a non-positive or non-finite amount', () => {
    expect(fixturesForInvoiceBill(rows, 'auto-id', primary(0)).map((r) => r.id)).toEqual(['co', 'hvac'])
    expect(fixturesForInvoiceBill(rows, 'auto-id', { is_primary_rtb_bundle: true, amount: 'nope' }).map((r) => r.id)).toEqual([
      'co',
      'hvac',
    ])
  })
})
