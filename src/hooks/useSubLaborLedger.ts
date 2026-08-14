import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LaborJob, LaborJobPayment } from '../types/laborJob'

/**
 * Sub Labor ledger + payments engine (Jobs.tsx decomposition seam — see
 * docs/JOBS_TABS_ARCHITECTURE.md). Owns the `people_labor_jobs` list (with
 * items + payments + the HCP → job-name join) and its row-level mutations.
 * Behavior-preserving extraction: the page destructures the return so every
 * downstream reference keeps its name.
 *
 * Stays in the page for now (moves with the Sub Labor modal in a later PR):
 * the labor form state + save handlers, the labor-book CRUD, the roster, and
 * the payment/backcharge modal open states — those are UI-coupled.
 */
export function useSubLaborLedger({
  authUserId,
  setError,
  onLaborJobsReloaded,
}: {
  authUserId: string | undefined
  /** Page-global error (Jobs map quirk #7 — one error state shared across tabs). */
  setError: (msg: string | null) => void
  /** Called with the freshly mapped list after each successful reload (the page syncs its open Edit Sub Labor modal). */
  onLaborJobsReloaded?: (jobs: LaborJob[]) => void
}) {
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobNamesByHcp, setLaborJobNamesByHcp] = useState<Record<string, string>>({})
  const [laborJobsLoading, setLaborJobsLoading] = useState(false)
  /**
   * True after the first loadLaborJobs completes (success or error).
   * `laborJobsLoading` starts false BEFORE any load begins, so deep-link
   * effects that gate on it alone run against an empty list on the earliest
   * cold-load passes — gate on this instead (v2.834 handle-race fix).
   */
  const [laborJobsLoadedOnce, setLaborJobsLoadedOnce] = useState(false)
  const [laborJobDeletingId, setLaborJobDeletingId] = useState<string | null>(null)

  async function loadLaborJobs() {
    if (!authUserId) return
    setLaborJobsLoading(true)
    setError(null)
    // Anchored select first (project_id/step_id, RUN_SUBS_PLAN PR 0.3); fall
    // back to the legacy column list if the migration isn't applied yet, so
    // client and migration deploy in either order.
    let jobs: LaborJob[] | null = null
    let jobsErr: { message: string } | null = null
    {
      const withAnchors = await supabase
        .from('people_labor_jobs')
        .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at, distance_miles, invoice_link, project_id, step_id')
        .order('created_at', { ascending: false })
      if (withAnchors.error) {
        const legacy = await supabase
          .from('people_labor_jobs')
          .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at, distance_miles, invoice_link')
          .order('created_at', { ascending: false })
        jobs = legacy.data as LaborJob[] | null
        jobsErr = legacy.error
      } else {
        jobs = withAnchors.data as LaborJob[] | null
      }
    }
    if (jobsErr) {
      setError(jobsErr.message)
      setLaborJobs([])
      setLaborJobNamesByHcp({})
    } else if (jobs?.length) {
      const jobIds = jobs.map((j) => j.id)
      const hcpNumbers = [...new Set((jobs as LaborJob[]).map((j) => (j.job_number ?? '').trim()).filter(Boolean))]
      const [itemsRes, paymentsRes, ledgerRes] = await Promise.all([
        supabase
          .from('people_labor_job_items')
          .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        supabase
          .from('people_labor_job_payments')
          .select('id, job_id, amount, memo, created_at, payment_date')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        hcpNumbers.length > 0 ? supabase.rpc('get_jobs_ledger_by_hcp_numbers', { p_hcp_numbers: hcpNumbers }) : { data: [] },
      ])
      const { data: items } = itemsRes
      const { data: paymentsData } = paymentsRes
      const { data: ledgerJobs } = ledgerRes
      const itemsByJob = new Map<
        string,
        Array<{
          fixture: string
          count: number
          hrs_per_unit: number
          is_fixed?: boolean
          labor_rate?: number | null
          direct_labor_amount?: number | null
        }>
      >()
      for (const it of (items ?? []) as Array<{
        job_id: string
        fixture: string
        count: number
        hrs_per_unit: number
        is_fixed?: boolean
        labor_rate?: number | null
        direct_labor_amount?: number | null
      }>) {
        if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
        itemsByJob.get(it.job_id)!.push({
          fixture: it.fixture,
          count: it.count,
          hrs_per_unit: it.hrs_per_unit,
          is_fixed: it.is_fixed,
          labor_rate: it.labor_rate,
          direct_labor_amount: it.direct_labor_amount,
        })
      }
      const paymentsByJob = new Map<string, LaborJobPayment[]>()
      for (const p of (paymentsData ?? []) as Array<{ job_id: string; id: string; amount: number; memo: string | null; created_at: string; payment_date: string | null }>) {
        if (!paymentsByJob.has(p.job_id)) paymentsByJob.set(p.job_id, [])
        paymentsByJob.get(p.job_id)!.push({ id: p.id, amount: Number(p.amount), memo: p.memo, created_at: p.created_at, payment_date: p.payment_date })
      }
      const jobNamesByHcp: Record<string, string> = {}
      for (const j of (ledgerJobs ?? []) as Array<{ hcp_number: string; job_name: string }>) {
        const key = (j.hcp_number ?? '').trim().toLowerCase()
        if (key && j.job_name) jobNamesByHcp[key] = j.job_name.trim()
      }
      setLaborJobNamesByHcp(jobNamesByHcp)
      // Resolve project names for anchored sheets (display only, fail-soft).
      const projectIds = [...new Set((jobs as LaborJob[]).map((j) => j.project_id).filter((id): id is string => !!id))]
      const projectNamesById = new Map<string, string>()
      if (projectIds.length > 0) {
        const { data: projectRows } = await supabase.from('projects').select('id, name').in('id', projectIds)
        for (const p of (projectRows ?? []) as Array<{ id: string; name: string }>) {
          projectNamesById.set(p.id, p.name)
        }
      }
      const mappedJobs = (jobs as LaborJob[]).map((j) => ({
        ...j,
        items: itemsByJob.get(j.id) ?? [],
        payments: paymentsByJob.get(j.id) ?? [],
        project_name: j.project_id ? projectNamesById.get(j.project_id) ?? null : null,
      }))
      setLaborJobs(mappedJobs)
      onLaborJobsReloaded?.(mappedJobs)
    } else {
      setLaborJobs([])
      setLaborJobNamesByHcp({})
    }
    setLaborJobsLoading(false)
    setLaborJobsLoadedOnce(true)
  }

  async function deleteLaborJob(id: string): Promise<boolean> {
    if (!confirm('Delete this job from the sub sheet ledger?')) return false
    setLaborJobDeletingId(id)
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').delete().eq('id', id)
    if (err) {
      setError(err.message)
      setLaborJobDeletingId(null)
      return false
    }
    await loadLaborJobs()
    setLaborJobDeletingId(null)
    return true
  }

  async function updateLaborJobDate(jobId: string, jobDate: string | null) {
    setError(null)
    const { error: err } = await supabase.from('people_labor_jobs').update({ job_date: jobDate || null }).eq('id', jobId)
    if (err) setError(err.message)
    else {
      setLaborJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, job_date: jobDate } : j)))
    }
  }

  async function recordLaborJobPayment(jobId: string, amount: number, memo: string | null, paymentDate: string | null) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount, memo: memo?.trim() || null, sequence_order: nextOrder, payment_date: paymentDate?.trim() || null })
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function recordLaborJobBackcharge(jobId: string, amount: number, memo: string) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount: -Math.abs(amount), memo: memo.trim(), sequence_order: nextOrder })
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function deleteLaborJobPayment(paymentId: string) {
    setError(null)
    const { error: err } = await supabase.from('people_labor_job_payments').delete().eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  async function updateLaborJobPayment(
    paymentId: string,
    amount: number,
    memo: string | null,
    isBackcharge: boolean,
    paymentDate: string | null
  ) {
    setError(null)
    const amt = isBackcharge ? -Math.abs(amount) : Math.abs(amount)
    const { error: err } = await supabase
      .from('people_labor_job_payments')
      .update({ amount: amt, memo: memo?.trim() || null, payment_date: paymentDate?.trim() || null })
      .eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  return {
    laborJobs,
    setLaborJobs,
    laborJobNamesByHcp,
    laborJobsLoading,
    laborJobsLoadedOnce,
    laborJobDeletingId,
    loadLaborJobs,
    deleteLaborJob,
    updateLaborJobDate,
    recordLaborJobPayment,
    recordLaborJobBackcharge,
    deleteLaborJobPayment,
    updateLaborJobPayment,
  }
}
