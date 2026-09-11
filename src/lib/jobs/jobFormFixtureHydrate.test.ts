import { describe, expect, it } from 'vitest'
import { fixtureRowsFromDb, legacyNegativeAsDiscount, normalizeFormFixtureRows, type DbFixtureRowLike } from './jobFormFixtureHydrate'

const db = (o: Partial<DbFixtureRowLike> & { id: string; sequence_order: number }): DbFixtureRowLike => ({
  name: 'Rough In',
  count: 1,
  line_unit_price: 15098,
  line_description: null,
  invoice_id: null,
  line_kind: 'work',
  stage_kind: 'order',
  shared_with_gc: false,
  ...o,
})

describe('fixtureRowsFromDb', () => {
  it('reads a discount row: kind, live percent, basis positions → ids, reason; the price re-derives', () => {
    const rows = fixtureRowsFromDb([
      db({ id: 'a', sequence_order: 0 }),
      db({ id: 'b', sequence_order: 1, name: 'Top Out' }),
      db({ id: 'c', sequence_order: 2, name: 'Trim Set', line_unit_price: '7549' }),
      db({
        id: 'd',
        sequence_order: 3,
        name: 'Negotiated discount',
        line_kind: 'discount',
        line_unit_price: '-1.00',
        discount_pct: '10.0000',
        discount_basis_positions: [0, 2],
        discount_reason: 'Negotiated',
        count: 7,
        stage_kind: 'any',
        shared_with_gc: true,
      }),
    ])
    expect(rows[3]).toMatchObject({
      line_kind: 'discount',
      discount_pct: 10,
      discount_basis_ids: ['a', 'c'],
      discount_reason: 'Negotiated',
      count: 1,
      line_unit_price: -2264.7,
      stage_kind: null,
      shared_with_gc: false,
    })
    expect(rows[0]).toMatchObject({ line_kind: 'work', stage_kind: 'order', line_unit_price: 15098 })
    expect(rows[2]!.line_unit_price).toBe(7549)
  })
  it('maps positions by sequence_order even when the rows arrive out of order', () => {
    const rows = fixtureRowsFromDb([
      db({ id: 'd', sequence_order: 2, name: 'Disc', line_kind: 'discount', discount_pct: 50, discount_basis_positions: [1] }),
      db({ id: 'b', sequence_order: 1, name: 'Top Out', line_unit_price: 200 }),
      db({ id: 'a', sequence_order: 0, line_unit_price: 100 }),
    ])
    expect(rows[0]).toMatchObject({ discount_basis_ids: ['b'], line_unit_price: -100 })
  })
  it('a legacy negative work row (a change-order credit) becomes a fixed dollar discount', () => {
    const rows = fixtureRowsFromDb([
      db({ id: 'a', sequence_order: 0, line_unit_price: 2840 }),
      db({ id: 'x', sequence_order: 1, name: 'Credit: remove hose bib', line_unit_price: -195, count: 2, line_kind: 'work', stage_kind: 'any' }),
    ])
    expect(rows[1]).toMatchObject({ line_kind: 'discount', discount_pct: null, discount_basis_ids: null, count: 1, line_unit_price: -390, stage_kind: null })
  })
  it('rows without the columns (pre-push shape) read as work rows', () => {
    const rows = fixtureRowsFromDb([{ id: 'a', sequence_order: 0, name: 'Rough In', count: 1, line_unit_price: 10, line_description: null }])
    expect(rows[0]).toMatchObject({ line_kind: 'work', stage_kind: null, shared_with_gc: false })
  })
})

describe('legacyNegativeAsDiscount / normalizeFormFixtureRows', () => {
  it('leaves positive and discount rows alone', () => {
    const w = { id: 'a', name: 'Rough In', count: 1, line_unit_price: 10, line_description: '', invoice_id: null }
    expect(legacyNegativeAsDiscount(w)).toBe(w)
    const d = { ...w, id: 'd', line_kind: 'discount' as const, line_unit_price: -5 }
    expect(legacyNegativeAsDiscount(d)).toBe(d)
  })
  it('an estimate import with a credit line lands as a discount capped at the work', () => {
    const rows = normalizeFormFixtureRows([
      { id: 'a', name: 'Water heater', count: 1, line_unit_price: 300, line_description: '', invoice_id: null },
      { id: 'x', name: 'Credit', count: 1, line_unit_price: -500, line_description: '', invoice_id: null },
    ])
    expect(rows[1]).toMatchObject({ line_kind: 'discount', line_unit_price: -300 })
  })
})
