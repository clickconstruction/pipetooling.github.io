import { describe, expect, it } from 'vitest'
import { calculateAssemblyCost, type AssemblyCostItem } from './assemblyCost'

function part(template_id: string, part_id: string, quantity: number): AssemblyCostItem {
  return { template_id, item_type: 'part', part_id, nested_template_id: null, quantity }
}

function nested(template_id: string, nested_template_id: string, quantity: number): AssemblyCostItem {
  return { template_id, item_type: 'template', part_id: null, nested_template_id, quantity }
}

describe('calculateAssemblyCost', () => {
  it('sums lowest price x quantity across a flat template', () => {
    const items = [part('tpl-1', 'p-a', 2), part('tpl-1', 'p-b', 3)]
    const prices = { 'p-a': 10, 'p-b': 4 }
    expect(calculateAssemblyCost('tpl-1', items, prices)).toEqual({
      total: 32, // 2*10 + 3*4
      missingPrices: 0,
      partCount: 2,
      nestedCount: 0,
    })
  })

  it('multiplies quantities through nested templates', () => {
    // tpl-1 contains 2x tpl-2; tpl-2 contains 3x p-a @ $5 => 2*3*5 = 30
    const items = [nested('tpl-1', 'tpl-2', 2), part('tpl-2', 'p-a', 3)]
    const result = calculateAssemblyCost('tpl-1', items, { 'p-a': 5 })
    expect(result.total).toBe(30)
    expect(result.partCount).toBe(1)
    expect(result.nestedCount).toBe(1)
  })

  it('counts absent and non-positive lowest prices as missing, not zero-cost', () => {
    const items = [part('tpl-1', 'p-none', 1), part('tpl-1', 'p-zero', 1), part('tpl-1', 'p-ok', 1)]
    const result = calculateAssemblyCost('tpl-1', items, { 'p-zero': 0, 'p-ok': 7 })
    expect(result.total).toBe(7)
    expect(result.missingPrices).toBe(2)
    expect(result.partCount).toBe(3)
  })

  it('treats quantity 0 as 1 (the || 1 quirk)', () => {
    const items = [part('tpl-1', 'p-a', 0)]
    expect(calculateAssemblyCost('tpl-1', items, { 'p-a': 9 }).total).toBe(9)
  })

  it('guards cycles: a template on the current path contributes zeros', () => {
    // tpl-1 -> tpl-2 -> tpl-1 (cycle) plus a real part on each level
    const items = [
      part('tpl-1', 'p-a', 1),
      nested('tpl-1', 'tpl-2', 1),
      part('tpl-2', 'p-b', 1),
      nested('tpl-2', 'tpl-1', 1),
    ]
    const result = calculateAssemblyCost('tpl-1', items, { 'p-a': 1, 'p-b': 2 })
    expect(result.total).toBe(3) // each part counted once; the cycle adds nothing
    expect(result.partCount).toBe(2)
    expect(result.nestedCount).toBe(2)
  })

  it('applies parentQuantity to top-level parts', () => {
    const items = [part('tpl-1', 'p-a', 2)]
    expect(calculateAssemblyCost('tpl-1', items, { 'p-a': 10 }, 3).total).toBe(60)
  })

  it('returns zeros for an unknown/empty template', () => {
    expect(calculateAssemblyCost('tpl-x', [], {})).toEqual({
      total: 0,
      missingPrices: 0,
      partCount: 0,
      nestedCount: 0,
    })
  })
})
