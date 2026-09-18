import { describe, expect, it } from 'vitest'
import {
  buildBillableServiceLinesFromFixtures,
  buildMaterialLinesFromMaterials,
  filterPaymentsForPhysicalInvoiceHistory,
  formatPaymentHistoryRows,
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

  it('filterPaymentsForPhysicalInvoiceHistory keeps this bill and job-level rows, drops another bill', () => {
    const rows = filterPaymentsForPhysicalInvoiceHistory(
      [
        { amount: 1, paid_on: null, payment_type: 'Cash', note: null, invoice_id: null, sequence_order: 0 },
        { amount: 2, paid_on: null, payment_type: 'Card', note: null, invoice_id: 'inv-1', sequence_order: 1 },
        { amount: 3, paid_on: null, payment_type: 'Check', note: null, invoice_id: 'inv-2', sequence_order: 2 },
      ],
      'invoice',
      'inv-1',
    )
    expect(rows.map((r) => r.amount)).toEqual([1, 2])
  })

  // The regression: a second bill with no payments of its own used to fall back
  // to every payment on the job, so the earlier bill's check printed here and
  // the customer was credited twice (job 258: $9,800 billed, read $1,800 due).
  it('filterPaymentsForPhysicalInvoiceHistory shows nothing when every payment belongs to another bill', () => {
    const rows = filterPaymentsForPhysicalInvoiceHistory(
      [{ amount: 8000, paid_on: '2026-06-04', payment_type: 'checkDeposit', note: null, invoice_id: 'inv-1', sequence_order: 0 }],
      'invoice',
      'inv-2',
    )
    expect(rows).toEqual([])
  })

  // Job 102: one bill, one payment recorded without a link. Hiding it would
  // tell the customer they owe the whole bill again.
  it('filterPaymentsForPhysicalInvoiceHistory keeps an unlinked payment when this bill has none of its own', () => {
    const rows = filterPaymentsForPhysicalInvoiceHistory(
      [{ amount: 3000, paid_on: '2026-02-26', payment_type: 'Check', note: null, invoice_id: null, sequence_order: 0 }],
      'invoice',
      'inv-1',
    )
    expect(rows.map((r) => r.amount)).toEqual([3000])
  })

  // v2.3592: with the job's bills in hand, an unlinked payment is placed oldest bill first.
  it('filterPaymentsForPhysicalInvoiceHistory with the bills: job 273 prints each bill\'s share and says when it is a part', () => {
    const bills = [
      { id: 'a', amount: 13420, status: 'billed', sequence_order: 0 },
      { id: 'b', amount: 3500, status: 'billed', sequence_order: 1 },
      { id: 'c', amount: 665, status: 'billed', sequence_order: 2 },
    ]
    const payments = [
      { amount: 10000, paid_on: '2026-06-01', payment_type: 'Check', note: null, invoice_id: null, sequence_order: 0 },
      { amount: 10000, paid_on: '2026-07-01', payment_type: 'Check', note: null, invoice_id: null, sequence_order: 1 },
    ]
    const a = filterPaymentsForPhysicalInvoiceHistory(payments, 'invoice', 'a', bills)
    expect(a.map((r) => [r.amount, r.attributedOf ?? null])).toEqual([[10000, null], [3420, 10000]])
    const b = filterPaymentsForPhysicalInvoiceHistory(payments, 'invoice', 'b', bills)
    expect(b.map((r) => [r.amount, r.attributedOf ?? null])).toEqual([[3500, 10000]])
    const c = filterPaymentsForPhysicalInvoiceHistory(payments, 'invoice', 'c', bills)
    expect(c.map((r) => [r.amount, r.attributedOf ?? null])).toEqual([[665, 10000]])
    expect(formatPaymentHistoryRows(b, (n) => `$${n.toFixed(2)}`)[0]?.label).toBe('Paid Jul 1, 2026 · Check · part of $10000.00')
    expect(formatPaymentHistoryRows(a, (n) => `$${n.toFixed(2)}`)[0]?.label).toBe('Paid Jun 1, 2026 · Check')
  })

  it('filterPaymentsForPhysicalInvoiceHistory with the bills: job 102 still prints its whole payment, and another bill\'s payment never appears', () => {
    const one = filterPaymentsForPhysicalInvoiceHistory(
      [{ amount: 3000, paid_on: '2026-02-26', payment_type: 'Check', note: null, invoice_id: null, sequence_order: 0 }],
      'invoice',
      'inv-1',
      [{ id: 'inv-1', amount: 5355, status: 'billed', sequence_order: 0 }],
    )
    expect(one.map((r) => [r.amount, r.attributedOf ?? null])).toEqual([[3000, null]])
    const two = filterPaymentsForPhysicalInvoiceHistory(
      [{ amount: 8000, paid_on: '2026-06-04', payment_type: 'checkDeposit', note: null, invoice_id: 'inv-1', sequence_order: 0 }],
      'invoice',
      'inv-2',
      [{ id: 'inv-1', amount: 8000, status: 'paid', sequence_order: 1 }, { id: 'inv-2', amount: 9800, status: 'billed', sequence_order: 2 }],
    )
    expect(two).toEqual([])
  })

  it('filterPaymentsForPhysicalInvoiceHistory leaves whole-job bills alone', () => {
    const rows = filterPaymentsForPhysicalInvoiceHistory(
      [
        { amount: 1, paid_on: null, payment_type: 'Cash', note: null, invoice_id: null, sequence_order: 0 },
        { amount: 3, paid_on: null, payment_type: 'Check', note: null, invoice_id: 'inv-2', sequence_order: 2 },
      ],
      'job',
      null,
    )
    expect(rows.map((r) => r.amount)).toEqual([1, 3])
  })
})

describe('payment history customer rows (v2.2313)', () => {
  const usd = (n: number) => `$${n.toFixed(2)}`
  const pay = (over: Partial<import('./physicalInvoiceLineItems').PhysicalInvoicePaymentInput>) => ({
    amount: 100,
    paid_on: '2025-12-17',
    payment_type: 'Check',
    note: null,
    invoice_id: null,
    sequence_order: 1,
    ...over,
  })

  it('never prints the internal note in the customer-facing label', async () => {
    const { formatPaymentHistoryRows } = await import('./physicalInvoiceLineItems')
    const rows = formatPaymentHistoryRows([pay({ note: 'hcp-paydate-corrected-2026-08-24' })], usd)
    expect(rows[0]!.label).toBe('Paid Dec 17, 2025 · Check')
    expect(JSON.stringify(rows)).not.toContain('hcp-paydate')
  })

  it('ledger label (v2.2324): Paid + date, no weekday; generic methods drop their suffix', async () => {
    const { formatPaymentHistoryRows } = await import('./physicalInvoiceLineItems')
    expect(formatPaymentHistoryRows([pay({ payment_type: 'other' })], usd)[0]!.label).toBe('Paid Dec 17, 2025')
    expect(formatPaymentHistoryRows([pay({ payment_type: null })], usd)[0]!.label).toBe('Paid Dec 17, 2025')
    expect(formatPaymentHistoryRows([pay({ payment_type: 'check · 1042' })], usd)[0]!.label).toBe(
      'Paid Dec 17, 2025 · check · 1042',
    )
  })

  it('totals: balance due when partially paid, billed line included (v2.2324)', async () => {
    const { buildPaymentHistoryTotals } = await import('./physicalInvoiceLineItems')
    const t = buildPaymentHistoryTotals([pay({ amount: 8880 }), pay({ amount: 20 }), pay({ amount: 8000 })], 17800, usd)
    expect(t).toEqual({
      billedFormatted: '$17800.00',
      totalPaidFormatted: '$16900.00',
      balanceDueFormatted: '$900.00',
      paidInFull: false,
    })
  })

  it('totals: paid in full at (or above) the invoice amount', async () => {
    const { buildPaymentHistoryTotals } = await import('./physicalInvoiceLineItems')
    expect(buildPaymentHistoryTotals([pay({ amount: 500 })], 500, usd)!.paidInFull).toBe(true)
    expect(buildPaymentHistoryTotals([pay({ amount: 510 })], 500, usd)!.paidInFull).toBe(true)
    expect(buildPaymentHistoryTotals([], 500, usd)).toBeNull()
  })
})
