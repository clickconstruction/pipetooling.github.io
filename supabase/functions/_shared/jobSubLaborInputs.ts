// Sub-labor inputs for a job's profit (v2.3646, to-dos/mcp-servers.md PR 4b-2): the pure assembly
// the Job window's hook did inline — sheets linked to the job, their items, and the two drive
// settings with their defaults — so dev-mcp's get_job feeds `buildJobProfitSummary` the same way.

import type { LaborJobCostInput } from './subLaborCost.ts'

export const DEFAULT_DRIVE_MILEAGE_COST = 0.7
export const DEFAULT_DRIVE_TIME_PER_MILE = 0.02
export const DRIVE_SETTING_KEYS = ['drive_mileage_cost', 'drive_time_per_mile'] as const

export type SubLaborSheetRow = { id: string; labor_rate: number | null; distance_miles: number | null }
export type SubLaborItemRow = {
  job_id: string
  count: number
  hrs_per_unit: number
  is_fixed: boolean | null
  labor_rate: number | null
  direct_labor_amount: number | null
}
export type JobSubLaborInputs = { laborJobs: LaborJobCostInput[]; mileageCost: number; timePerMile: number }

export function jobSubLaborInputsFromRows(
  sheets: readonly SubLaborSheetRow[],
  items: readonly SubLaborItemRow[],
  settings: readonly { key: string; value_num: number | null }[],
): JobSubLaborInputs {
  const settingByKey = new Map(settings.map((r) => [r.key, r.value_num]))
  const itemsBySheet = new Map<string, SubLaborItemRow[]>()
  for (const it of items) {
    if (!itemsBySheet.has(it.job_id)) itemsBySheet.set(it.job_id, [])
    itemsBySheet.get(it.job_id)!.push(it)
  }
  return {
    laborJobs: sheets.map((j) => ({
      labor_rate: j.labor_rate,
      distance_miles: j.distance_miles,
      items: (itemsBySheet.get(j.id) ?? []).map((it) => ({
        count: it.count,
        hrs_per_unit: it.hrs_per_unit,
        is_fixed: it.is_fixed ?? undefined,
        labor_rate: it.labor_rate,
        direct_labor_amount: it.direct_labor_amount,
      })),
    })),
    mileageCost: settingByKey.get('drive_mileage_cost') ?? DEFAULT_DRIVE_MILEAGE_COST,
    timePerMile: settingByKey.get('drive_time_per_mile') ?? DEFAULT_DRIVE_TIME_PER_MILE,
  }
}
