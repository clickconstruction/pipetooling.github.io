import { describe, expect, it } from 'vitest'
import {
  buildBillableServiceLinesFromFixtures,
  buildMaterialLinesFromMaterials,
  filterPaymentsForPhysicalInvoiceHistory,
  fixtureMaterialTotalMatchesBill,
  isBillableFixtureRow,
  resolvePhysicalInvoiceLinePresentation,
} from './physicalInvoiceLineItems'

describe('physicalInvoiceLineItems', () => {
  it('isBillableFixtureRow matches Stripe billable rule', () => {
    expect(isBillableFixtureRow({ name: '  ', count: 1, line_unit_price: 10 })).toBe(false)
    expect(isBillableFixtureRow({ name: 'Sink', count: 2, line_unit_price: 50 })).toBe(true)
    expect(isBillableFixtureRow({ name: 'Sink', count: 1, line_unit_price: 0 })).toBe(false)
  })

  it('buildBillableServiceLinesFromFixtures respects sequence_order', () => {
    const lines = buildBillableServiceLinesFromFixtures([
      { name: 'B', count: 1, line_unit_price: 1, line_description: null, sequence_order: 2 },
      { name: 'A', count: 1, line_unit_price: 2, line_description: 'note', sequence_order: 1 },
    ])
    expect(lines.map((l) => l.description)).toEqual(['A\nnote', 'B'])
    expect(lines[0]?.amount).toBe(2)
    expect(lines[1]?.amount).toBe(1)
  })

  it('buildMaterialLinesFromMaterials drops zero amounts', () => {
    expect(
      buildMaterialLinesFromMaterials([
        { description: 'Parts', amount: 0, sequence_order: 0 },
        { description: 'Copper', amount: 12.5, sequence_order: 1 },
      ]),
    ).toHaveLength(1)
  })

  it('resolvePhysicalInvoiceLinePresentation uses exact rows when bill matches materials + fixtures', () => {
    const r = resolvePhysicalInvoiceLinePresentation(
      150,
      '',
      'fallback',
      [{ name: 'A', count: 1, line_unit_price: 100, line_description: null, sequence_order: 0 }],
      [{ description: 'M', amount: 50, sequence_order: 0 }],
    )
    expect(r.breakdownMatches).toBe(true)
    expect(r.serviceLines).toHaveLength(1)
    expect(r.serviceLines[0]?.amount).toBe(100)
    expect(r.materialLines).toHaveLength(1)
  })

  it('resolvePhysicalInvoiceLinePresentation proportionally scales fixtures to bill (Stripe parity)', () => {
    const fixtures = [
      { name: 'A', count: 1, line_unit_price: 60, line_description: null, sequence_order: 0 },
      { name: 'B', count: 1, line_unit_price: 40, line_description: null, sequence_order: 1 },
    ]
    const full = resolvePhysicalInvoiceLinePresentation(100, '', 'x', fixtures, [])
    expect(full.serviceLines).toHaveLength(2)
    expect(full.serviceLines.reduce((s, l) => s + l.amount, 0)).toBe(100)
    expect(full.materialLines).toHaveLength(0)

    const partial = resolvePhysicalInvoiceLinePresentation(80, '', 'x', fixtures, [])
    expect(partial.serviceLines).toHaveLength(2)
    expect(partial.serviceLines.reduce((s, l) => s + l.amount, 0)).toBe(80)
  })

  it('resolvePhysicalInvoiceLinePresentation reserves materials from bill before scaling services', () => {
    const r = resolvePhysicalInvoiceLinePresentation(
      100,
      '',
      'x',
      [{ name: 'Lab', count: 1, line_unit_price: 70, line_description: null, sequence_order: 0 }],
      [{ description: 'Parts', amount: 30, sequence_order: 0 }],
    )
    expect(r.materialLines).toHaveLength(1)
    expect(r.serviceLines).toHaveLength(1)
    expect(r.serviceLines[0]?.amount).toBe(70)
  })

  it('resolvePhysicalInvoiceLinePresentation line-on-bill override: single full line, no materials', () => {
    const r = resolvePhysicalInvoiceLinePresentation(
      100,
      'Custom override text',
      'ignored',
      [{ name: 'A', count: 1, line_unit_price: 60, line_description: null, sequence_order: 0 }],
      [{ description: 'M', amount: 40, sequence_order: 0 }],
    )
    expect(r.serviceLines).toEqual([
      expect.objectContaining({
        description: 'Custom override text',
        qty: 1,
        unitPrice: 100,
        amount: 100,
      }),
    ])
    expect(r.materialLines).toHaveLength(0)
  })

  it('resolvePhysicalInvoiceLinePresentation uses narrative when no billable fixtures', () => {
    const r = resolvePhysicalInvoiceLinePresentation(250, '', 'Custom narrative', [], [])
    expect(r.serviceLines).toEqual([
      expect.objectContaining({
        description: 'Custom narrative',
        qty: 1,
        unitPrice: 250,
        amount: 250,
      }),
    ])
  })

  it('fixtureMaterialTotalMatchesBill uses epsilon', () => {
    const s = [{ description: 'x', qty: 1, unitPrice: 100.005, amount: 100.005 }]
    expect(fixtureMaterialTotalMatchesBill(100.01, s, [])).toBe(true)
    expect(fixtureMaterialTotalMatchesBill(101, s, [])).toBe(false)
  })

  it('filterPaymentsForPhysicalInvoiceHistory prefers invoice-linked rows', () => {
    const rows = filterPaymentsForPhysicalInvoiceHistory(
      [
        { amount: 1, paid_on: null, payment_type: 'Cash', note: null, invoice_id: null, sequence_order: 0 },
        { amount: 2, paid_on: null, payment_type: 'Card', note: null, invoice_id: 'inv-1', sequence_order: 1 },
      ],
      'invoice',
      'inv-1',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.amount).toBe(2)
  })
})
