import { describe, expect, it } from 'vitest'
import { isBundleLine, isOverrideLine, nextUncostedFixtureId, summarizeTakeoffCoverage, type CoverageLine } from './takeoffCoverage'

const rows = [
  { id: 'wb', count: 3 },
  { id: 'fd', count: 8 },
  { id: 'wc', count: 2 },
  { id: 'l', count: 2 },
  { id: 'water', count: 148.5 },
  { id: 'waste', count: 96 },
]

function line(p: Partial<CoverageLine> & { id: string; countRowId: string }): CoverageLine {
  return { partId: 'part', quantity: 1, unitPrice: 0, sourceMaterialPartPriceId: 'price', sourceTemplateId: null, ...p }
}

const lines: CoverageLine[] = [
  line({ id: 'b1', countRowId: 'fd', partId: null, sourceTemplateId: 'tpl', unitPrice: 96.4, sourceMaterialPartPriceId: null }),
  line({ id: 'wc1', countRowId: 'wc', unitPrice: 0, sourceMaterialPartPriceId: null }),
  line({ id: 'wc2', countRowId: 'wc', unitPrice: 4.12 }),
  line({ id: 'l1', countRowId: 'l', unitPrice: 189, sourceMaterialPartPriceId: null }),
  line({ id: 'l2', countRowId: 'l', unitPrice: 6.85, quantity: 2 }),
  line({ id: 'w1', countRowId: 'water', unitPrice: 4.42 }),
  line({ id: 'orphan', countRowId: 'gone', unitPrice: 999 }),
]

describe('summarizeTakeoffCoverage', () => {
  const s = summarizeTakeoffCoverage(rows, lines)

  it('counts a fixture as costed when it has any line, even a $0 one', () => {
    expect(s.fixtures).toBe(6)
    expect(s.costed).toBe(4)
    expect(s.uncostedIds).toEqual(['wb', 'waste'])
    expect(s.costedPct).toBe(67)
  })

  it('totals the way the Labor tab and Workbench do (count × qty × price)', () => {
    // 96.40×8 + 0 + 4.12×2 + 189×2 + 6.85×2×2 + 4.42×148.5, plus the orphan line at ×1 —
    // `sumRoughLinesPreTaxWithCount` treats a missing row as count 1, and parity with the
    // Labor tab / Workbench number matters more than hiding a line the engine would not load.
    expect(s.materialsTotal).toBeCloseTo(771.2 + 8.24 + 378 + 27.4 + 656.37 + 999, 2)
    expect(s.perFixture.get('l')).toMatchObject({ lineCount: 2, unitCost: 202.7, total: 405.4 })
    expect(s.perFixture.get('water')?.total).toBeCloseTo(656.37, 2)
  })

  it('v2.3407: a line with a Sold in snapshot rounds its part once per bid; the extra lands in Materials and on the fixtures by footage share', () => {
    const cu = { partId: 'cu', unitPrice: 2.75, sourceMaterialPartPriceId: 'p', sourceTemplateId: null, orderIncrement: 20, orderIncrementUnit: 'ft_stick' }
    const r = summarizeTakeoffCoverage([{ id: 'a', count: 6 }, { id: 'b', count: 1 }], [
      line({ id: 'a1', countRowId: 'a', quantity: 8, ...cu }),
      line({ id: 'b1', countRowId: 'b', quantity: 57, ...cu }),
      line({ id: 'b2', countRowId: 'b', quantity: 1, unitPrice: 10 }),
    ])
    // 48 + 57 = 105 ft → 120 ft; 15 ft × $2.75 = $41.25 extra
    expect(r.materialsBeforeRounding).toBeCloseTo(48 * 2.75 + 57 * 2.75 + 10, 10)
    expect(r.orderRounding.extraCost).toBeCloseTo(41.25, 10)
    expect(r.materialsTotal).toBeCloseTo(r.materialsBeforeRounding + 41.25, 10)
    expect(r.perFixture.get('a')?.roundingExtra).toBeCloseTo((41.25 * 48) / 105, 10)
    expect(r.perFixture.get('a')?.total).toBeCloseTo(48 * 2.75 + (41.25 * 48) / 105, 10)
    expect(r.perFixture.get('b')?.total).toBeCloseTo(57 * 2.75 + 10 + (41.25 * 57) / 105, 10)
    // and without any snapshot nothing changes
    expect(s.orderRounding.parts).toEqual([])
    expect(s.materialsTotal).toBe(s.materialsBeforeRounding)
  })

  it('surfaces $0 lines, bundles, and overrides', () => {
    expect(s.zeroPriceLineIds).toEqual(['wc1'])
    expect(s.perFixture.get('wc')?.hasZeroPriceLine).toBe(true)
    expect(s.bundleLineCount).toBe(1)
    expect(s.overrideLineCount).toBe(1)
  })

  it('is empty-safe', () => {
    const e = summarizeTakeoffCoverage([], [])
    expect(e).toMatchObject({ fixtures: 0, costed: 0, costedPct: 0, materialsTotal: 0, uncostedIds: [] })
  })
})

describe('isBundleLine / isOverrideLine', () => {
  it('classify by part + source columns, not by price alone', () => {
    expect(isBundleLine({ partId: null, sourceTemplateId: 't' })).toBe(true)
    expect(isBundleLine({ partId: 'p', sourceTemplateId: 't' })).toBe(false)
    expect(isOverrideLine({ partId: 'p', sourceMaterialPartPriceId: null, unitPrice: 5 })).toBe(true)
    expect(isOverrideLine({ partId: 'p', sourceMaterialPartPriceId: null, unitPrice: 0 })).toBe(false)
    expect(isOverrideLine({ partId: null, sourceMaterialPartPriceId: null, unitPrice: 5 })).toBe(false)
  })
})

describe('nextUncostedFixtureId', () => {
  it('walks forward in row order and wraps', () => {
    expect(nextUncostedFixtureId(rows, ['wb', 'waste'], null)).toBe('wb')
    expect(nextUncostedFixtureId(rows, ['wb', 'waste'], 'wb')).toBe('waste')
    expect(nextUncostedFixtureId(rows, ['wb', 'waste'], 'waste')).toBe('wb')
    expect(nextUncostedFixtureId(rows, ['wb', 'waste'], 'wc')).toBe('waste')
  })

  it('returns null when nothing is left, including when only the current one is uncosted', () => {
    expect(nextUncostedFixtureId(rows, [], 'wb')).toBeNull()
    expect(nextUncostedFixtureId(rows, ['wb'], 'wb')).toBeNull()
  })
})
