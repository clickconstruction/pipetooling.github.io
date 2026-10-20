import { describe, expect, it } from 'vitest'
import { parseSplitDollars, rowPriceSplit, sumRowSplits } from './rowPriceSplit'

const base = { price: 7500, materialCost: 3245, markup: 0.5, taxPercent: 8.25, kind: 'fixture' as const }

describe('rowPriceSplit', () => {
  it("sells the takeoff at the bid's markup, taxes it and leaves labor the rest", () => {
    const s = rowPriceSplit(base)
    expect(s.material).toBeCloseTo(4867.5, 2)
    expect(s.tax).toBeCloseTo(401.57, 2)
    expect(s.equipment).toBe(0)
    expect(s.labor).toBeCloseTo(7500 - 4867.5 - 401.57, 1)
    expect(s.materialSource).toBe('takeoff')
    expect(s.markup).toBe(0.5)
    expect(s.markupSource).toBe('bid')
    expect(s.taxable).toBe(true)
    expect(s.material + s.tax + s.equipment + s.labor).toBeCloseTo(7500, 6)
  })
  it("a typed material wins, and the row's own markup wins over the bid's", () => {
    const typed = rowPriceSplit({ ...base, typed: { material: 3000 } })
    expect(typed.material).toBe(3000)
    expect(typed.materialSource).toBe('typed')
    expect(typed.tax).toBeCloseTo(247.5, 2)
    const own = rowPriceSplit({ ...base, typed: { markup: 0.6 } })
    expect(own.material).toBeCloseTo(5192, 2)
    expect(own.markup).toBe(0.6)
    expect(own.markupSource).toBe('row')
  })
  it('a tax-free row carries no tax; a row with no material is not taxable by default', () => {
    expect(rowPriceSplit({ ...base, typed: { taxable: false } }).tax).toBe(0)
    const none = rowPriceSplit({ ...base, materialCost: 0 })
    expect(none.taxable).toBe(false)
    expect(none.materialSource).toBe('none')
    expect(none.labor).toBe(7500)
  })
  it('an equipment row is all equipment: no material, no tax, no labor', () => {
    const s = rowPriceSplit({ ...base, kind: 'equipment' })
    expect(s.material).toBe(0)
    expect(s.tax).toBe(0)
    expect(s.equipment).toBe(7500)
    expect(s.equipmentSource).toBe('kind')
    expect(s.labor).toBe(0)
  })
  it('labor below zero when the typed material and tax add to more than the price', () => {
    const s = rowPriceSplit({ ...base, typed: { material: 8000 } })
    expect(s.labor).toBeLessThan(0)
    expect(sumRowSplits([s, rowPriceSplit(base)]).rowsUnderWater).toBe(1)
    expect(sumRowSplits([s, rowPriceSplit(base)]).rowsTyped).toBe(1)
  })
  it('a bad or negative markup falls back to 0; a negative price counts as 0', () => {
    expect(rowPriceSplit({ ...base, markup: -1 }).material).toBe(3245)
    expect(rowPriceSplit({ ...base, price: -5 }).labor).toBeLessThan(0)
  })
})

describe('parseSplitDollars', () => {
  it('reads money and gives null for blank or garbage', () => {
    expect(parseSplitDollars('$1,234.56')).toBe(1234.56)
    expect(parseSplitDollars(' 40 ')).toBe(40)
    expect(parseSplitDollars('')).toBeNull()
    expect(parseSplitDollars('abc')).toBeNull()
    expect(parseSplitDollars('-5')).toBeNull()
  })
})
