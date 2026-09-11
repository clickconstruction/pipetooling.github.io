import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CalibrationJob } from '../lib/bids/laborBookCalibration'

/**
 * The jobs a labor book can calibrate against (the Labor refresh PR 5 —
 * v2.3307): every job linked to a bid that priced with this book
 * (`jobs_ledger.bid_id` → `bids.selected_labor_book_version_id`), with the
 * bid's predicted labor rows, the job's recorded field hours
 * (`get_man_hours_by_job`, the Stages board's RPC) and its field days
 * (distinct clock-session dates). The kernels decide what qualifies. Fail-soft:
 * roles the RPC refuses (estimators) get an empty list, and the view says
 * "no linked jobs yet" rather than pretending.
 */
export type LaborBookCalibrationState = { loading: boolean; jobs: CalibrationJob[]; loaded: boolean }

export function useLaborBookCalibration(bookVersionId: string | null, enabled: boolean, gen = 0): LaborBookCalibrationState {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [jobs, setJobs] = useState<CalibrationJob[]>([])

  useEffect(() => {
    if (!enabled || !bookVersionId) {
      setJobs([])
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data: bids } = await supabase.from('bids').select('id').eq('selected_labor_book_version_id', bookVersionId).limit(1000)
        const bidIds = ((bids ?? []) as Array<{ id: string }>).map((b) => b.id)
        if (bidIds.length === 0) {
          if (!cancelled) setJobs([])
          return
        }
        const { data: linked } = await supabase.from('jobs_ledger').select('id, hcp_number, job_name, pct_complete, status, bid_id').in('bid_id', bidIds).limit(1000)
        const linkedJobs = (linked ?? []) as Array<{ id: string; hcp_number: string | null; job_name: string | null; pct_complete: number | null; status: string | null; bid_id: string | null }>
        if (linkedJobs.length === 0) {
          if (!cancelled) setJobs([])
          return
        }
        const jobIds = linkedJobs.map((j) => j.id)
        const [estRes, hoursRes, sessRes] = await Promise.all([
          supabase.from('cost_estimates').select('bid_id, cost_estimate_labor_rows(fixture, count, is_fixed, kind, unit, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit)').in('bid_id', [...new Set(linkedJobs.map((j) => j.bid_id!))]),
          supabase.rpc('get_man_hours_by_job'),
          supabase.from('clock_sessions').select('job_ledger_id, work_date').in('job_ledger_id', jobIds).is('rejected_at', null).is('revoked_at', null).limit(5000),
        ])
        if (cancelled) return
        const rowsByBid = new Map<string, CalibrationJob['rows']>()
        for (const e of (estRes.data ?? []) as Array<{ bid_id: string; cost_estimate_labor_rows: CalibrationJob['rows'] | null }>) rowsByBid.set(e.bid_id, e.cost_estimate_labor_rows ?? [])
        const hoursByJob = new Map<string, number>()
        for (const r of ((hoursRes.error ? [] : hoursRes.data) ?? []) as Array<{ job_id: string; man_hours: number | string | null }>) hoursByJob.set(r.job_id, (hoursByJob.get(r.job_id) ?? 0) + (Number(r.man_hours) || 0))
        const daysByJob = new Map<string, Set<string>>()
        for (const s of (sessRes.data ?? []) as Array<{ job_ledger_id: string | null; work_date: string }>) {
          if (!s.job_ledger_id) continue
          const set = daysByJob.get(s.job_ledger_id) ?? new Set<string>()
          set.add(s.work_date)
          daysByJob.set(s.job_ledger_id, set)
        }
        const out: CalibrationJob[] = linkedJobs.map((j) => {
          const num = (j.hcp_number ?? '').trim().replace(/^[jJ]\s*/, '')
          const finished = j.status === 'paid' || j.status === 'billed'
          return {
            jobId: j.id,
            label: `${num ? `J${num} ` : ''}${(j.job_name ?? '').trim()}`.trim() || 'Job',
            bidId: j.bid_id!,
            pctDone: finished ? 100 : j.pct_complete != null ? Number(j.pct_complete) : null,
            fieldDays: daysByJob.get(j.id)?.size ?? 0,
            actualHours: hoursByJob.get(j.id) ?? 0,
            rows: rowsByBid.get(j.bid_id!) ?? [],
          }
        })
        setJobs(out)
      } catch {
        if (!cancelled) setJobs([])
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookVersionId, enabled, gen])

  return { loading, jobs, loaded }
}
