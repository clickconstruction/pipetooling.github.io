import { describe, expect, it } from 'vitest'
import { DEFAULT_DRIVE_MILEAGE_COST, DEFAULT_DRIVE_TIME_PER_MILE, jobSubLaborInputsFromRows } from '../../../supabase/functions/_shared/jobSubLaborInputs'

describe('jobSubLaborInputsFromRows', () => {
  it('attaches items to their sheet and keeps a sheet with none', () => {
    const out = jobSubLaborInputsFromRows(
      [{ id: 's1', labor_rate: 50, distance_miles: 10 }, { id: 's2', labor_rate: null, distance_miles: null }],
      [
        { job_id: 's1', count: 2, hrs_per_unit: 3, is_fixed: null, labor_rate: null, direct_labor_amount: null },
        { job_id: 's1', count: 1, hrs_per_unit: 1, is_fixed: true, labor_rate: 80, direct_labor_amount: 25 },
        { job_id: 'gone', count: 9, hrs_per_unit: 9, is_fixed: false, labor_rate: null, direct_labor_amount: null },
      ],
      [{ key: 'drive_mileage_cost', value_num: 0.9 }],
    )
    expect(out.laborJobs).toHaveLength(2)
    expect(out.laborJobs[0]!.items).toEqual([
      { count: 2, hrs_per_unit: 3, is_fixed: undefined, labor_rate: null, direct_labor_amount: null },
      { count: 1, hrs_per_unit: 1, is_fixed: true, labor_rate: 80, direct_labor_amount: 25 },
    ])
    expect(out.laborJobs[1]!.items).toEqual([])
    expect(out.mileageCost).toBe(0.9)
    expect(out.timePerMile).toBe(DEFAULT_DRIVE_TIME_PER_MILE)
  })

  it('falls back to the drive defaults when the settings are missing or null', () => {
    const out = jobSubLaborInputsFromRows([], [], [{ key: 'drive_mileage_cost', value_num: null }])
    expect(out).toEqual({ laborJobs: [], mileageCost: DEFAULT_DRIVE_MILEAGE_COST, timePerMile: DEFAULT_DRIVE_TIME_PER_MILE })
  })
})
