import { describe, expect, it } from 'vitest'
import type { FixtureRow } from './jobFormTypes'
import { drawLabelsByInvoiceId, fixtureStageFields, formFixtureKind, stagePlanFixturesFromForm, stagePlanFromForm, upcomingDrawRows } from './stagePlanForm'

const row = (over: Partial<FixtureRow> & { id: string; name: string }): FixtureRow => ({
  count: 1,
  line_unit_price: 1000,
  line_description: '',
  invoice_id: null,
  ...over,
})

describe('fixtureStageFields', () => {
  it('reads the two columns loosely — a row loaded before the push is plain and unshared', () => {
    expect(fixtureStageFields({ stage_kind: 'order', shared_with_gc: true })).toEqual({ stage_kind: 'order', shared_with_gc: true })
    expect(fixtureStageFields({ stage_kind: 'any', shared_with_gc: false })).toEqual({ stage_kind: 'any', shared_with_gc: false })
    expect(fixtureStageFields({})).toEqual({ stage_kind: null, shared_with_gc: false })
    expect(fixtureStageFields({ stage_kind: 'weird' })).toEqual({ stage_kind: null, shared_with_gc: false })
  })
})

describe('formFixtureKind', () => {
  it('a row never loaded / newly added is Any time (the column default); null is a deliberate plain line', () => {
    expect(formFixtureKind({})).toBe('any')
    expect(formFixtureKind({ stage_kind: undefined })).toBe('any')
    expect(formFixtureKind({ stage_kind: null })).toBeNull()
    expect(formFixtureKind({ stage_kind: 'order' })).toBe('order')
  })
})

describe('stagePlanFixturesFromForm', () => {
  it('keeps named rows only, numbers them the way the save engine does, and reads the kind through the default', () => {
    const fx = stagePlanFixturesFromForm([
      row({ id: 'a', name: 'Rough-in', stage_kind: 'order' }),
      row({ id: 'blank', name: '   ' }),
      row({ id: 'b', name: 'Change order' }),
      row({ id: 'c', name: 'Permit', stage_kind: null, shared_with_gc: true }),
    ])
    expect(fx.map((f) => [f.id, f.sequence_order, f.stage_kind, f.shared_with_gc])).toEqual([
      ['a', 0, 'order', false],
      ['b', 1, 'any', false],
      ['c', 2, null, true],
    ])
  })
})

describe('stagePlanFromForm + draw labels + the still-to-bill list', () => {
  const fixtures = [
    row({ id: 'a', name: 'Rough-in', stage_kind: 'order', invoice_id: 'inv-1', line_unit_price: 3000 }),
    row({ id: 'b', name: 'Top-out', stage_kind: 'order', line_unit_price: 3000 }),
    row({ id: 'c', name: 'Trim', stage_kind: 'order', line_unit_price: 3000 }),
    row({ id: 'd', name: 'Add hose bib', line_unit_price: 420 }),
    row({ id: 'e', name: 'Permit', stage_kind: null, line_unit_price: 600 }),
    row({ id: 'f', name: 'Free tee', stage_kind: null, line_unit_price: 0 }),
  ]
  const plan = stagePlanFromForm({
    fixtures,
    windows: [],
    orders: [],
    sheets: [],
    invoices: [{ id: 'inv-1', status: 'billed', billed_at: '2026-09-01T15:00:00Z' }],
    payments: [],
    todayYmd: '2026-09-09',
  })

  it('labels an invoice by the rows it bills', () => {
    expect(drawLabelsByInvoiceId(plan)).toEqual({ 'inv-1': 'Draw 1 · Rough-in' })
  })

  it('lists uninvoiced money with a rule behind it, in plan order, never a $0 row', () => {
    expect(upcomingDrawRows(plan).map((r) => [r.fixtureId, r.draw])).toEqual([
      ['b', 'later'],
      ['c', 'later'],
      ['d', 'later'],
      ['e', 'later'],
    ])
  })

  it('a plain row on a job with no Order rows is free to bill and stays off the list', () => {
    const free = stagePlanFromForm({ fixtures: fixtures.filter((f) => f.stage_kind !== 'order'), windows: [], orders: [], sheets: [], invoices: [], payments: [], todayYmd: '2026-09-09' })
    expect(free.byFixtureId.get('e')!.draw).toBe('open')
    expect(upcomingDrawRows(free).map((r) => r.fixtureId)).toEqual(['d'])
  })
})

describe('discount rows (v2.3252+)', () => {
  it('never reach the plan; work rows carry their net amount; positions still count the discount row', () => {
    const fx = stagePlanFixturesFromForm([
      row({ id: 'a', name: 'Rough-in', stage_kind: 'order', line_unit_price: 1000 }),
      row({ id: 'd', name: '10 off', line_kind: 'discount', discount_pct: 10, discount_basis_ids: null, line_unit_price: -100 }),
      row({ id: 'b', name: 'Top-out', stage_kind: 'order', line_unit_price: 1000 }),
    ])
    expect(fx.map((f) => [f.id, f.sequence_order, f.line_unit_price])).toEqual([
      ['a', 0, 900],
      ['b', 2, 900],
    ])
  })
})
