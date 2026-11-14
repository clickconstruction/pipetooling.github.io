import { describe, expect, it } from 'vitest'
import { invoiceNumber, landableLines, landedFromInvoice, linePrice, manifestComparison, parseInvoiceLine, parseInvoiceText, readInvoiceText, SAMPLE_INVOICE_TEXT } from './manifest'
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
  it('reads a count with a comma, which dropped the whole line (v2.7250)', () => {
    expect(parseInvoiceLine('1,000 EA 1/2" PEX pipe 0.42 420.00')).toMatchObject({ quantity: 1000, name: '1/2" PEX pipe', unit: 'EA', unitPrice: 0.42 })
    expect(parseInvoiceLine('PEX pipe 1,000 FT 0.42 420.00')).toMatchObject({ quantity: 1000, name: 'PEX pipe', unit: 'FT', unitPrice: 0.42 })
    // With no unit a number that big is a street number, as before.
    expect(parseInvoiceLine('1,000 PEX fittings')).toBeNull()
  })
  it('never takes the whole number of a mixed size for the count', () => {
    // It read as 2 of a half inch pipe. With no unit and no ×, nobody can say, so it is not read.
    expect(parseInvoiceLine('2 1/2" x 10 PVC pipe')).toBeNull()
    // The count is at the end with its unit: 25, of an inch and a half. It read as 1.
    expect(parseInvoiceLine('1 1/2" PVC 90 25 EA 4.70 117.50')).toMatchObject({ quantity: 25, name: '1 1/2" PVC 90', unit: 'EA', unitPrice: 4.7 })
    // A unit or a × says the first number is the count, and a count past 3 is never half of a size.
    expect(parseInvoiceLine('2 EA 1/2" coupling')).toMatchObject({ quantity: 2, name: '1/2" coupling' })
    expect(parseInvoiceLine('2 x 1/2" coupling')).toMatchObject({ quantity: 2, name: '1/2" coupling' })
    expect(parseInvoiceLine('12 3/4 copper 90')).toMatchObject({ quantity: 12, name: '3/4 copper 90' })
  })
  it('never takes a part that ends in ST for a street', () => {
    expect(parseInvoiceLine('10 EA 2" PVC 90 ST')).toMatchObject({ quantity: 10, name: '2" PVC 90 ST', unit: 'EA' })
    expect(parseInvoiceLine('10 2" PVC 90 ST')).toMatchObject({ quantity: 10, name: '2" PVC 90 ST' })
    for (const l of ['500 Oak Dr', '4410 Pecan Creek Rd', 'Round Rock, TX 78664']) expect(parseInvoiceLine(l), l).toBeNull()
  })
  it('reads the unit price off two figures whichever comes first, and off one figure only on a line of one', () => {
    expect(parseInvoiceLine('25 EA elbow 4.70 117.50')).toMatchObject({ unitPrice: 4.7 })
    expect(parseInvoiceLine('25 EA elbow 117.50 4.70')).toMatchObject({ unitPrice: 4.7 })
    // A discount moved the total: the first figure, as printed.
    expect(parseInvoiceLine('25 EA elbow 4.70 110.00')).toMatchObject({ unitPrice: 4.7 })
    expect(parseInvoiceLine('1 EA water heater 184.00')).toMatchObject({ unitPrice: 184 })
    // One figure on a line of 25: each, or the line? It was taken for each, so a line total priced every piece at the lot.
    const lone = parseInvoiceLine('25 EA 3/4 COPPER 90 ELBOW 117.50')!
    expect(lone).toMatchObject({ quantity: 25, unitPrice: null, loneFigure: 117.5 })
    expect(linePrice(lone, null)).toBeNull()
    expect(linePrice(lone, 'each')).toBe(117.5)
    expect(linePrice(lone, 'total')).toBe(4.7)
    // The office's answer never moves a price the line itself gave, and a count typed down to nothing has no price.
    expect(linePrice(parseInvoiceLine('25 EA elbow 4.70 117.50')!, 'total')).toBe(4.7)
    expect(linePrice({ ...lone, quantity: 0 }, 'total')).toBeNull()
    // A no-charge line lands with no price, never a price of nothing.
    expect(parseInvoiceLine('4 EA sample 0.00 0.00')).toMatchObject({ quantity: 4, unitPrice: null })
  })
  it('lists the lines that did not read, and no header, total, address or blank among them', () => {
    const read = readInvoiceText(`${SAMPLE_INVOICE_TEXT}\n2 1/2" x 10 PVC pipe\n1,000 PEX fittings\n\nThank you`)
    expect(read.lines).toHaveLength(6)
    expect(read.notRead).toEqual(['2 1/2" x 10 PVC pipe', '1,000 PEX fittings'])
    expect(readInvoiceText(SAMPLE_INVOICE_TEXT).notRead).toEqual([])
  })
  it('lands only a line with a count and a name, trimmed, and finds an invoice that landed before', () => {
    const line = (quantity: number, name: string) => ({ quantity, name, unit: null, unitPrice: null, raw: '' })
    expect(landableLines([line(4, '  Wax   ring '), line(0, 'Elbow'), line(3, '   ')]).map((l) => [l.quantity, l.name])).toEqual([[4, 'Wax ring']])
    const rows = [
      { reason: 'delivered' as const, source: 'INV-48812', at: '2026-11-03T15:00:00Z' },
      { reason: 'delivered' as const, source: 'inv-48812 ', at: '2026-11-04T15:00:00Z' },
      { reason: 'delivered' as const, source: 'INV-9', at: '2026-11-05T15:00:00Z' },
      { reason: 'used' as const, source: 'INV-48812', at: '2026-11-06T15:00:00Z' },
      { reason: 'delivered' as const, source: null, at: '2026-11-07T15:00:00Z' },
    ]
    expect(landedFromInvoice(rows, ' inv-48812')).toEqual({ lines: 2, lastAt: '2026-11-04T15:00:00Z' })
    expect(landedFromInvoice(rows, 'INV-1')).toBeNull()
    expect(landedFromInvoice(rows, '  ')).toBeNull()
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
