import { describe, expect, it } from 'vitest'
import { laborRowHours, laborRowMultiplier, laborRowRough, laborRowTop, laborRowTrim } from './laborRowHours'
import type { Database } from '../../types/database'

type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']

function laborRow(partial: Partial<CostEstimateLaborRow>): CostEstimateLaborRow {
  return {
    count: 1,
    rough_in_hrs_per_unit: 0,
    top_out_hrs_per_unit: 0,
    trim_set_hrs_per_unit: 0,
    is_fixed: false,
    kind: 'fixture',
    unit: 'each',
    ...partial,
  } as CostEstimateLaborRow
}

describe('per-stage hours (is_fixed = false multiplies by count)', () => {
  const r = laborRow({ count: 4, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 3, trim_set_hrs_per_unit: 1, is_fixed: false })
  it('rough = count x rough_in_hrs_per_unit', () => expect(laborRowRough(r)).toBe(8))
  it('top = count x top_out_hrs_per_unit', () => expect(laborRowTop(r)).toBe(12))
  it('trim = count x trim_set_hrs_per_unit', () => expect(laborRowTrim(r)).toBe(4))
})

describe('per-stage hours (is_fixed = true uses raw hrs)', () => {
  const r = laborRow({ count: 4, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 3, trim_set_hrs_per_unit: 1, is_fixed: true })
  it('rough = rough_in_hrs_per_unit', () => expect(laborRowRough(r)).toBe(2))
  it('top = top_out_hrs_per_unit', () => expect(laborRowTop(r)).toBe(3))
  it('trim = trim_set_hrs_per_unit', () => expect(laborRowTrim(r)).toBe(1))
})

describe('laborRowHours (sum across stages)', () => {
  it('multiplies the stage sum by count when not fixed', () => {
    const r = laborRow({ count: 4, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 3, trim_set_hrs_per_unit: 1, is_fixed: false })
    expect(laborRowHours(r)).toBe(24)
  })

  it('uses the raw stage sum when fixed', () => {
    const r = laborRow({ count: 4, rough_in_hrs_per_unit: 2, top_out_hrs_per_unit: 3, trim_set_hrs_per_unit: 1, is_fixed: true })
    expect(laborRowHours(r)).toBe(6)
  })
})

describe('unit and kind (v2.3289)', () => {
  it('per_100ft reads count ÷ 100 × the stage hours — 719.46 ft of ½" water at 2.5 / 1.5 / 0 per 100 ft', () => {
    const r = laborRow({ count: 719.46, rough_in_hrs_per_unit: 2.5, top_out_hrs_per_unit: 1.5, trim_set_hrs_per_unit: 0, unit: 'per_100ft' })
    expect(laborRowMultiplier(r)).toBeCloseTo(7.1946, 4)
    expect(laborRowRough(r)).toBeCloseTo(17.99, 2)
    expect(laborRowTop(r)).toBeCloseTo(10.79, 2)
    expect(laborRowHours(r)).toBeCloseTo(28.78, 2)
  })
  it('a task row is fixed hours even when is_fixed was never set', () => {
    const r = laborRow({ count: 4, rough_in_hrs_per_unit: 6, kind: 'task', is_fixed: false })
    expect(laborRowHours(r)).toBe(6)
  })
  it('a sub line carries none of our hours', () => {
    const r = laborRow({ count: 4, rough_in_hrs_per_unit: 6, top_out_hrs_per_unit: 2, kind: 'sub' })
    expect(laborRowHours(r)).toBe(0)
    expect(laborRowMultiplier(r)).toBe(0)
  })
  it('a row written before the columns existed reads exactly as before', () => {
    const r = { count: 3, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1, is_fixed: false }
    expect(laborRowHours(r)).toBe(9)
  })
})
