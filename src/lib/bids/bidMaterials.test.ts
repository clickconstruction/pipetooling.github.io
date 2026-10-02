import { describe, expect, it } from 'vitest'
import { combinedMaterials, materialsLines } from './bidMaterials'
import { roughMaterialsTotalWithRounding, type RoughLineDbRow } from './takeoffOrderRounding'

/**
 * Two fixtures share 20 ft sticks of copper: 4 lavs × 5 ft + 2 WCs × 2.5 ft = 25 ft needed,
 * 40 ft bought, 15 ft × $2 = $30 extra, split 20 : 5 by footage ($24 lav, $6 WC).
 * The WCs also carry a $150 valve each. Base = 40 + 10 + 300 = $350, total $380.
 */
const counts = new Map<string, number | null>([
  ['lav', 4],
  ['wc', 2],
  ['hidden', 1],
])
const copper = { part_id: 'copper', unit_price: 2, order_increment: 20, order_increment_unit: 'ft_stick' }
const lines: RoughLineDbRow[] = [
  { count_row_id: 'lav', quantity: 5, ...copper },
  { count_row_id: 'wc', quantity: 2.5, ...copper },
  { count_row_id: 'wc', part_id: 'valve', quantity: 1, unit_price: 150 },
]

describe('combinedMaterials', () => {
  it('totals Σ count × quantity × price plus the order rounding, all in the Rough In slot', () => {
    const m = combinedMaterials(lines, counts)
    expect(m).toMatchObject({ roughIn: 380, topOut: 0, trimSet: 0, total: 380 })
    expect(m.total).toBe(roughMaterialsTotalWithRounding(lines, counts).total)
  })

  it('gives each count row its own lines times its count plus its share of the rounding, and every row a number', () => {
    const m = combinedMaterials(lines, counts)
    expect(m.byCountRowId).toEqual({ lav: 64, wc: 316, hidden: 0 })
    expect(Object.values(m.byCountRowId).reduce((s, v) => s + v, 0)).toBeCloseTo(m.total, 10)
  })

  it('counts a fixture with no count, a zero count or a typed count as the engine does', () => {
    const m = combinedMaterials(
      [
        { count_row_id: 'a', quantity: 3, unit_price: 10 },
        { count_row_id: 'b', quantity: 3, unit_price: 10 },
        { count_row_id: 'c', quantity: '2', unit_price: '7.5' } as unknown as RoughLineDbRow,
      ],
      new Map<string, number | string | null>([
        ['a', null],
        ['b', 0],
        ['c', '3'],
      ]),
    )
    expect(m.byCountRowId).toEqual({ a: 30, b: 30, c: 45 })
    expect(m.total).toBe(105)
  })

  it('keeps a line whose fixture is not in the version at ×1 in the total, as the Takeoffs strip does, without a row of its own', () => {
    const m = combinedMaterials([...lines, { count_row_id: 'gone', quantity: 2, unit_price: 25 }], counts)
    expect(m.total).toBe(430)
    expect(m.byCountRowId).not.toHaveProperty('gone')
  })

  it('reads an empty takeoff as $0 with a zero row per fixture', () => {
    expect(combinedMaterials([], counts)).toEqual({ roughIn: 0, topOut: 0, trimSet: 0, total: 0, byCountRowId: { lav: 0, wc: 0, hidden: 0 } })
  })
})

describe('materialsLines', () => {
  it('prints one Materials line', () => {
    expect(materialsLines(combinedMaterials(lines, counts))).toEqual([{ label: 'Materials', amount: 380 }])
  })
})
