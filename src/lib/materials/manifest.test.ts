import { describe, expect, it } from 'vitest'
import { invoiceNumber, manifestComparison, parseInvoiceLine, parseInvoiceText, SAMPLE_INVOICE_TEXT } from './manifest'
import type { Movement } from './onSite'

describe('parseInvoiceLine', () => {
  it('reads quantity-first lines with a unit and prices', () => {
    expect(parseInvoiceLine('25    EA    3/4" copper 90                       4.70     117.50')).toEqual({ quantity: 25, name: '3/4" copper 90', unit: 'EA', unitPrice: 4.7, raw: '25    EA    3/4" copper 90                       4.70     117.50' })
    expect(parseInvoiceLine('2 x Wax ring')).toMatchObject({ quantity: 2, name: 'Wax ring', unit: null, unitPrice: null })
    expect(parseInvoiceLine('12 Closet flange 4" $6.40 $76.80')).toMatchObject({ quantity: 12, name: 'Closet flange 4"', unitPrice: 6.4 })
  })
  it('reads name-first lines', () => {
    expect(parseInvoiceLine('3/4 COPPER 90 ELBOW 25 EA 4.70 117.50')).toMatchObject({ quantity: 25, name: '3/4 COPPER 90 ELBOW', unit: 'EA', unitPrice: 4.7 })
  })
  it('leaves out headers, totals and addresses', () => {
    for (const l of ['QTY   UNIT  DESCRIPTION', 'SUBTOTAL 1597.10', 'TOTAL 1728.86', 'Invoice 48812', 'Ship to: Oak Hollow Bldg C, 4410 Pecan Creek Rd', '', '4410 Pecan Creek Rd']) expect(parseInvoiceLine(l)).toBeNull()
  })
  it('reads the sample invoice into six lines and its number', () => {
    const lines = parseInvoiceText(SAMPLE_INVOICE_TEXT)
    expect(lines.map((l) => [l.quantity, l.name])).toEqual([
      [25, '3/4" copper 90'],
      [4, '3/4" ball valve'],
      [30, '3/4" type L copper, 10 ft'],
      [40, '1/2" copper tee'],
      [2, '50 gal gas water heater'],
      [12, 'Wax ring'],
    ])
    expect(invoiceNumber(SAMPLE_INVOICE_TEXT)).toBe('INV-48812')
    expect(invoiceNumber('INV# 77-A')).toBe('INV-77-A')
    expect(invoiceNumber('no number here')).toBeNull()
  })
})

describe('manifestComparison', () => {
  const mv = (over: Partial<Movement> & Pick<Movement, 'reason' | 'quantity'>): Movement => ({ id: Math.random().toString(36), jobId: 'j', partId: null, partName: '3/4" copper 90', manufacturer: null, fromContainerId: null, toContainerId: null, note: '', byUserId: null, byName: 'x', at: '2026-10-20T10:00:00Z', source: null, itemId: null, ...over })
  it('adds bought and reported, reads left from the ledger, and floors the gap at zero', () => {
    const rows = manifestComparison(
      [
        mv({ reason: 'delivered', quantity: 25, toContainerId: 'a2', source: 'INV-48812' }),
        mv({ reason: 'delivered', quantity: 2, toContainerId: 'a2', note: 'added on site' }),
        mv({ reason: 'used', quantity: 10, fromContainerId: 'a2', at: '2026-10-21T10:00:00Z' }),
        mv({ reason: 'returned', quantity: 3, fromContainerId: 'a2', at: '2026-10-21T11:00:00Z' }),
        mv({ reason: 'taken', quantity: 1, fromContainerId: 'a2', at: '2026-10-21T12:00:00Z' }),
        mv({ reason: 'counted', quantity: 9, fromContainerId: 'a2', at: '2026-10-22T10:00:00Z' }),
        mv({ reason: 'delivered', quantity: 12, toContainerId: 'b1', source: 'INV-48812', partName: 'Wax ring' }),
      ],
      (k) => (k === 'text:3/4" copper 90' ? 4.7 : null),
    )
    expect(rows.map((r) => [r.partName, r.bought, r.addedOnSite, r.used, r.returned, r.takenOrDamaged, r.left, r.walkedAway, r.money])).toEqual([
      ['3/4" copper 90', 25, 2, 10, 3, 1, 9, 4, 18.8],
      ['Wax ring', 12, 0, 0, 0, 0, 12, 0, null],
    ])
    expect(rows[0]!.lastCountAt).toBe('2026-10-22T10:00:00Z')
  })
})
