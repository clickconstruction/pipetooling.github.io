import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import type { LaborJob, LaborJobPayment } from '../types/laborJob'
import { buildLaborJobNamesByNumber } from '../lib/subLaborLedgerNames'
import type { SubLaborSheetAssignee } from '../lib/subLaborOutstanding'
import type { SubSheetStage } from '../lib/subSheetStage'
import type { SetSubSheetStageResult } from '../types/database-functions'

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
  authUserName,
  setError,
  onLaborJobsReloaded,
}: {
  authUserId: string | undefined
  /** Stamped onto a locally patched row after a stage move (display only). */
  authUserName?: string | null
  /** Page-global error (Jobs map quirk #7 — one error state shared across tabs). */
  setError: (msg: string | null) => void
  /** Called with the freshly mapped list after each successful reload (the page syncs its open Edit Sub Labor modal). */
  onLaborJobsReloaded?: (jobs: LaborJob[]) => void
}) {
  const confirmDialog = useConfirmDialog()
  const [laborJobs, setLaborJobs] = useState<LaborJob[]>([])
  const [laborJobNamesByHcp, setLaborJobNamesByHcp] = useState<Record<string, string>>({})
  const [laborJobAssigneesByJobId, setLaborJobAssigneesByJobId] = useState<Map<string, SubLaborSheetAssignee[]>>(new Map())
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
    // Full select first (anchors + the v2.2767 stage columns); fall back to
    // the legacy column list if a migration isn't applied yet, so client and
    // migration deploy in either order.
    let jobs: LaborJob[] | null = null
    let jobsErr: { message: string } | null = null
    {
      const withAnchors = await supabase
        .from('people_labor_jobs')
        .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at, distance_miles, invoice_link, project_id, step_id, stage, stage_changed_at, stage_changed_by, stage_source, stage_note, payable_after, pay_hold_reason')
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
      const [itemsRes, paymentsRes, ledgerRes, assigneesRes] = await Promise.all([
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
        // Junction rows + each assignee's CURRENT roster name — keys the
        // Outstanding roll-up by person id (v2.1737). Fail-soft: an error or
        // an RLS-hidden people row degrades to the legacy name grouping.
        supabase
          .from('people_labor_job_assignees')
          .select('labor_job_id, person_id, people(name)')
          .in('labor_job_id', jobIds),
      ])
      const { data: items } = itemsRes
      const { data: paymentsData } = paymentsRes
      const { data: ledgerJobs } = ledgerRes
      const assigneesMap = new Map<string, SubLaborSheetAssignee[]>()
      for (const a of (assigneesRes.data ?? []) as unknown as Array<{ labor_job_id: string; person_id: string; people: { name: string | null } | null }>) {
        if (!assigneesMap.has(a.labor_job_id)) assigneesMap.set(a.labor_job_id, [])
        assigneesMap.get(a.labor_job_id)!.push({ personId: a.person_id, personName: a.people?.name ?? null })
      }
      setLaborJobAssigneesByJobId(assigneesMap)
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
      // Key click-only jobs too — the RPC resolves them (empty hcp, matching
      // click_number) but keying hcp_number alone dropped their names.
      setLaborJobNamesByHcp(
        buildLaborJobNamesByNumber(
          (ledgerJobs ?? []) as Array<{ hcp_number: string; click_number?: string | null; job_name: string }>,
        ),
      )
      // Resolve project names for anchored sheets (display only, fail-soft).
      const projectIds = [...new Set((jobs as LaborJob[]).map((j) => j.project_id).filter((id): id is string => !!id))]
      const projectNamesById = new Map<string, string>()
      if (projectIds.length > 0) {
        const { data: projectRows } = await supabase.from('projects').select('id, name').in('id', projectIds)
        for (const p of (projectRows ?? []) as Array<{ id: string; name: string }>) {
          projectNamesById.set(p.id, p.name)
        }
      }
      // Who moved each sheet's stage last (v2.2767) — office moves only; fail-soft.
      const moverIds = [...new Set((jobs as LaborJob[]).map((j) => j.stage_changed_by).filter((id): id is string => !!id))]
      const moverNamesById = new Map<string, string>()
      if (moverIds.length > 0) {
        const { data: moverRows } = await supabase.from('users').select('id, name').in('id', moverIds)
        for (const u of (moverRows ?? []) as Array<{ id: string; name: string | null }>) {
          if (u.name) moverNamesById.set(u.id, u.name)
        }
      }
      const mappedJobs = (jobs as LaborJob[]).map((j) => ({
        ...j,
        items: itemsByJob.get(j.id) ?? [],
        payments: paymentsByJob.get(j.id) ?? [],
        project_name: j.project_id ? projectNamesById.get(j.project_id) ?? null : null,
        stage_changed_by_name: j.stage_changed_by ? moverNamesById.get(j.stage_changed_by) ?? null : null,
      }))
      setLaborJobs(mappedJobs)
      onLaborJobsReloaded?.(mappedJobs)
    } else {
      setLaborJobs([])
      setLaborJobNamesByHcp({})
      setLaborJobAssigneesByJobId(new Map())
    }
    setLaborJobsLoading(false)
    setLaborJobsLoadedOnce(true)
  }

  async function deleteLaborJob(id: string): Promise<boolean> {
    if (!(await confirmDialog({ message: 'Delete this job from the sub sheet ledger?', confirmLabel: 'Delete', danger: true }))) return false
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

  /**
   * Move a sheet's stage (v2.2767) through the office-gated RPC and patch
   * the row locally — the trigger posts the Activity line server-side.
   */
  async function setLaborJobStage(jobId: string, stage: SubSheetStage) {
    setError(null)
    const { data, error: err } = await supabase.rpc('set_sub_sheet_stage' as never, { p_labor_job_id: jobId, p_stage: stage, p_note: null } as never)
    const res = (data ?? null) as SetSubSheetStageResult | null
    const msg = err?.message ?? res?.error
    if (msg) {
      setError(msg)
      return false
    }
    setLaborJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, stage, stage_changed_at: new Date().toISOString(), stage_changed_by: authUserId ?? null, stage_source: 'office', stage_note: null, stage_changed_by_name: authUserName ?? null }
          : j,
      ),
    )
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
    laborJobAssigneesByJobId,
    laborJobsLoading,
    laborJobsLoadedOnce,
    laborJobDeletingId,
    loadLaborJobs,
    deleteLaborJob,
    updateLaborJobDate,
    setLaborJobStage,
    recordLaborJobPayment,
    recordLaborJobBackcharge,
    deleteLaborJobPayment,
    updateLaborJobPayment,
  }
}
