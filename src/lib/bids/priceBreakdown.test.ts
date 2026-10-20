import { describe, expect, it } from 'vitest'
import { buildPriceBreakdown, priceBreakdownNote, type PriceBreakdownRowInput } from './priceBreakdown'

const rows: PriceBreakdownRowInput[] = [
  { id: 'wc', name: 'WC', count: 2, revenue: 6600, materialsBeforeTax: 482.72, hours: 15, isEquipment: false },
  { id: 'lav', name: 'LAV', count: 2, revenue: 6600, materialsBeforeTax: 1498.26, hours: 8, isEquipment: false },
  { id: 'lift', name: 'Scissor lift', count: 1, revenue: 2000, materialsBeforeTax: 0, hours: 0, isEquipment: true },
]
const inp = { rows, markup: 0.5, taxPercent: 8.25, laborRate: 58, laborRateSource: 'company' as const, equipmentCost: 1500, smallCosts: 316.05 }

describe('buildPriceBreakdown', () => {
  it('the five lines add to the price and the cost, and profit is price minus cost', () => {
    const b = buildPriceBreakdown(inp)
    const price = b.lines.reduce((s, l) => s + (l.price ?? 0), 0)
    const cost = b.lines.reduce((s, l) => s + (l.cost ?? 0), 0)
    expect(price).toBeCloseTo(b.price, 6)
    expect(cost).toBeCloseTo(b.cost, 6)
    expect(b.price).toBe(15200)
    expect(b.profit).toBeCloseTo(b.price - b.cost, 6)
    expect(b.laborCosted).toBe(true)
    expect(b.hours).toBe(23)
    const mat = b.lines[0]!
    expect(mat.cost).toBeCloseTo(1980.98, 2)
    expect(mat.price).toBeCloseTo(1980.98 * 1.5, 2)
    expect(b.weightedMarkup).toBeCloseTo(0.5, 6)
    expect(b.lines[2]!.price).toBe(2000)
    expect(b.lines[2]!.cost).toBe(1500)
    expect(b.lines[3]!.rule).toContain('crew rate')
  })
  it('with no hours, labor is "Labor and margin" and the bid has no profit', () => {
    const b = buildPriceBreakdown({ ...inp, rows: rows.map((r) => ({ ...r, hours: 0 })) })
    expect(b.laborCosted).toBe(false)
    expect(b.lines[3]!.name).toBe('Labor and margin')
    expect(b.lines[3]!.cost).toBeNull()
    expect(b.profit).toBeNull()
    expect(priceBreakdownNote(b, { laborRate: 58 }).tone).toBe('warn')
    expect(priceBreakdownNote(b, { laborRate: 58 }).words).toContain('Open Labor')
  })
  it("the rows' own splits make the Price column when every row has one, and the tax we pay stays on what we buy", () => {
    const withSplits = rows.map((r) => ({ ...r, split: { material: r.isEquipment ? 0 : r.materialsBeforeTax * 1.6, tax: r.isEquipment ? 0 : r.materialsBeforeTax * 1.6 * 0.0825, equipment: r.isEquipment ? r.revenue : 0, labor: 0 } }))
    for (const r of withSplits) r.split!.labor = r.revenue - r.split!.material - r.split!.tax - r.split!.equipment
    const b = buildPriceBreakdown({ ...inp, rows: withSplits })
    expect(b.lines[0]!.price).toBeCloseTo(1980.98 * 1.6, 2)
    expect(b.lines[1]!.cost).toBeCloseTo(1980.98 * 0.0825, 2)
    expect(b.lines[1]!.price).toBeCloseTo(1980.98 * 1.6 * 0.0825, 2)
    expect(b.weightedMarkup).toBeCloseTo(0.6, 6)
    expect(b.lines.reduce((s, l) => s + (l.price ?? 0), 0)).toBeCloseTo(b.price, 6)
  })
  it('the bid-level material total wins over the rows, less the equipment rows', () => {
    const b = buildPriceBreakdown({ ...inp, materialTotal: 3000, hoursTotal: 20 })
    expect(b.lines[0]!.cost).toBe(3000)
    expect(b.hours).toBe(20)
  })
  it('labor under water reads as a warning', () => {
    const b = buildPriceBreakdown({ ...inp, rows: rows.map((r) => ({ ...r, revenue: r.isEquipment ? r.revenue : 1000 })) })
    expect(priceBreakdownNote(b, { laborRate: 58 }).words).toContain('under water')
  })
})
