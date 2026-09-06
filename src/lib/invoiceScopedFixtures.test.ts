import { describe, expect, it } from 'vitest'
import { fixturesForInvoiceBill } from './invoiceScopedFixtures'
import { scopeFixturesToInvoice } from '../../supabase/functions/_shared/stripeInvoiceItemsFromFixtures'

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

  it('a dollar invoice with no linked fixtures gets the unlinked rows only (v2.2589)', () => {
    expect(fixturesForInvoiceBill(rows, 'inv-unlinked').map((r) => r.id)).toEqual(['a'])
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

  it('prorates over the still-unlinked rows only when the sum does not match (v2.2589 — Taunya, job 978)', () => {
    // A payment took a bite ($577.50 of the $1,650 HVAC line), so the primary
    // bundle is $1,072.50 and the exact-sum composition cannot apply. Before
    // v2.2589 this fell back to the WHOLE job and the customer's bill showed
    // the already-billed change order again ($585.00 + $487.50 prorated);
    // now the bill lists only the unlinked line.
    expect(fixturesForInvoiceBill(rows, 'auto-id', primary(1072.5)).map((r) => r.id)).toEqual(['hvac'])
  })

  it('a non-primary carve also lists only the still-unlinked rows (never composes at real prices)', () => {
    expect(fixturesForInvoiceBill(rows, 'carve-id', { is_primary_rtb_bundle: false, amount: 1650 }).map((r) => r.id)).toEqual([
      'hvac',
    ])
    expect(fixturesForInvoiceBill(rows, 'carve-id').map((r) => r.id)).toEqual(['hvac'])
  })

  it('returns [] when every row is linked elsewhere (builders fall back to single-line)', () => {
    const allLinked = [
      { id: 'x', invoice_id: 'inv-1', name: 'Done', count: 1, line_unit_price: 500 },
      { id: 'y', invoice_id: 'inv-2', name: 'Also done', count: 1, line_unit_price: 700 },
    ]
    expect(fixturesForInvoiceBill(allLinked, 'auto-id', primary(300))).toEqual([])
  })

  it('ignores unnamed and zero-dollar rows in the equality (but keeps them in the fallback set)', () => {
    const noisy = [
      ...rows,
      { id: 'unnamed', invoice_id: null, name: '  ', count: 1, line_unit_price: 999 },
      { id: 'free', invoice_id: null, name: 'Freebie', count: 1, line_unit_price: 0 },
    ]
    expect(fixturesForInvoiceBill(noisy, 'auto-id', primary(1650)).map((r) => r.id)).toEqual(['hvac'])
    // Fallback keeps unnamed/zero-dollar UNLINKED rows — the builders filter
    // billability themselves, and the physical doc may render them.
    expect(fixturesForInvoiceBill(noisy, 'auto-id', primary(1400)).map((r) => r.id)).toEqual(['hvac', 'unnamed', 'free'])
  })

  it('linked rows still win over composition', () => {
    const linked = [{ id: 'x', invoice_id: 'auto-id', name: 'Adopted', count: 1, line_unit_price: 100 }, ...rows]
    expect(fixturesForInvoiceBill(linked, 'auto-id', primary(1650)).map((r) => r.id)).toEqual(['x'])
  })

  it('rejects a non-positive or non-finite amount (still excludes other-invoice rows)', () => {
    expect(fixturesForInvoiceBill(rows, 'auto-id', primary(0)).map((r) => r.id)).toEqual(['hvac'])
    expect(fixturesForInvoiceBill(rows, 'auto-id', { is_primary_rtb_bundle: true, amount: 'nope' }).map((r) => r.id)).toEqual([
      'hvac',
    ])
  })
})

describe('client/edge scoping parity', () => {
  // The edge functions are authoritative for what Stripe renders; this keeps
  // the client previews/physical docs saying the same thing (the
  // estimateOptionsSharedParity pattern).
  const rows = [
    { id: 'co', invoice_id: 'inv-1', name: 'Change order', count: 1, line_unit_price: 1980 },
    { id: 'hvac', invoice_id: null, name: 'HVAC to spec', count: 1, line_unit_price: 1650 },
    { id: 'trim', invoice_id: null, name: 'Trim', count: 1, line_unit_price: 700 },
  ]
  const cases: Array<{ label: string; amountDollars: number; primary: boolean }> = [
    { label: 'exact-sum composition', amountDollars: 2350, primary: true },
    { label: 'unlinked-only proration fallback', amountDollars: 1072.5, primary: true },
    { label: 'non-primary carve', amountDollars: 500, primary: false },
  ]

  for (const c of cases) {
    it(`agrees on ${c.label}`, () => {
      const client = fixturesForInvoiceBill(rows, 'target-id', {
        is_primary_rtb_bundle: c.primary,
        amount: c.amountDollars,
      }).map((r) => r.id)
      const edge = scopeFixturesToInvoice(rows, 'target-id', {
        isPrimaryRtbBundle: c.primary,
        targetAmountCents: Math.round(c.amountDollars * 100),
      }).map((r) => r.id)
      expect(edge).toEqual(client)
    })
  }

  it('agrees on linked rows winning', () => {
    const linked = [{ id: 'x', invoice_id: 'target-id', name: 'Adopted', count: 1, line_unit_price: 100 }, ...rows]
    expect(scopeFixturesToInvoice(linked, 'target-id').map((r) => r.id)).toEqual(
      fixturesForInvoiceBill(linked, 'target-id').map((r) => r.id),
    )
  })
})

describe('fixturesForInvoiceBill — payments-covered rows never re-list (B6 / J3-6)', () => {
  const primary = (amount: number) => ({ is_primary_rtb_bundle: true, amount })
  // The live specimen: a $370 job in two $185 segments, $185 already paid, the
  // primary remainder is $185. Before: both rows re-listed at $92.50 each.
  const twoEqual = [
    { id: 'faucet', invoice_id: null, name: 'Repaired kitchen faucet', count: 1, line_unit_price: 185 },
    { id: 'extra', invoice_id: null, name: 'Extra', count: 1, line_unit_price: 185 },
  ]

  it('drops the rows the paid pool swallows whole, in order', () => {
    expect(fixturesForInvoiceBill(twoEqual, 'auto', primary(185)).map((r) => r.id)).toEqual(['extra'])
  })

  it('keeps the row the pool runs out inside and every row after it', () => {
    const rows = [
      { id: 'a', invoice_id: null, name: 'A', count: 1, line_unit_price: 100 },
      { id: 'b', invoice_id: null, name: 'B', count: 1, line_unit_price: 100 },
      { id: 'c', invoice_id: null, name: 'C', count: 1, line_unit_price: 170 },
    ]
    // $150 covered: A gone, B half-covered stays, C stays → proration over [b, c]
    expect(fixturesForInvoiceBill(rows, 'auto', primary(220)).map((r) => r.id)).toEqual(['b', 'c'])
    // $100 covered exactly one row: [b, c] at their real prices (exact sum → composition)
    expect(fixturesForInvoiceBill(rows, 'auto', primary(270)).map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('a positive remainder always keeps at least the last row — the pool can never swallow everything', () => {
    const rows = [
      { id: 'a', invoice_id: null, name: 'A', count: 1, line_unit_price: 100 },
      { id: 'b', invoice_id: null, name: 'B', count: 1, line_unit_price: 100 },
    ]
    // 1¢ left to bill: pool = $199.99 eats A whole and runs out inside B
    expect(fixturesForInvoiceBill(rows, 'auto', primary(0.01)).map((r) => r.id)).toEqual(['b'])
    // a zero / negative remainder is not a bill; nothing is dropped (the modal's "Nothing left to bill" gate owns that case)
    expect(fixturesForInvoiceBill(rows, 'auto', primary(0)).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('a remainder at or above the unlinked sum drops nothing (riders / extras inflate it)', () => {
    expect(fixturesForInvoiceBill(twoEqual, 'auto', primary(370)).map((r) => r.id)).toEqual(['faucet', 'extra'])
    expect(fixturesForInvoiceBill(twoEqual, 'auto', primary(400)).map((r) => r.id)).toEqual(['faucet', 'extra'])
  })

  it('only the PRIMARY remainder applies the rule; a dollar carve keeps every unlinked row', () => {
    expect(fixturesForInvoiceBill(twoEqual, 'carve', { is_primary_rtb_bundle: false, amount: 185 }).map((r) => r.id)).toEqual([
      'faucet',
      'extra',
    ])
    expect(fixturesForInvoiceBill(twoEqual, 'carve').map((r) => r.id)).toEqual(['faucet', 'extra'])
  })

  it('unpriced / unnamed rows ride through untouched and never count toward the pool', () => {
    const rows = [
      { id: 'note', invoice_id: null, name: '', count: 1, line_unit_price: 999 },
      ...twoEqual,
      { id: 'free', invoice_id: null, name: 'Courtesy', count: 1, line_unit_price: 0 },
    ]
    expect(fixturesForInvoiceBill(rows, 'auto', primary(185)).map((r) => r.id)).toEqual(['note', 'extra', 'free'])
  })

  it('rows linked to OTHER bills are excluded first, then coverage applies to what is left', () => {
    const rows = [{ id: 'co', invoice_id: 'inv-9', name: 'Change order', count: 1, line_unit_price: 500 }, ...twoEqual]
    expect(fixturesForInvoiceBill(rows, 'auto', primary(185)).map((r) => r.id)).toEqual(['extra'])
  })

  it('edge mirror scopeFixturesToInvoice applies the identical rule', () => {
    const p = (cents: number) => ({ isPrimaryRtbBundle: true, targetAmountCents: cents })
    expect(scopeFixturesToInvoice(twoEqual, 'auto', p(18500)).map((r) => r.id)).toEqual(['extra'])
    const rows = [
      { id: 'a', invoice_id: null, name: 'A', count: 1, line_unit_price: 100 },
      { id: 'b', invoice_id: null, name: 'B', count: 1, line_unit_price: 100 },
      { id: 'c', invoice_id: null, name: 'C', count: 1, line_unit_price: 170 },
    ]
    expect(scopeFixturesToInvoice(rows, 'auto', p(22000)).map((r) => r.id)).toEqual(['b', 'c'])
    expect(scopeFixturesToInvoice(twoEqual, 'auto', p(37000)).map((r) => r.id)).toEqual(['faucet', 'extra'])
    expect(scopeFixturesToInvoice(twoEqual, 'auto', { isPrimaryRtbBundle: false, targetAmountCents: 18500 }).map((r) => r.id)).toEqual([
      'faucet',
      'extra',
    ])
  })
})
