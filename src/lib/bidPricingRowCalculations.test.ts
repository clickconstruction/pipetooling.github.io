import { describe, expect, it } from 'vitest'
import {
  computeBidPricingRows,
  costEstimateLaborRowHours,
  coverLetterTotalsFromPricingRows,
  type CostEstimateLaborRowCalc,
} from './bidPricingRowCalculations'

const entryToilet = {
  id: 'e-toilet',
  total_price: 100,
  fixture_types: { name: 'Toilet' },
}

const entrySink = {
  id: 'e-sink',
  total_price: 200,
  fixture_types: { name: 'Sink' },
}

const laborHalf = (): CostEstimateLaborRowCalc => ({
  fixture: 'Toilet',
  count: 1,
  rough_in_hrs_per_unit: 1,
  top_out_hrs_per_unit: 0,
  trim_set_hrs_per_unit: 0,
  is_fixed: false,
})

describe('costEstimateLaborRowHours', () => {
  it('multiplies per-unit hours by count when not fixed', () => {
    expect(
      costEstimateLaborRowHours({
        fixture: '',
        count: 2,
        rough_in_hrs_per_unit: 1,
        top_out_hrs_per_unit: 2,
        trim_set_hrs_per_unit: 0,
        is_fixed: false,
      }),
    ).toBe(6)
  })
})

const emptyHidden = (): ReadonlySet<string> => new Set()

const defaultAssignmentFields = (countRowId: string, entryId: string) => ({
  count_row_id: countRowId,
  price_book_entry_id: entryId,
  is_fixed_price: false,
  unit_price_override: null as number | null,
})

describe('computeBidPricingRows', () => {
  it('sums unit revenues for multiple rows', () => {
    const res = computeBidPricingRows({
      countRows: [
        { id: 'a', fixture: 'Toilet', count: 2 },
        { id: 'b', fixture: 'Sink', count: 1 },
      ],
      assignments: [
        defaultAssignmentFields('a', 'e-toilet'),
        defaultAssignmentFields('b', 'e-sink'),
      ],
      entries: [entryToilet, entrySink],
      customUnitPriceByCountRowId: new Map(),
      laborRows: [
        laborHalf(),
        { ...laborHalf(), fixture: 'Sink', top_out_hrs_per_unit: 1 },
      ],
      totalMaterials: 100,
      laborRate: 10,
      taxPercent: 0,
      materialsFromTakeoffByCountRowId: {},
      hiddenSubmissionCountRowIds: emptyHidden(),
    })
    expect(res.rows[0]!.revenue).toBe(200) // 2 * 100
    expect(res.rows[1]!.revenue).toBe(200) // 1 * 200
    expect(res.totalRevenue).toBe(400)
  })

  it('hiddenSubmissionCountRowIds excludes line from fixtureRows only', () => {
    const res = computeBidPricingRows({
      countRows: [
        { id: 'a', fixture: 'Toilet', count: 1 },
        { id: 'b', fixture: 'Sink', count: 1 },
      ],
      assignments: [
        defaultAssignmentFields('a', 'e-toilet'),
        defaultAssignmentFields('b', 'e-sink'),
      ],
      entries: [entryToilet, entrySink],
      customUnitPriceByCountRowId: new Map(),
      laborRows: [
        { ...laborHalf(), count: 1 },
        { ...laborHalf(), fixture: 'Sink', count: 1 },
      ],
      totalMaterials: 0,
      laborRate: 10,
      taxPercent: 0,
      materialsFromTakeoffByCountRowId: {},
      hiddenSubmissionCountRowIds: new Set(['b']),
    })
    const { revenueSum, fixtureRows } = coverLetterTotalsFromPricingRows(res.rows)
    expect(revenueSum).toBe(res.totalRevenue)
    expect(fixtureRows).toEqual([{ fixture: 'Toilet', count: 1 }])
  })

  it('respects hidden row when no assignment (custom-priced row)', () => {
    const res = computeBidPricingRows({
      countRows: [
        { id: 'a', fixture: 'Toilet', count: 1 },
        { id: 'b', fixture: 'Sink', count: 1 },
      ],
      assignments: [defaultAssignmentFields('a', 'e-toilet')],
      entries: [entryToilet, entrySink],
      customUnitPriceByCountRowId: new Map([['b', 333]]),
      laborRows: [
        { ...laborHalf(), count: 1 },
        { ...laborHalf(), fixture: 'Sink', count: 1 },
      ],
      totalMaterials: 0,
      laborRate: 10,
      taxPercent: 0,
      materialsFromTakeoffByCountRowId: {},
      hiddenSubmissionCountRowIds: new Set(['b']),
    })
    expect(res.rows.find((r) => r.countRow.id === 'b')?.omitFromSubmissionDocuments).toBe(true)
    const { fixtureRows } = coverLetterTotalsFromPricingRows(res.rows)
    expect(fixtureRows).toEqual([{ fixture: 'Toilet', count: 1 }])
  })

  it('respects fixed price row revenue', () => {
    const res = computeBidPricingRows({
      countRows: [{ id: 'a', fixture: 'Toilet', count: 5 }],
      assignments: [
        {
          ...defaultAssignmentFields('a', 'e-toilet'),
          is_fixed_price: true,
        },
      ],
      entries: [entryToilet],
      customUnitPriceByCountRowId: new Map(),
      laborRows: [laborHalf()],
      totalMaterials: 0,
      laborRate: 10,
      taxPercent: 0,
      materialsFromTakeoffByCountRowId: {},
      hiddenSubmissionCountRowIds: emptyHidden(),
    })
    expect(res.rows[0]!.revenue).toBe(100)
    expect(res.rows[0]!.isFixedPrice).toBe(true)
  })
})

describe('materials override from applied quotes (Rung G, v2.2655)', () => {
  const base = {
    countRows: [{ id: 'r1', fixture: 'WC-1', count: 4 }],
    assignments: [],
    entries: [],
    customUnitPriceByCountRowId: new Map<string, number>(),
    laborRows: [{ fixture: 'WC-1', count: 4, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0, is_fixed: false }],
    totalMaterials: 1000,
    laborRate: 50,
    taxPercent: 10,
    materialsFromTakeoffByCountRowId: { r1: 400 },
    hiddenSubmissionCountRowIds: new Set<string>(),
  }
  it('replaces the materials component only — labor survives, tax applies like takeoff', () => {
    const withOverride = computeBidPricingRows({ ...base, materialsOverrideUnitByCountRowId: new Map([['r1', 80]]) })
    const row = withOverride.rows[0]!
    expect(row.materialsFromQuote).toBe(true)
    expect(row.materialsBeforeTax).toBe(320) // 80/unit × 4, not the takeoff 400
    expect(row.materialsWithTax).toBeCloseTo(352) // taxed like takeoff materials
    expect(row.laborCost).toBe(200) // 4 units × 1hr × $50 — untouched
    expect(row.cost).toBeCloseTo(552)
  })
  it('without an override the takeoff branch is unchanged', () => {
    const row = computeBidPricingRows(base).rows[0]!
    expect(row.materialsFromQuote).toBe(false)
    expect(row.materialsBeforeTax).toBe(400)
    expect(row.cost).toBeCloseTo(200 + 440)
  })
  it('the override recomputes against the live count (drift-safe)', () => {
    const grown = computeBidPricingRows({
      ...base,
      countRows: [{ id: 'r1', fixture: 'WC-1', count: 6 }],
      materialsOverrideUnitByCountRowId: new Map([['r1', 80]]),
    })
    expect(grown.rows[0]!.materialsBeforeTax).toBe(480)
  })
})
