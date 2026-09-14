import { describe, expect, it } from 'vitest'
import { orderListRows, orderRoundingHover, orderRoundingTitle, summarizeOrderRounding, type RoundingLine } from './takeoffOrderRounding'

const rows = [
  { id: 'lav', count: 6 },
  { id: 'wc', count: 5 },
  { id: 'ks', count: 1 },
  { id: 'wh', count: 1 },
]

const copper = { partId: 'cu34', unitPrice: 2.75, orderIncrement: 20, orderIncrementUnit: 'ft_stick' }
const lines: RoundingLine[] = [
  { countRowId: 'lav', quantity: 8, ...copper },
  { countRowId: 'wc', quantity: 6, ...copper },
  { countRowId: 'ks', quantity: 12, ...copper },
  { countRowId: 'wh', quantity: 15, ...copper },
  // a fitting by the each: no rule, never rounds
  { countRowId: 'lav', quantity: 4, partId: 'el90', unitPrice: 1.9, orderIncrement: null },
  // a bundle line: no part
  { countRowId: 'wc', quantity: 1, partId: null, unitPrice: 96, orderIncrement: 20 },
]

describe('summarizeOrderRounding', () => {
  const r = summarizeOrderRounding(rows, lines)
  const cu = r.byPartId.get('cu34')!

  it('sums a part across every fixture (line qty × count), rounds once per bid, prices the extra at the part’s unit price', () => {
    // 8×6 + 6×5 + 12 + 15 = 105 ft → 120 ft, 6 sticks, 15 ft extra at $2.75 = $41.25
    expect(cu.needed).toBe(105)
    expect(cu.ordered).toBe(120)
    expect(cu.packs).toBe(6)
    expect(cu.extra).toBe(15)
    expect(cu.unitPrice).toBeCloseTo(2.75, 10)
    expect(cu.extraCost).toBeCloseTo(41.25, 10)
    expect(r.parts.map((p) => p.partId)).toEqual(['cu34'])
    expect(r.partsRounded).toBe(1)
    expect(r.extraCost).toBeCloseTo(41.25, 10)
  })

  it('spreads the extra over the fixtures by their share of the footage, and the slices add up', () => {
    expect(cu.extraByCountRow.get('lav')).toBeCloseTo((41.25 * 48) / 105, 10)
    expect(cu.extraByCountRow.get('wc')).toBeCloseTo((41.25 * 30) / 105, 10)
    expect(cu.extraByCountRow.get('ks')).toBeCloseTo((41.25 * 12) / 105, 10)
    expect(cu.extraByCountRow.get('wh')).toBeCloseTo((41.25 * 15) / 105, 10)
    let sum = 0
    for (const v of r.extraByCountRow.values()) sum += v
    expect(sum).toBeCloseTo(41.25, 10)
  })

  it('an exact multiple rounds nothing; a part with two different snapshots takes the larger increment; mixed prices weight by footage', () => {
    const r2 = summarizeOrderRounding([{ id: 'a', count: 2 }, { id: 'b', count: 1 }], [
      { countRowId: 'a', quantity: 10, partId: 'pvc', unitPrice: 3, orderIncrement: 10, orderIncrementUnit: 'ft_stick' },
      { countRowId: 'b', quantity: 20, partId: 'pvc', unitPrice: 4, orderIncrement: 20, orderIncrementUnit: 'ft_stick' },
    ])
    const pvc = r2.byPartId.get('pvc')!
    expect(pvc.increment).toBe(20)
    expect(pvc.needed).toBe(40)
    expect(pvc.ordered).toBe(40)
    expect(pvc.extra).toBe(0)
    expect(pvc.unitPrice).toBeCloseTo((20 * 3 + 20 * 4) / 40, 10)
    expect(r2.partsRounded).toBe(0)
    expect(r2.extraCost).toBe(0)
  })

  it('no rules at all is the empty summary', () => {
    const r3 = summarizeOrderRounding(rows, [{ countRowId: 'lav', quantity: 4, partId: 'el90', unitPrice: 1.9 }])
    expect(r3.parts).toEqual([])
    expect(r3.extraCost).toBe(0)
    expect(r3.extraByCountRow.size).toBe(0)
  })

  it('words', () => {
    expect(orderRoundingHover(cu)).toBe('105 ft needed on this bid → 120 ft (6 × 20 ft sticks) · +15 ft extra')
    const exact = summarizeOrderRounding([{ id: 'a', count: 1 }], [{ countRowId: 'a', quantity: 40, partId: 'p', unitPrice: 1, orderIncrement: 20, orderIncrementUnit: 'ft_stick' }]).byPartId.get('p')!
    expect(orderRoundingHover(exact)).toBe('40 ft needed on this bid — an exact 2 × 20 ft, nothing extra')
    const box = summarizeOrderRounding([{ id: 'a', count: 1 }], [{ countRowId: 'a', quantity: 13, partId: 'p', unitPrice: 1, orderIncrement: 10, orderIncrementUnit: 'box' }]).byPartId.get('p')!
    expect(orderRoundingHover(box)).toBe('13 needed on this bid → 20 (2 × 10 boxes) · +7 extra')
    expect(orderRoundingTitle(r)).toBe('1 part sold in packs · 1 rounds up · the extra is included in Materials and spread over the fixtures that use the part')
    expect(orderRoundingTitle(summarizeOrderRounding([], []))).toBe('No part on this bid carries a Sold in rule')
  })
})

describe('orderListRows', () => {
  it('orders by the extra’s cost, names the part, caps and counts the rest', () => {
    const r = summarizeOrderRounding([{ id: 'a', count: 1 }], [
      { countRowId: 'a', quantity: 105, partId: 'cu', unitPrice: 2.75, orderIncrement: 20, orderIncrementUnit: 'ft_stick' },
      { countRowId: 'a', quantity: 40, partId: 'pvc', unitPrice: 3, orderIncrement: 20, orderIncrementUnit: 'ft_stick' },
      { countRowId: 'a', quantity: 210, partId: 'pex', unitPrice: 0.65, orderIncrement: 100, orderIncrementUnit: 'ft_coil' },
    ])
    const names = new Map([['cu', '3/4" Copper'], ['pex', '1/2" PEX']])
    const { rows, more, totalExtra } = orderListRows(r, names, 2)
    // pex: 90 ft × $0.65 = $58.50 · cu: 15 × $2.75 = $41.25 · pvc: exact
    expect(rows.map((x) => [x.name, x.part.ordered, x.part.extraCost])).toEqual([['1/2" PEX', 300, 58.5], ['3/4" Copper', 120, 41.25]])
    expect(more).toBe(1)
    expect(totalExtra).toBeCloseTo(99.75, 10)
    expect(orderListRows(r, names, 8).rows[2]).toMatchObject({ name: 'Part', part: { extra: 0 } })
  })
})
