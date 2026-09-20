import { useEffect, useState } from 'react'
import type { LaborJobCostInput } from '../lib/jobs/subLaborCost'
import { supabase } from '../lib/supabase'
import { jobSubLaborInputsFromRows } from '../../supabase/functions/_shared/jobSubLaborInputs'

export type JobDetailSubLaborData = {
  /** Sub-labor sheets linked to the job (job_ledger_id), items attached (empty = no sheets). */
  laborJobs: LaborJobCostInput[]
  mileageCost: number
  timePerMile: number
}

type LaborJobRow = {
  id: string
  job_number: string | null
  labor_rate: number | null
  distance_miles: number | null
}

type LaborItemRow = {
  job_id: string
  count: number
  hrs_per_unit: number
  is_fixed: boolean | null
  labor_rate: number | null
  direct_labor_amount: number | null
}

/**
 * Sub-labor cost inputs for the Job Detail profit band. Sheets are read by their
 * job link (`people_labor_jobs.job_ledger_id`, v2.3060) — the old client-side HCP
 * text match is gone.
 */
export function useJobDetailSubLaborCost(
  enabled: boolean,
  jobId: string | null,
): { loading: boolean; data: JobDetailSubLaborData | null; failed: boolean } {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<JobDetailSubLaborData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled || !jobId) {
      setLoading(false)
      setData(null)
      setFailed(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setFailed(false)

    void (async () => {
      try {
        const [jobsRes, settingsRes] = await Promise.all([
          supabase
            .from('people_labor_jobs')
            .select('id, job_number, labor_rate, distance_miles')
            .eq('job_ledger_id', jobId)
            .order('created_at', { ascending: false }),
          supabase
            .from('app_settings')
            .select('key, value_num')
            .in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
        ])
        if (cancelled) return
        if (jobsRes.error) {
          setFailed(true)
          setData(null)
          return
        }
        const settings = (settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>
        const matched = (jobsRes.data ?? []) as LaborJobRow[]
        if (matched.length === 0) {
          setData(jobSubLaborInputsFromRows([], [], settings))
          return
        }

        const itemsRes = await supabase
          .from('people_labor_job_items')
          .select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
          .in(
            'job_id',
            matched.map((j) => j.id),
          )
        if (cancelled) return
        if (itemsRes.error) {
          setFailed(true)
          setData(null)
          return
        }
        // The assembly (items by sheet, the drive-setting defaults) is the shared kernel's (v2.3646).
        setData(jobSubLaborInputsFromRows(matched, (itemsRes.data ?? []) as LaborItemRow[], settings))
      } catch {
        if (!cancelled) {
          setFailed(true)
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, jobId])

  return { loading, data, failed }
}
