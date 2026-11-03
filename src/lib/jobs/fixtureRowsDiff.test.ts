import { describe, expect, it } from 'vitest'
import { diffFixtureRows } from './fixtureRowsDiff'
import type { FixtureRow } from './jobFormTypes'

const row = (id: string, name: string, price: number | null, extra: Partial<FixtureRow> = {}): FixtureRow => ({ id, name, count: 1, line_unit_price: price, line_description: '', invoice_id: null, ...extra })

describe('diffFixtureRows', () => {
  it('every named line is upserted under its own id, in form order, and those ids are the ones to keep', () => {
    const { upserts, keepIds } = diffFixtureRows('job-1', [
      row('f-hydrated', 'Rough In', 1_000, { invoice_id: 'inv-1', stage_kind: 'order' }),
      row('f-scope', '  ', null, { line_description: 'scope only' }),
      row('f-new', 'Top Out', 500),
    ])
    expect(upserts.map((u) => [u.id, u.job_id, u.name, u.sequence_order, u.invoice_id, u.stage_kind])).toEqual([
      ['f-hydrated', 'job-1', 'Rough In', 0, 'inv-1', 'order'],
      ['f-new', 'job-1', 'Top Out', 1, null, 'any'],
    ])
    expect(keepIds).toEqual(['f-hydrated', 'f-new'])
  })

  it('with no line worth keeping there is nothing to upsert and nothing to keep', () => {
    expect(diffFixtureRows('job-1', [row('f-blank', '', null)])).toEqual({ upserts: [], keepIds: [] })
    expect(diffFixtureRows('job-1', [])).toEqual({ upserts: [], keepIds: [] })
  })

  it('a discount row’s basis positions key on the kept rows’ sequence_order, as the hydration reads them back', () => {
    const { upserts } = diffFixtureRows('job-1', [
      row('a', 'Rough In', 1_000),
      row('f-scope', '', null),
      row('b', 'Top Out', 1_000),
      row('d', 'Negotiated discount', -5, { line_kind: 'discount', discount_pct: 10, discount_basis_ids: ['b'], discount_reason: 'Negotiated' }),
    ])
    expect(upserts.map((u) => [u.id, u.sequence_order])).toEqual([['a', 0], ['b', 1], ['d', 2]])
    expect(upserts[2]).toMatchObject({ line_kind: 'discount', count: 1, line_unit_price: -100, discount_pct: 10, discount_basis_positions: [1], discount_reason: 'Negotiated', stage_kind: null, shared_with_gc: false, bill_to_party: null })
  })

  it('every row carries the same columns, so one statement writes them all alike: the budget columns read null where nothing is stored', () => {
    const { upserts } = diffFixtureRows('job-1', [
      row('a', 'Rough In', 24_000, { stage_kind: 'order' }),
      row('b', 'Top Out', 16_000, { stage_kind: 'order', budget_labor_pct: 52, budget_materials_pct: 35, budget_source: 'tuned', budget_tuned_at: '2026-11-01T00:00:00Z', budget_rate_usd: 45 }),
      row('d', 'Discount', -5, { line_kind: 'discount', discount_pct: null, discount_basis_ids: null, discount_reason: null }),
    ])
    const keys = upserts.map((u) => Object.keys(u).sort())
    expect(keys[1]).toEqual(keys[0])
    expect(keys[2]).toEqual(keys[0])
    expect(upserts[0]).toMatchObject({ budget_labor_pct: null, budget_materials_pct: null, budget_source: null, budget_tuned_at: null, budget_rate_usd: null })
    expect(upserts[1]).toMatchObject({ budget_labor_pct: 52, budget_materials_pct: 35, budget_source: 'tuned', budget_tuned_at: '2026-11-01T00:00:00Z', budget_rate_usd: 45 })
  })

  it('names no column the slice does not own, so an update leaves the line’s created_at and the stage’s progress as they are', () => {
    const [u] = diffFixtureRows('job-1', [row('a', 'Rough In', 1_000)]).upserts
    for (const col of ['created_at', 'progress_pct', 'progress_at', 'progress_by', 'progress_report_id']) expect(col in u!).toBe(false)
  })
})
