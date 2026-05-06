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
