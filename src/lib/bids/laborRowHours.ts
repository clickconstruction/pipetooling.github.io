import type { Database } from '../../types/database'

type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']

/**
 * A labor row's hours (the Labor refresh PR 2 made the row say how to read it):
 *
 *   kind 'sub'          → 0 — a subcontractor's line carries none of our field hours
 *   is_fixed / 'task'   → the stage hours as typed (not × count)
 *   unit 'per_100ft'    → count ÷ 100 × the stage hours (footage rows)
 *   otherwise           → count × the stage hours
 *
 * Rows written before v2.3291 have kind 'fixture' and unit 'each', so the old
 * arithmetic is unchanged for them. The Old view, the sub sheets and Pricing
 * all read through here.
 */
export const LABOR_FOOTAGE_UNIT = 100

type RowShape = Pick<CostEstimateLaborRow, 'count' | 'is_fixed' | 'rough_in_hrs_per_unit' | 'top_out_hrs_per_unit' | 'trim_set_hrs_per_unit'> & Partial<Pick<CostEstimateLaborRow, 'kind' | 'unit'>>

/** The multiplier on a stage's per-unit hours: 0 for a sub line, 1 for fixed hours, count ÷ 100 per 100 ft, else count. */
export function laborRowMultiplier(r: RowShape): number {
  if (r.kind === 'sub') return 0
  if (r.is_fixed || r.kind === 'task') return 1
  const count = Number(r.count) || 0
  return r.unit === 'per_100ft' ? count / LABOR_FOOTAGE_UNIT : count
}

export function laborRowRough(r: RowShape): number {
  return laborRowMultiplier(r) * Number(r.rough_in_hrs_per_unit)
}
export function laborRowTop(r: RowShape): number {
  return laborRowMultiplier(r) * Number(r.top_out_hrs_per_unit)
}
export function laborRowTrim(r: RowShape): number {
  return laborRowMultiplier(r) * Number(r.trim_set_hrs_per_unit)
}
export function laborRowHours(r: RowShape): number {
  return laborRowRough(r) + laborRowTop(r) + laborRowTrim(r)
}
