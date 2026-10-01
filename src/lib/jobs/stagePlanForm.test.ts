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

describe('Still to bill counts money billed by amount (v2.4303)', () => {
  // Job 1059, Seaver Pretest: one ◆ line, $250, billed as a plain $250 bill that names no line.
  const seaver = stagePlanFromForm({
    fixtures: [row({ id: 'pre', name: 'Pretest', stage_kind: 'any', line_unit_price: 250 })],
    windows: [],
    orders: [],
    sheets: [],
    invoices: [{ id: 'inv-250', status: 'billed', billed_at: '2026-09-30T15:00:00Z' }],
    payments: [],
    todayYmd: '2026-10-01',
  })
  const covered = (byId: Record<string, number>, amounts: Record<string, number>) => ({
    unattributedDollars: 0,
    remainingDollars: 0,
    bySegmentKey: Object.fromEntries(Object.entries(byId).map(([id, c]) => [id, { coveredDollars: c, fullyCovered: c >= (amounts[id] ?? 0) }])),
  })

  it('a line the bills already cover to the cent leaves the list', () => {
    expect(upcomingDrawRows(seaver).map((r) => r.fixtureId)).toEqual(['pre'])
    expect(upcomingDrawRows(seaver, covered({ pre: 250 }, { pre: 250 }))).toEqual([])
  })

  it('a line covered in part stays, for what is left, and says how much is billed', () => {
    const rows = upcomingDrawRows(seaver, covered({ pre: 100 }, { pre: 250 }))
    expect(rows.map((r) => [r.fixtureId, r.amount, r.coveredDollars, r.leftDollars])).toEqual([['pre', 250, 100, 150]])
  })

  it('with no coverage every row is left in full', () => {
    expect(upcomingDrawRows(seaver).map((r) => [r.coveredDollars, r.leftDollars])).toEqual([[0, 250]])
  })

  it('a passed stage no longer waits on a stage above it that the bills cover', () => {
    const plan = stagePlanFromForm({
      fixtures: [
        row({ id: 'rough', name: 'Rough-in', stage_kind: 'order', line_unit_price: 1000 }),
        row({ id: 'top', name: 'Top-out', stage_kind: 'order', line_unit_price: 1000 }),
      ],
      windows: [
        { id: 'w-rough', fixture_id: 'rough', window_start: '2026-09-01', window_end: '2026-09-02' },
        { id: 'w-top', fixture_id: 'top', window_start: '2026-09-08', window_end: '2026-09-09' },
      ],
      orders: [
        { id: 'o-rough', stage_window_id: 'w-rough', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-02', labor_job_id: 's-rough' },
        { id: 'o-top', stage_window_id: 'w-top', status: 'settled', picked_start: '2026-09-08', picked_end: '2026-09-09', labor_job_id: 's-top' },
      ],
      sheets: [
        { id: 's-rough', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-02T15:00:00Z' },
        { id: 's-top', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-09T15:00:00Z' },
      ],
      invoices: [{ id: 'inv-amt', status: 'billed', billed_at: '2026-09-03T15:00:00Z' }],
      payments: [],
      todayYmd: '2026-09-10',
    })
    expect(upcomingDrawRows(plan).map((r) => [r.fixtureId, r.draw])).toEqual([
      ['rough', 'ready'],
      ['top', 'waits'],
    ])
    expect(upcomingDrawRows(plan, covered({ rough: 1000 }, { rough: 1000 })).map((r) => [r.fixtureId, r.draw])).toEqual([['top', 'ready']])
    // Covered only in part, the stage above still holds the one below.
    expect(upcomingDrawRows(plan, covered({ rough: 400 }, { rough: 1000 })).map((r) => [r.fixtureId, r.draw])).toEqual([
      ['rough', 'ready'],
      ['top', 'waits'],
    ])
  })
})
