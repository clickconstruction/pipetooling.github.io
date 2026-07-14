import { useEffect, useState } from 'react'
import { laborJobMatchesHcp } from '../lib/jobs/jobProfitSummary'
import type { LaborJobCostInput } from '../lib/jobs/subLaborCost'
import { supabase } from '../lib/supabase'

export type JobDetailSubLaborData = {
  /** Sub-labor books matching the job's HCP #, items attached (empty = no books). */
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
 * Sub-labor cost inputs for the Job Detail profit band. Books are matched to the
 * HCP # client-side (trimmed, case-insensitive) like the Jobs page aggregations —
 * stored `job_number` values can carry whitespace, so a server filter would miss.
 */
export function useJobDetailSubLaborCost(
  enabled: boolean,
  hcpNumber: string | null,
): { loading: boolean; data: JobDetailSubLaborData | null; failed: boolean } {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<JobDetailSubLaborData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) {
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
        const settingByKey = new Map(
          ((settingsRes.data ?? []) as Array<{ key: string; value_num: number | null }>).map((r) => [
            r.key,
            r.value_num,
          ]),
        )
        const mileageCost = settingByKey.get('drive_mileage_cost') ?? 0.7
        const timePerMile = settingByKey.get('drive_time_per_mile') ?? 0.02

        const matched = ((jobsRes.data ?? []) as LaborJobRow[]).filter((j) =>
          laborJobMatchesHcp(j.job_number, hcpNumber),
        )
        if (matched.length === 0) {
          setData({ laborJobs: [], mileageCost, timePerMile })
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
        const itemsByJob = new Map<string, LaborItemRow[]>()
        for (const it of (itemsRes.data ?? []) as LaborItemRow[]) {
          if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
          itemsByJob.get(it.job_id)!.push(it)
        }
        setData({
          laborJobs: matched.map((j) => ({
            labor_rate: j.labor_rate,
            distance_miles: j.distance_miles,
            items: (itemsByJob.get(j.id) ?? []).map((it) => ({
              count: it.count,
              hrs_per_unit: it.hrs_per_unit,
              is_fixed: it.is_fixed ?? undefined,
              labor_rate: it.labor_rate,
              direct_labor_amount: it.direct_labor_amount,
            })),
          })),
          mileageCost,
          timePerMile,
        })
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
  }, [enabled, hcpNumber])

  return { loading, data, failed }
}
