/**
 * What the three breakdown cards are handed, as `BidsPricingTab` built it inline in the cards'
 * props before the move (decomposition queue row 1). The splits come from `rowPriceSplit`, as on
 * the screen, and the cards' own kernels read the result, so the dollars a card shows are pinned
 * end to end. The names are made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { costEstimateLaborRowHours, type CostEstimateLaborRowCalc } from '../bidPricingRowCalculations'
import { breakdownSmallCosts, kindCardRows, priceCardInput, priceCardRows, tagCardRows, type BreakdownCardRow, type PriceCardTotals } from './breakdownCardInputs'
import { buildPriceBreakdown } from './priceBreakdown'
import { buildPricingComposition, buildTagComposition, NO_TAG } from './pricingComposition'
import { rowKindOf, type RowMarksByRowId } from './rowKinds'
import { rowPriceSplit } from './rowPriceSplit'

const BID_MARKUP = 0.5
const TAX = 8.25

type Row = BreakdownCardRow & { effUnit: number }
const row = (id: string, fixture: string | null, count: number, cost: number, effRevenue: number, materialsBeforeTax: number, laborRow?: CostEstimateLaborRowCalc): Row => ({
  countRow: { id, fixture },
  count,
  cost,
  effRevenue,
  materialsBeforeTax,
  laborRow,
  effUnit: count > 0 ? effRevenue / count : 0,
})
const labor = (fixture: string, count: number | string, rough: number | string, top: number | string, trim: number | string, is_fixed = false): CostEstimateLaborRowCalc => ({
  fixture,
  count,
  rough_in_hrs_per_unit: rough,
  top_out_hrs_per_unit: top,
  trim_set_hrs_per_unit: trim,
  is_fixed,
})

// Twelve water closets at the bid's 50%, two hours each on Labor.
const WC = row('wc', 'Water closet', 12, 3000, 4800, 1200, labor('Water closet', 12, 1, 0.5, 0.5))
// Eight lavatories with their own 25%; the Labor row is read as text, as the table hands it over.
const LAV = row('lav', 'Lavatory', 8, 1100, 2000, 400, labor('Lavatory', '8', '0.5', '0.25', '0.25'))
// Six floor drains with a price, no takeoff and no Labor row.
const FD = row('fd', 'Floor drain', 6, 0, 360, 0)
// A lift the app guesses is equipment from its name.
const LIFT = row('lift', 'Scissor lift', 1, 300, 900, 300)
// A hoist the estimator marked as equipment; its name alone would not say so.
const HOIST = row('hoist', 'Roof hoist', 1, 450, 600, 0)
// A lift station the app would guess is equipment, marked a fixture; eight fixed hours on Labor.
const STATION = row('station', 'Lift station', 1, 2500, 4000, 2000, labor('Lift station', 3, 6, 0, 2, true))
// Two mop sinks whose material is typed in dollars and sold tax-free.
const SINK = row('sink', 'Mop sink', 2, 900, 1500, 500)
const ROWS = [WC, LAV, FD, LIFT, HOIST, STATION, SINK]

const MARKS: RowMarksByRowId = {
  wc: { tags: ['restrooms'] },
  lav: { tags: ['restrooms', 'level 2'], split: { markup: 0.25 } },
  hoist: { kind: 'equipment' },
  station: { kind: 'fixture', tags: ['site'] },
  sink: { split: { material: 700, taxable: false } },
}

/** The tab's own `splitOf`, with no markup being typed. */
const splitOfWith = (marks: RowMarksByRowId) => (r: Row) =>
  rowPriceSplit({
    price: r.effRevenue,
    materialCost: r.materialsBeforeTax,
    markup: BID_MARKUP,
    taxPercent: TAX,
    kind: rowKindOf(r.countRow.fixture ?? '', marks[r.countRow.id]?.kind).kind,
    typed: marks[r.countRow.id]?.split ?? null,
  })
const splitOf = splitOfWith(MARKS)

const TOTALS: PriceCardTotals = {
  // The rows' $4,400 of takeoff and $100 of part lines no row carries.
  totalMaterials: 4500,
  totalLaborHours: 40,
  taxPercent: TAX,
  equipmentRentalCost: 1100,
  drivingCost: 120,
  travelCost: 0,
  permitCost: 250,
  subcontractorCost: 0,
  wasteCost: 30,
  otherCost: 100,
}

describe('priceCardRows', () => {
  it("gives each row its price, its takeoff material, its Labor hours, whether it is equipment, and its split's four dollars", () => {
    expect(priceCardRows(ROWS, MARKS, splitOf)).toEqual([
      { id: 'wc', name: 'Water closet', count: 12, revenue: 4800, materialsBeforeTax: 1200, hours: 24, isEquipment: false, split: { material: 1800, tax: 148.5, equipment: 0, labor: 2851.5 } },
      { id: 'lav', name: 'Lavatory', count: 8, revenue: 2000, materialsBeforeTax: 400, hours: 8, isEquipment: false, split: { material: 500, tax: 41.25, equipment: 0, labor: 1458.75 } },
      { id: 'fd', name: 'Floor drain', count: 6, revenue: 360, materialsBeforeTax: 0, hours: 0, isEquipment: false, split: { material: 0, tax: 0, equipment: 0, labor: 360 } },
      { id: 'lift', name: 'Scissor lift', count: 1, revenue: 900, materialsBeforeTax: 300, hours: 0, isEquipment: true, split: { material: 0, tax: 0, equipment: 900, labor: 0 } },
      { id: 'hoist', name: 'Roof hoist', count: 1, revenue: 600, materialsBeforeTax: 0, hours: 0, isEquipment: true, split: { material: 0, tax: 0, equipment: 600, labor: 0 } },
      { id: 'station', name: 'Lift station', count: 1, revenue: 4000, materialsBeforeTax: 2000, hours: 8, isEquipment: false, split: { material: 3000, tax: 247.5, equipment: 0, labor: 752.5 } },
      { id: 'sink', name: 'Mop sink', count: 2, revenue: 1500, materialsBeforeTax: 500, hours: 0, isEquipment: false, split: { material: 700, tax: 0, equipment: 0, labor: 800 } },
    ])
  })
  it('hands the split only the four dollars, none of the rest of it', () => {
    for (const r of priceCardRows(ROWS, MARKS, splitOf)) expect(Object.keys(r.split ?? {}).sort()).toEqual(['equipment', 'labor', 'material', 'tax'])
  })
  it("a row's hours are its Labor row's by the Labor tab's own rule, and none with no Labor row", () => {
    const rows = priceCardRows(ROWS, MARKS, splitOf)
    // Fixed hours are not multiplied by the count: 6 + 0 + 2, whatever the Labor row's count says.
    expect(rows.find((r) => r.id === 'station')?.hours).toBe(8)
    expect(rows.find((r) => r.id === 'station')?.hours).toBe(costEstimateLaborRowHours(STATION.laborRow as CostEstimateLaborRowCalc))
    expect(rows.find((r) => r.id === 'fd')?.hours).toBe(0)
    expect(priceCardRows([{ ...WC, laborRow: null }], MARKS, splitOf)[0]?.hours).toBe(0)
  })
  it("a subcontractor's Labor row carries none of our hours", () => {
    const sub = row('sub', 'Fire caulking', 1, 0, 2500, 0, { ...labor('Fire caulking', 1, 10, 10, 10), kind: 'sub' })
    expect(priceCardRows([sub], {}, splitOfWith({}))[0]?.hours).toBe(0)
  })
  it('the saved kind decides equipment before the name does', () => {
    const byId = new Map(priceCardRows(ROWS, MARKS, splitOf).map((r) => [r.id, r.isEquipment]))
    expect(byId.get('hoist')).toBe(true)
    expect(byId.get('station')).toBe(false)
    // With no marks the names alone decide: the hoist is no longer equipment, the station is.
    const bare = new Map(priceCardRows(ROWS, {}, splitOfWith({})).map((r) => [r.id, r.isEquipment]))
    expect(bare.get('hoist')).toBe(false)
    expect(bare.get('station')).toBe(true)
    expect(bare.get('lift')).toBe(true)
  })
  it('a row with no name reads as an empty name', () => {
    const blank = row('blank', null, 1, 0, 100, 0)
    expect(priceCardRows([blank], {}, splitOfWith({}))[0]?.name).toBe('')
    expect(kindCardRows([blank], {})[0]?.name).toBe('')
    expect(tagCardRows([blank], {}, splitOfWith({}))[0]?.name).toBe('')
    expect(priceCardRows([{ ...blank, countRow: { id: 'blank' } }], {}, splitOfWith({}))[0]?.name).toBe('')
  })
  it('asks for each row split once, with the row itself', () => {
    const spy = vi.fn(splitOf)
    priceCardRows(ROWS, MARKS, spy)
    expect(spy.mock.calls.map((c) => c[0])).toEqual(ROWS)
    expect(spy.mock.calls[0]?.[0]).toBe(WC)
  })
  it('no rows is no rows', () => {
    expect(priceCardRows([], MARKS, splitOf)).toEqual([])
  })
})

describe('breakdownSmallCosts', () => {
  it('adds driving, travel, permits, subs, waste and other', () => {
    expect(breakdownSmallCosts(TOTALS)).toBe(500)
    expect(breakdownSmallCosts({ drivingCost: 1, travelCost: 20, permitCost: 300, subcontractorCost: 4000, wasteCost: 50000, otherCost: 600000 })).toBe(654321)
  })
  it('leaves equipment rentals out: they have their own line', () => {
    expect(breakdownSmallCosts({ ...TOTALS, equipmentRentalCost: 99999 } as PriceCardTotals)).toBe(500)
  })
  it('adds in the order the tab did, so the cents match to the last bit', () => {
    const c = { drivingCost: 0.1, travelCost: 0.2, permitCost: 0.3, subcontractorCost: 0.4, wasteCost: 0.5, otherCost: 0.6 }
    expect(breakdownSmallCosts(c)).toBe(c.drivingCost + c.travelCost + c.permitCost + c.subcontractorCost + c.wasteCost + c.otherCost)
  })
})

describe('priceCardInput', () => {
  const input = priceCardInput({ rows: ROWS, marks: MARKS, splitOf, totals: TOTALS, markup: BID_MARKUP, laborRate: 50, laborRateSource: 'override' })
  it("carries the rows and the bid's totals as the Workbench prices them", () => {
    expect(input).toEqual({
      rows: priceCardRows(ROWS, MARKS, splitOf),
      materialTotal: 4500,
      hoursTotal: 40,
      markup: 0.5,
      taxPercent: 8.25,
      laborRate: 50,
      laborRateSource: 'override',
      equipmentCost: 1100,
      smallCosts: 500,
    })
  })
  it('reads the totals off a wider cost breakdown and takes nothing else from it', () => {
    const wide = { ...TOTALS, totalCost: 123456, laborCost: 2000, estimatorCost: 77, rows: [] }
    expect(priceCardInput({ rows: ROWS, marks: MARKS, splitOf, totals: wide, markup: BID_MARKUP, laborRate: 50, laborRateSource: 'override' })).toEqual(input)
  })
  it('passes no rate and its source through as they are', () => {
    const none = priceCardInput({ rows: ROWS, marks: MARKS, splitOf, totals: TOTALS, markup: 0.4, laborRate: null, laborRateSource: 'none' })
    expect(none.laborRate).toBeNull()
    expect(none.laborRateSource).toBe('none')
    expect(none.markup).toBe(0.4)
  })
  it("the Traditional card's dollars, end to end", () => {
    const b = buildPriceBreakdown(input)
    const line = (key: string) => b.lines.find((l) => l.key === key)
    // The price is the rows' prices; the four Price lines add to it.
    expect(b.price).toBe(14160)
    expect(line('material')).toMatchObject({ cost: 4200, price: 6000 })
    expect(line('tax')).toMatchObject({ cost: 346.5, price: 437.25 })
    expect(line('equipment')).toMatchObject({ cost: 1100, price: 1500 })
    expect(line('labor')).toMatchObject({ name: 'Labor', cost: 2000, price: 6222.75 })
    expect(line('small')).toMatchObject({ cost: 500, price: null })
    expect(6000 + 437.25 + 1500 + 6222.75).toBe(b.price)
    // Material at cost leaves the two equipment rows' own takeoff out: $4,500 less the lift's $300.
    expect(b.cost).toBe(8146.5)
    expect(b.profit).toBe(6013.5)
    expect(b.equipmentRows).toBe(2)
    expect(b.rowsWithHours).toBe(3)
    expect(b.rowsTotal).toBe(7)
  })
})

describe('kindCardRows', () => {
  it("gives each row its cost and price under its kind: the saved pick, else the name's guess", () => {
    expect(kindCardRows(ROWS, MARKS)).toEqual([
      { id: 'wc', name: 'Water closet', count: 12, cost: 3000, revenue: 4800, kind: 'fixture' },
      { id: 'lav', name: 'Lavatory', count: 8, cost: 1100, revenue: 2000, kind: 'fixture' },
      { id: 'fd', name: 'Floor drain', count: 6, cost: 0, revenue: 360, kind: rowKindOf('Floor drain', null).kind },
      { id: 'lift', name: 'Scissor lift', count: 1, cost: 300, revenue: 900, kind: 'equipment' },
      { id: 'hoist', name: 'Roof hoist', count: 1, cost: 450, revenue: 600, kind: 'equipment' },
      { id: 'station', name: 'Lift station', count: 1, cost: 2500, revenue: 4000, kind: 'fixture' },
      { id: 'sink', name: 'Mop sink', count: 2, cost: 900, revenue: 1500, kind: rowKindOf('Mop sink', null).kind },
    ])
  })
  it('reads no split and no tags', () => {
    for (const r of kindCardRows(ROWS, MARKS)) expect(Object.keys(r).sort()).toEqual(['cost', 'count', 'id', 'kind', 'name', 'revenue'])
  })
  it("the Kind card's dollars, end to end", () => {
    const comp = buildPricingComposition(kindCardRows([WC, LAV, LIFT, HOIST, STATION], MARKS))
    expect(comp.totalRevenue).toBe(12300)
    expect(comp.totalCost).toBe(7350)
    expect(comp.buckets.map((b) => [b.kind, b.rows, b.cost, b.revenue])).toEqual([
      ['fixture', 3, 6600, 10800],
      ['equipment', 2, 750, 1500],
    ])
  })
})

describe('tagCardRows', () => {
  it('gives each row its cost and price under its tags, with its material at cost and as sold', () => {
    expect(tagCardRows(ROWS, MARKS, splitOf)).toEqual([
      { id: 'wc', name: 'Water closet', count: 12, cost: 3000, revenue: 4800, tags: ['restrooms'], materialCost: 1200, materialPrice: 1800 },
      { id: 'lav', name: 'Lavatory', count: 8, cost: 1100, revenue: 2000, tags: ['restrooms', 'level 2'], materialCost: 400, materialPrice: 500 },
      // No takeoff: no material either way.
      { id: 'fd', name: 'Floor drain', count: 6, cost: 0, revenue: 360, tags: [], materialCost: 0, materialPrice: 0 },
      // Equipment sells no material, so its takeoff cost is left out of the markup.
      { id: 'lift', name: 'Scissor lift', count: 1, cost: 300, revenue: 900, tags: [], materialCost: 0, materialPrice: 0 },
      { id: 'hoist', name: 'Roof hoist', count: 1, cost: 450, revenue: 600, tags: [], materialCost: 0, materialPrice: 0 },
      { id: 'station', name: 'Lift station', count: 1, cost: 2500, revenue: 4000, tags: ['site'], materialCost: 2000, materialPrice: 3000 },
      // Material typed in dollars counts at what was typed, over its takeoff cost.
      { id: 'sink', name: 'Mop sink', count: 2, cost: 900, revenue: 1500, tags: [], materialCost: 500, materialPrice: 700 },
    ])
  })
  it('a row with no marks has no tags', () => {
    expect(tagCardRows([WC], {}, splitOfWith({}))[0]?.tags).toEqual([])
    expect(tagCardRows([WC], { wc: { kind: 'fixture' } }, splitOf)[0]?.tags).toEqual([])
  })
  it('hands the saved tags over as they are, the same list', () => {
    expect(tagCardRows([LAV], MARKS, splitOf)[0]?.tags).toBe(MARKS.lav?.tags)
  })
  it("the Tag card's dollars, end to end", () => {
    const comp = buildTagComposition(tagCardRows(ROWS, MARKS, splitOf))
    expect(comp.totalRevenue).toBe(14160)
    expect(comp.rowsWithManyTags).toBe(1)
    const bucket = (tag: string) => comp.buckets.find((b) => b.tag === tag)
    // Restrooms: $1,600 of material sold at $2,300.
    expect(bucket('restrooms')).toMatchObject({ rows: 2, cost: 4100, revenue: 6800, materialCost: 1600, materialPrice: 2300 })
    expect(bucket('restrooms')?.markup).toBeCloseTo(2300 / 1600 - 1, 12)
    expect(bucket('level 2')).toMatchObject({ rows: 1, cost: 1100, revenue: 2000, markup: 0.25 })
    expect(bucket('site')).toMatchObject({ rows: 1, cost: 2500, revenue: 4000, markup: 0.5 })
    // No tag: the drains, the lift, the hoist and the sinks; only the sinks have material.
    expect(bucket(NO_TAG)).toMatchObject({ rows: 4, cost: 1650, revenue: 3360, materialCost: 500, materialPrice: 700 })
    expect(comp.buckets.map((b) => b.tag)).toEqual(['restrooms', 'site', 'level 2', NO_TAG])
  })
})

describe('the move', () => {
  // The three inputs as `BidsPricingTab` wrote them inline in the cards' props before the move.
  const inline = (eff: ReadonlyArray<Row>, rowMarks: RowMarksByRowId, split: (r: Row) => ReturnType<typeof rowPriceSplit>, derived: PriceCardTotals, materialMarkup: number, pricingLaborRate: number | null, pricingLaborRateSource: 'override' | 'company' | 'none') => ({
    price: {
      rows: eff.map((r) => ({
        id: r.countRow.id,
        name: r.countRow.fixture ?? '',
        count: r.count,
        revenue: r.effRevenue,
        materialsBeforeTax: r.materialsBeforeTax,
        hours: r.laborRow ? costEstimateLaborRowHours(r.laborRow) : 0,
        isEquipment: rowKindOf(r.countRow.fixture ?? '', rowMarks[r.countRow.id]?.kind).kind === 'equipment',
        split: (() => {
          const s = split(r)
          return { material: s.material, tax: s.tax, equipment: s.equipment, labor: s.labor }
        })(),
      })),
      materialTotal: derived.totalMaterials,
      hoursTotal: derived.totalLaborHours,
      markup: materialMarkup,
      taxPercent: derived.taxPercent,
      laborRate: pricingLaborRate,
      laborRateSource: pricingLaborRateSource,
      equipmentCost: derived.equipmentRentalCost,
      smallCosts: derived.drivingCost + derived.travelCost + derived.permitCost + derived.subcontractorCost + derived.wasteCost + derived.otherCost,
    },
    kind: eff.map((r) => ({ id: r.countRow.id, name: r.countRow.fixture ?? '', count: r.count, cost: r.cost, revenue: r.effRevenue, kind: rowKindOf(r.countRow.fixture ?? '', rowMarks[r.countRow.id]?.kind).kind })),
    tag: eff.map((r) => {
      const s = split(r)
      return { id: r.countRow.id, name: r.countRow.fixture ?? '', count: r.count, cost: r.cost, revenue: r.effRevenue, tags: rowMarks[r.countRow.id]?.tags ?? [], materialCost: s.materialSource === 'none' ? 0 : r.materialsBeforeTax, materialPrice: s.material }
    }),
  })
  const moved = (eff: ReadonlyArray<Row>, marks: RowMarksByRowId, split: (r: Row) => ReturnType<typeof rowPriceSplit>, totals: PriceCardTotals, markup: number, laborRate: number | null, laborRateSource: 'override' | 'company' | 'none') => ({
    price: priceCardInput({ rows: eff, marks, splitOf: split, totals, markup, laborRate, laborRateSource }),
    kind: kindCardRows(eff, marks),
    tag: tagCardRows(eff, marks, split),
  })

  const cents: PriceCardTotals = { ...TOTALS, totalMaterials: 4400.37, drivingCost: 118.4, travelCost: 61.13, permitCost: 250.1, subcontractorCost: 1999.99, wasteCost: 30.07, otherCost: 0.3 }
  const cases: Array<[string, ReadonlyArray<Row>, RowMarksByRowId, PriceCardTotals, number, number | null, 'override' | 'company' | 'none']> = [
    ['the bid as marked', ROWS, MARKS, TOTALS, BID_MARKUP, 50, 'override'],
    ['no marks at all', ROWS, {}, TOTALS, BID_MARKUP, 50, 'override'],
    ['no rate', ROWS, MARKS, TOTALS, 0.4, null, 'none'],
    ['the crew rate, costs to the cent', ROWS, MARKS, cents, 0.35, 47.5, 'company'],
    ['one row', [WC], MARKS, TOTALS, BID_MARKUP, 50, 'override'],
    ['no rows', [], MARKS, TOTALS, BID_MARKUP, 50, 'override'],
    ['a row with no name and a row with no count', [row('blank', null, 1, 0, 100, 0), row('zero', 'Urinal', 0, 0, 0, 0), ...ROWS], MARKS, TOTALS, BID_MARKUP, 50, 'override'],
  ]
  it.each(cases)('is what the tab wrote inline: %s', (_name, eff, marks, totals, markup, rate, source) => {
    const split = splitOfWith(marks)
    expect(moved(eff, marks, split, totals, markup, rate, source)).toEqual(inline(eff, marks, split, totals, markup, rate, source))
  })
  it('is what the tab wrote inline while a markup is being typed on a row', () => {
    // The tab's `splitOf` reads the typed markup for that one row; the cards follow it.
    const typing = (r: Row) =>
      rowPriceSplit({
        price: r.effRevenue,
        materialCost: r.materialsBeforeTax,
        markup: BID_MARKUP,
        taxPercent: TAX,
        kind: rowKindOf(r.countRow.fixture ?? '', MARKS[r.countRow.id]?.kind).kind,
        typed: r.countRow.id === 'wc' ? { ...(MARKS.wc?.split ?? {}), markup: 0.75 } : (MARKS[r.countRow.id]?.split ?? null),
      })
    expect(moved(ROWS, MARKS, typing, TOTALS, BID_MARKUP, 50, 'override')).toEqual(inline(ROWS, MARKS, typing, TOTALS, BID_MARKUP, 50, 'override'))
    expect(tagCardRows(ROWS, MARKS, typing)[0]?.materialPrice).toBe(2100)
    expect(priceCardRows(ROWS, MARKS, typing)[0]?.split).toEqual({ material: 2100, tax: 173.25, equipment: 0, labor: 2526.75 })
  })
})
