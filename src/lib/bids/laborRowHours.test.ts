import { describe, expect, it } from 'vitest'
import { laborRowHours, laborRowRough, laborRowTop, laborRowTrim } from './laborRowHours'
import type { Database } from '../../types/database'

type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']

function laborRow(partial: Partial<CostEstimateLaborRow>): CostEstimateLaborRow {
  return {
    count: 1,
    rough_in_hrs_per_unit: 0,
    top_out_hrs_per_unit: 0,
    trim_set_hrs_per_unit: 0,
    is_fixed: false,
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
