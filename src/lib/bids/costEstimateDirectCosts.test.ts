import { describe, expect, it } from 'vitest'
import { DIRECT_COST_KIND_TABLE, directCostKindWords, directCostRowTotal, flattenDirectCostTables, isDirectCostKind, sumDirectCosts, type CostEstimateDirectCostRow } from './costEstimateDirectCosts'

const row = (kind: string, rough: number | null, top: number | null = null, trim: number | null = null): CostEstimateDirectCostRow =>
  ({ id: `${kind}-${rough}`, cost_estimate_id: 'ce', kind, note: null, rough_in: rough, top_out: top, trim_set: trim, sequence_order: 0, created_at: null, updated_at: null }) as CostEstimateDirectCostRow

describe('sumDirectCosts', () => {
  it('adds the five kinds by kind and by stage; blanks and negatives count as 0', () => {
    const t = sumDirectCosts([row('sub', 6500), row('permit', 1240), row('equipment', 1900, null, -5), row('waste', null, 300), row('other', 0)])
    expect(t.byKind).toEqual({ equipment: 1900, permit: 1240, sub: 6500, waste: 300, other: 0 })
    expect(t.byStage).toEqual({ rough: 9640, top: 300, trim: 0 })
    expect(t.total).toBe(9940)
    expect(t.rowCount).toBe(5)
  })
  it('skips a row whose kind the view never emits', () => {
    const t = sumDirectCosts([row('driving', 100)])
    expect(t.total).toBe(0)
    expect(t.rowCount).toBe(0)
  })
  it('is zero for nothing', () => {
    expect(sumDirectCosts(null).total).toBe(0)
    expect(sumDirectCosts([]).rowCount).toBe(0)
  })
})

describe('directCostRowTotal / isDirectCostKind / the table map', () => {
  it('sums the three stages of one row', () => expect(directCostRowTotal({ rough_in: 1, top_out: 2, trim_set: 3 })).toBe(6))
  it('knows the five kinds and nothing else', () => {
    expect(isDirectCostKind('sub')).toBe(true)
    expect(isDirectCostKind('labor')).toBe(false)
    expect(isDirectCostKind(null)).toBe(false)
  })
  it('maps sub to the subcontractor table', () => expect(DIRECT_COST_KIND_TABLE.sub).toBe('cost_estimate_subcontractor_rows'))
})

describe('directCostKindWords', () => {
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`
  it('names the non-zero kinds, largest first', () => {
    expect(directCostKindWords(sumDirectCosts([row('permit', 1240), row('sub', 6500), row('waste', 0)]), fmt)).toBe('subs $6,500 · permits $1,240')
  })
  it('is empty when nothing is entered', () => expect(directCostKindWords(sumDirectCosts([]), fmt)).toBe(''))
})

describe('flattenDirectCostTables', () => {
  it('lists the five tables as one list in kind order, each table by its sequence', () => {
    const list = flattenDirectCostTables({
      other: [{ id: 'o1', sequence_order: 1 }],
      sub: [{ id: 's2', sequence_order: 2 }, { id: 's1', sequence_order: 1 }],
      equipment: [{ id: 'e1', sequence_order: 5 }],
      waste: null,
    })
    expect(list.map((l) => `${l.kind}:${l.row.id}`)).toEqual(['equipment:e1', 'sub:s1', 'sub:s2', 'other:o1'])
  })
})
