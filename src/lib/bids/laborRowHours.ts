import type { Database } from '../../types/database'

type CostEstimateLaborRow = Database['public']['Tables']['cost_estimate_labor_rows']['Row']

export function laborRowHours(r: CostEstimateLaborRow): number {
  const hrs = Number(r.rough_in_hrs_per_unit) + Number(r.top_out_hrs_per_unit) + Number(r.trim_set_hrs_per_unit)
  return r.is_fixed ? hrs : Number(r.count) * hrs
}
export function laborRowRough(r: CostEstimateLaborRow): number {
  return r.is_fixed ? Number(r.rough_in_hrs_per_unit) : Number(r.count) * Number(r.rough_in_hrs_per_unit)
}
export function laborRowTop(r: CostEstimateLaborRow): number {
  return r.is_fixed ? Number(r.top_out_hrs_per_unit) : Number(r.count) * Number(r.top_out_hrs_per_unit)
}
export function laborRowTrim(r: CostEstimateLaborRow): number {
  return r.is_fixed ? Number(r.trim_set_hrs_per_unit) : Number(r.count) * Number(r.trim_set_hrs_per_unit)
}
