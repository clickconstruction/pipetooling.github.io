import { describe, expect, it } from 'vitest'
import {
  clampRoughQtyFromDraft,
  roughQtyToDraftString,
  normalizeMaterialsModel,
  takeoffFixtureCountLabel,
  sumRoughLinesPreTax,
  roughCountMultiplier,
  sumRoughLinesPreTaxWithCount,
  mergePartLinesToTakeoffTemplateItems,
  STAGE_LABELS,
} from './bidTakeoffHelpers'

describe('clampRoughQtyFromDraft', () => {
  it('floors empty / dot / NaN drafts to 0.0001', () => {
    expect(clampRoughQtyFromDraft('')).toBe(0.0001)
    expect(clampRoughQtyFromDraft('   ')).toBe(0.0001)
    expect(clampRoughQtyFromDraft('.')).toBe(0.0001)
    expect(clampRoughQtyFromDraft('abc')).toBe(0.0001)
  })

  it('clamps non-positive numbers to 0.0001', () => {
    expect(clampRoughQtyFromDraft('0')).toBe(0.0001)
    expect(clampRoughQtyFromDraft('-5')).toBe(0.0001)
  })

  it('keeps valid positive numbers', () => {
    expect(clampRoughQtyFromDraft('3.5')).toBe(3.5)
  })
})

describe('roughQtyToDraftString', () => {
  it('returns 0.0001 for non-finite or non-positive', () => {
    expect(roughQtyToDraftString(0)).toBe('0.0001')
    expect(roughQtyToDraftString(-1)).toBe('0.0001')
    expect(roughQtyToDraftString(NaN)).toBe('0.0001')
  })

  it('round-trips a clamped draft', () => {
    expect(clampRoughQtyFromDraft(roughQtyToDraftString(2.25))).toBe(2.25)
  })
})

describe('normalizeMaterialsModel', () => {
  it('maps rough to rough and everything else to exact', () => {
    expect(normalizeMaterialsModel('rough')).toBe('rough')
    expect(normalizeMaterialsModel('exact')).toBe('exact')
    expect(normalizeMaterialsModel(null)).toBe('exact')
    expect(normalizeMaterialsModel(undefined)).toBe('exact')
    expect(normalizeMaterialsModel('something')).toBe('exact')
  })
})

describe('takeoffFixtureCountLabel', () => {
  it('includes the fixture name when present', () => {
    expect(takeoffFixtureCountLabel({ fixture: 'Toilet', count: 5 })).toBe('(5) Toilet')
  })

  it('omits the name when blank', () => {
    expect(takeoffFixtureCountLabel({ fixture: '', count: 2 })).toBe('(2)')
    expect(takeoffFixtureCountLabel({ fixture: '   ', count: 3 })).toBe('(3)')
  })
})

describe('sumRoughLinesPreTax', () => {
  it('sums quantity x unit_price', () => {
    expect(
      sumRoughLinesPreTax([
        { quantity: 2, unit_price: 10 },
        { quantity: 3, unit_price: 5 },
      ])
    ).toBe(35)
  })

  it('returns 0 for an empty list', () => {
    expect(sumRoughLinesPreTax([])).toBe(0)
  })
})

describe('roughCountMultiplier', () => {
  it('returns the count when it is a positive number', () => {
    expect(roughCountMultiplier(2)).toBe(2)
    expect(roughCountMultiplier('3')).toBe(3)
  })

  it('falls back to 1 for missing / zero / invalid counts', () => {
    expect(roughCountMultiplier(1)).toBe(1)
    expect(roughCountMultiplier(0)).toBe(1)
    expect(roughCountMultiplier(null)).toBe(1)
    expect(roughCountMultiplier(undefined)).toBe(1)
    expect(roughCountMultiplier('abc')).toBe(1)
  })
})

describe('sumRoughLinesPreTaxWithCount', () => {
  it('weights each line by its fixture count (count x qty x unit_price)', () => {
    const counts = new Map<string, number | null>([
      ['a', 2],
      ['b', 1],
    ])
    expect(
      sumRoughLinesPreTaxWithCount(
        [
          { count_row_id: 'a', quantity: 1, unit_price: 10 }, // 2 * 1 * 10 = 20
          { count_row_id: 'b', quantity: 3, unit_price: 5 }, //  1 * 3 * 5  = 15
        ],
        counts,
      ),
    ).toBe(35)
  })

  it('treats a line with no matching count as count 1', () => {
    expect(
      sumRoughLinesPreTaxWithCount([{ count_row_id: 'missing', quantity: 2, unit_price: 10 }], new Map()),
    ).toBe(20)
  })
})

describe('STAGE_LABELS', () => {
  it('maps each stage to its label', () => {
    expect(STAGE_LABELS).toEqual({ rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' })
  })
})

describe('mergePartLinesToTakeoffTemplateItems', () => {
  it('merges duplicate partIds by summing quantities', () => {
    expect(
      mergePartLinesToTakeoffTemplateItems([
        { partId: 'p1', quantity: 2 },
        { partId: 'p2', quantity: 5 },
        { partId: 'p1', quantity: 3 },
      ])
    ).toEqual([
      { item_type: 'part', part_id: 'p1', nested_template_id: null, quantity: 5 },
      { item_type: 'part', part_id: 'p2', nested_template_id: null, quantity: 5 },
    ])
  })

  it('skips lines with blank or whitespace partId', () => {
    expect(
      mergePartLinesToTakeoffTemplateItems([
        { partId: '   ', quantity: 1 },
        { partId: '', quantity: 1 },
        { partId: 'p1', quantity: 1 },
      ])
    ).toEqual([{ item_type: 'part', part_id: 'p1', nested_template_id: null, quantity: 1 }])
  })

  it('floors non-positive or zero quantities to 0.0001', () => {
    expect(
      mergePartLinesToTakeoffTemplateItems([{ partId: 'p1', quantity: 0 }])
    ).toEqual([{ item_type: 'part', part_id: 'p1', nested_template_id: null, quantity: 0.0001 }])
  })
})
