/**
 * The rows the Markup and Tax tools are handed, as `BidsPricingTab` built them inline before the
 * move (decomposition queue row 1). The splits come from `rowPriceSplit`, as on the screen, so the
 * weighted markup is pinned on real arithmetic.
 */
import { describe, expect, it } from 'vitest'
import { markupToolRows, taxToolRows, weightedMarkupOf, type RowMarkToolSource } from './rowMarkToolRows'
import { rowPriceSplit } from './rowPriceSplit'

const BID_MARKUP = 0.5
const TAX = 8.25
const source = (id: string, name: string, kind: RowMarkToolSource['kind'], price: number, materialCost: number, typed: Parameters<typeof rowPriceSplit>[0]['typed'] = null, tags: string[] = []): RowMarkToolSource => ({
  id,
  name,
  kind,
  tags,
  split: rowPriceSplit({ price, materialCost, markup: BID_MARKUP, taxPercent: TAX, kind, typed }),
  materialsBeforeTax: materialCost,
})

// Water closets on the bid's 50%, lavatories with their own 20%, a floor drain with no takeoff, a lift that is equipment.
const WC = source('wc', 'Water closet', 'fixture', 4800, 1200, null, ['restrooms'])
const LAV = source('lav', 'Lavatory', 'fixture', 2000, 400, { markup: 0.2 })
const FD = source('fd', 'Floor drain', 'fixture', 360, 0)
const LIFT = source('lift', 'Scissor lift', 'equipment', 900, 300)
const TYPED = source('sink', 'Mop sink', 'fixture', 1500, 500, { material: 700, taxable: false })

describe('markupToolRows', () => {
  it("gives each row its markup, whether it is the row's own, and whether it has takeoff material", () => {
    expect(markupToolRows([WC, LAV, FD, LIFT, TYPED])).toEqual([
      { id: 'wc', name: 'Water closet', kind: 'fixture', tags: ['restrooms'], own: false, markup: 0.5, hasMaterial: true },
      { id: 'lav', name: 'Lavatory', kind: 'fixture', tags: [], own: true, markup: 0.2, hasMaterial: true },
      { id: 'fd', name: 'Floor drain', kind: 'fixture', tags: [], own: false, markup: 0.5, hasMaterial: false },
      { id: 'lift', name: 'Scissor lift', kind: 'equipment', tags: [], own: false, markup: 0.5, hasMaterial: false },
      // Material typed in dollars is not takeoff material: the tool skips the row.
      { id: 'sink', name: 'Mop sink', kind: 'fixture', tags: [], own: false, markup: 0.5, hasMaterial: false },
    ])
  })
  it('no rows is no rows', () => {
    expect(markupToolRows([])).toEqual([])
  })
})

describe('weightedMarkupOf', () => {
  it('is material sold over material cost, less one', () => {
    // $1,200 sold at $1,800 and $400 sold at $480: $2,280 over $1,600.
    expect(weightedMarkupOf([WC, LAV])).toBeCloseTo(2280 / 1600 - 1, 12)
    expect(weightedMarkupOf([WC])).toBeCloseTo(0.5, 12)
  })
  it('a row with no material adds neither cost nor price', () => {
    expect(weightedMarkupOf([WC, LAV, FD])).toBeCloseTo(2280 / 1600 - 1, 12)
  })
  it("an equipment row's takeoff cost is left out, as its material is", () => {
    expect(weightedMarkupOf([WC, LIFT])).toBeCloseTo(0.5, 12)
  })
  it('material typed in dollars counts at what was typed, over its takeoff cost', () => {
    // $1,200 sold at $1,800 and $500 sold at a typed $700: $2,500 over $1,700.
    expect(weightedMarkupOf([WC, TYPED])).toBeCloseTo(2500 / 1700 - 1, 12)
  })
  it('no material cost at all is no figure', () => {
    expect(weightedMarkupOf([FD, LIFT])).toBeNull()
    expect(weightedMarkupOf([])).toBeNull()
  })
})

describe('taxToolRows', () => {
  it('gives each row its tax choice and whether there is material for the tax to sit on', () => {
    expect(taxToolRows([WC, LAV, FD, LIFT, TYPED])).toEqual([
      { id: 'wc', name: 'Water closet', kind: 'fixture', tags: ['restrooms'], taxable: true, hasMaterial: true },
      { id: 'lav', name: 'Lavatory', kind: 'fixture', tags: [], taxable: true, hasMaterial: true },
      { id: 'fd', name: 'Floor drain', kind: 'fixture', tags: [], taxable: false, hasMaterial: false },
      { id: 'lift', name: 'Scissor lift', kind: 'equipment', tags: [], taxable: false, hasMaterial: false },
      // Typed material is material sold, so the tax tool keeps the row, here made tax-free.
      { id: 'sink', name: 'Mop sink', kind: 'fixture', tags: [], taxable: false, hasMaterial: true },
    ])
  })
})
