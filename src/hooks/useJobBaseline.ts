import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * The job's kept baseline (v2.3367): the `job_baselines` row (wage roles —
 * RLS returns nothing to others) and its per-fixture rows, plus `keepNow`,
 * the Costs tab's door to `keep_job_baseline_now`. Fail-soft: a table that
 * has not landed yet reads as "not kept".
 */
export type JobBaselineRow = {
  job_id: string
  bid_id: string | null
  kept_at: string
  kept_by: string | null
  kept_on: 'billed' | 'kept' | string
  job_status: string | null
  price_usd: number | string | null
  team_hours: number | string | null
  team_usd: number | string | null
  people_count: number | null
  materials_usd: number | string | null
  hours_per_thousand: number | string | null
  avg_wage_usd: number | string | null
  grade: 'per_thousand' | 'fixture' | string
}
export type JobBaselineFixtureRow = { fixture: string; unit: string | null; count: number | string; hours: number | string; weight_source: string; predicted_hours: number | string | null }

export type JobBaselineState = {
  loading: boolean
  loaded: boolean
  busy: boolean
  error: string | null
  row: JobBaselineRow | null
  rows: JobBaselineFixtureRow[]
  keepNow: () => Promise<boolean>
  reload: () => Promise<void>
}

export function useJobBaseline(jobId: string | null, enabled: boolean): JobBaselineState {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [row, setRow] = useState<JobBaselineRow | null>(null)
  const [rows, setRows] = useState<JobBaselineFixtureRow[]>([])

  const reload = useCallback(async () => {
    if (!jobId || !enabled) {
      setRow(null)
      setRows([])
      setLoaded(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase.from('job_baselines').select('*').eq('job_id', jobId).maybeSingle()
      const r = (data ?? null) as JobBaselineRow | null
      setRow(r)
      if (r && r.grade === 'fixture') {
        const { data: fr } = await supabase.from('job_baseline_rows').select('fixture, unit, count, hours, weight_source, predicted_hours').eq('job_id', jobId).order('hours', { ascending: false })
        setRows((fr ?? []) as JobBaselineFixtureRow[])
      } else setRows([])
    } catch {
      setRow(null)
      setRows([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [jobId, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const keepNow = useCallback(async (): Promise<boolean> => {
    if (!jobId) return false
    setBusy(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('keep_job_baseline_now', { p_job_id: jobId })
      if (err) {
        setError(err.message)
        return false
      }
      if (data === false) {
        setError('Nothing to keep yet — the job has no recorded hours.')
        return false
      }
      await reload()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not keep the baseline.')
      return false
    } finally {
      setBusy(false)
    }
  }, [jobId, reload])

  return { loading, loaded, busy, error, row, rows, keepNow, reload }
}
