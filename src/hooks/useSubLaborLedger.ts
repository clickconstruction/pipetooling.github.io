import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import type { LaborJob, LaborJobPayment, LaborJobPaymentEvent, SubPaymentExtras, SubSendingInput, SubSendingResult } from '../types/laborJob'
import { formatErrorMessage } from '../utils/errorHandling'
import { buildLaborJobNamesById } from '../lib/subLaborLedgerNames'
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
  const [laborJobNamesByJobId, setLaborJobNamesByJobId] = useState<Record<string, string>>({})
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
  /** v2.7235: each roster person's credit, the sum of their `sub_credit_entries`. Empty until that table exists. */
  const [subCreditByPersonId, setSubCreditByPersonId] = useState<Map<string, number>>(new Map())

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
        .select('id, assigned_to_name, address, job_number, job_ledger_id, labor_rate, job_date, created_at, distance_miles, invoice_link, project_id, step_id, stage, stage_changed_at, stage_changed_by, stage_source, stage_note, payable_after, pay_hold_reason, progress_pct, progress_at')
        .order('created_at', { ascending: false })
      if (withAnchors.error) {
        const legacy = await supabase
          .from('people_labor_jobs')
          .select('id, assigned_to_name, address, job_number, job_ledger_id, labor_rate, job_date, created_at, distance_miles, invoice_link')
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
      setLaborJobNamesByJobId({})
    } else if (jobs?.length) {
      const jobIds = jobs.map((j) => j.id)
      // v2.3065: job names by the sheet's link, not by number text.
      const linkedJobIds = [...new Set((jobs as LaborJob[]).map((j) => j.job_ledger_id ?? '').filter(Boolean))]
      const [itemsRes, paymentsRes, ledgerRes, assigneesRes, eventsRes] = await Promise.all([
        supabase
          .from('people_labor_job_items')
          .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
          .in('job_id', jobIds)
          .order('sequence_order', { ascending: true }),
        // v2.7176: `method` and `method_ref` come from migration 20261113180000. Until that is pushed the database
        // refuses their names, and a refused read here would draw every sheet as unpaid. So a refusal reads the row
        // as it was before the two columns: the payments still load, and only the method is missing.
        // v2.7235: `sending_id` comes from migration 20261114020000, and is asked for first by the same rule.
        // v2.7237: `checked_at` and `checked_by_name` come from 20261114030000, and lead the same chain.
        (async () => {
          const withCheck = await supabase
            .from('people_labor_job_payments')
            .select('id, job_id, amount, memo, created_at, payment_date, method, method_ref, sending_id, checked_at, checked_by_name' as 'id, job_id, amount, memo, created_at, payment_date')
            .in('job_id', jobIds)
            .order('sequence_order', { ascending: true })
          if (!withCheck.error) return withCheck
          const withSending = await supabase
            .from('people_labor_job_payments')
            .select('id, job_id, amount, memo, created_at, payment_date, method, method_ref, sending_id' as 'id, job_id, amount, memo, created_at, payment_date')
            .in('job_id', jobIds)
            .order('sequence_order', { ascending: true })
          if (!withSending.error) return withSending
          const withMethod = await supabase
            .from('people_labor_job_payments')
            .select('id, job_id, amount, memo, created_at, payment_date, method, method_ref' as 'id, job_id, amount, memo, created_at, payment_date')
            .in('job_id', jobIds)
            .order('sequence_order', { ascending: true })
          if (!withMethod.error) return withMethod
          return supabase.from('people_labor_job_payments').select('id, job_id, amount, memo, created_at, payment_date').in('job_id', jobIds).order('sequence_order', { ascending: true })
        })(),
        linkedJobIds.length > 0 ? supabase.from('jobs_ledger').select('id, job_name').in('id', linkedJobIds) : { data: [] },
        // Junction rows + each assignee's CURRENT roster name — keys the
        // Outstanding roll-up by person id (v2.1737). Fail-soft: an error or
        // an RLS-hidden people row degrades to the legacy name grouping.
        supabase
          .from('people_labor_job_assignees')
          .select('labor_job_id, person_id, people(name)')
          .in('labor_job_id', jobIds),
        // v2.3562: the trace — moves in or out and removals touching these sheets. Fail-soft:
        // before the migration lands the read errors and every sheet simply has no trace.
        supabase
          .from('people_labor_job_payment_events' as never)
          .select('id, kind, payment_id, from_job_id, to_job_id, amount, memo, payment_date, reason, actor_name, restored_event_id, created_at')
          .or(`from_job_id.in.(${jobIds.join(',')}),to_job_id.in.(${jobIds.join(',')})`)
          .order('created_at', { ascending: false }),
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
      const eventsByJob = new Map<string, LaborJobPaymentEvent[]>()
      for (const raw of ((eventsRes as { data: unknown[] | null }).data ?? []) as Array<Record<string, unknown>>) {
        const ev: LaborJobPaymentEvent = {
          id: String(raw.id),
          kind: raw.kind === 'moved' || raw.kind === 'restored' ? raw.kind : 'removed',
          payment_id: typeof raw.payment_id === 'string' ? raw.payment_id : null,
          from_job_id: typeof raw.from_job_id === 'string' ? raw.from_job_id : null,
          to_job_id: typeof raw.to_job_id === 'string' ? raw.to_job_id : null,
          amount: Number(raw.amount) || 0,
          memo: typeof raw.memo === 'string' ? raw.memo : null,
          payment_date: typeof raw.payment_date === 'string' ? raw.payment_date : null,
          reason: typeof raw.reason === 'string' ? raw.reason : null,
          actor_name: typeof raw.actor_name === 'string' ? raw.actor_name : null,
          restored_event_id: typeof raw.restored_event_id === 'string' ? raw.restored_event_id : null,
          created_at: String(raw.created_at ?? ''),
        }
        for (const sheetId of [ev.from_job_id, ev.to_job_id]) {
          if (!sheetId) continue
          if (!eventsByJob.has(sheetId)) eventsByJob.set(sheetId, [])
          eventsByJob.get(sheetId)!.push(ev)
        }
      }
      type PaymentRead = { job_id: string; id: string; amount: number; memo: string | null; created_at: string; payment_date: string | null; method?: string | null; method_ref?: string | null; sending_id?: string | null; checked_at?: string | null; checked_by_name?: string | null }
      const paymentRows = (paymentsData ?? []) as unknown as PaymentRead[]
      // v2.7235: each sending's number and each person's credit. Both tables come from migration 20261114020000,
      // so a refused read means it is not pushed yet: no numbers, no credit, and every payment still loads.
      const sendingIds = [...new Set(paymentRows.map((p) => p.sending_id ?? '').filter(Boolean))]
      const [sendingsRes, creditsRes] = await Promise.all([
        sendingIds.length > 0 ? supabase.from('sub_payment_sendings' as never).select('id, number').in('id', sendingIds) : Promise.resolve({ data: [] as unknown[], error: null }),
        supabase.from('sub_credit_entries' as never).select('person_id, amount, payment_id'),
      ])
      const sendingNoById = new Map<string, number>()
      for (const r of ((sendingsRes as { data: unknown[] | null }).data ?? []) as Array<{ id: string; number: number | string }>) sendingNoById.set(r.id, Number(r.number))
      const creditKeptByPayment = new Map<string, number>()
      const creditByPerson = new Map<string, number>()
      for (const r of ((creditsRes as { data: unknown[] | null }).data ?? []) as Array<{ person_id: string; amount: number | string; payment_id: string | null }>) {
        const amount = Number(r.amount) || 0
        creditByPerson.set(r.person_id, Math.round(((creditByPerson.get(r.person_id) ?? 0) + amount) * 100) / 100)
        if (amount > 0 && r.payment_id) creditKeptByPayment.set(r.payment_id, amount)
      }
      setSubCreditByPersonId(creditByPerson)
      const paymentsByJob = new Map<string, LaborJobPayment[]>()
      for (const p of paymentRows) {
        if (!paymentsByJob.has(p.job_id)) paymentsByJob.set(p.job_id, [])
        paymentsByJob.get(p.job_id)!.push({
          id: p.id,
          amount: Number(p.amount),
          memo: p.memo,
          created_at: p.created_at,
          payment_date: p.payment_date,
          method: p.method ?? null,
          method_ref: p.method_ref ?? null,
          sending_id: p.sending_id ?? null,
          sending_no: p.sending_id ? (sendingNoById.get(p.sending_id) ?? null) : null,
          credit_kept: creditKeptByPayment.get(p.id) ?? null,
          checked_at: p.checked_at ?? null,
          checked_by_name: p.checked_by_name ?? null,
        })
      }
      setLaborJobNamesByJobId(buildLaborJobNamesById((ledgerJobs ?? []) as Array<{ id: string; job_name: string | null }>))
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
        payment_events: eventsByJob.get(j.id) ?? [],
        project_name: j.project_id ? projectNamesById.get(j.project_id) ?? null : null,
        stage_changed_by_name: j.stage_changed_by ? moverNamesById.get(j.stage_changed_by) ?? null : null,
      }))
      setLaborJobs(mappedJobs)
      onLaborJobsReloaded?.(mappedJobs)
    } else {
      setLaborJobs([])
      setLaborJobNamesByJobId({})
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

  async function recordLaborJobPayment(jobId: string, amount: number, memo: string | null, paymentDate: string | null, extras: SubPaymentExtras = {}) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    // v2.7176: how it was sent rides the row. The two columns are named only when a method was picked, so a payment
    // with none is the insert it always was.
    const row = {
      job_id: jobId,
      amount,
      memo: memo?.trim() || null,
      sequence_order: nextOrder,
      payment_date: paymentDate?.trim() || null,
      ...(extras.hidden_from_sub ? { hidden_from_sub: true } : {}),
      ...(extras.method ? { method: extras.method, method_ref: extras.method_ref?.trim() || null } : {}),
    }
    const { error: err } = await supabase.from('people_labor_job_payments').insert(row as never)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  /** v2.7237: a back-charge takes the day it was raised (`paymentDate`), so the ledger files it under that day and not the day it was typed. */
  async function recordLaborJobBackcharge(jobId: string, amount: number, memo: string, paymentDate?: string | null) {
    setError(null)
    const { data: existing } = await supabase.from('people_labor_job_payments').select('sequence_order').eq('job_id', jobId).order('sequence_order', { ascending: false }).limit(1)
    const nextOrder = existing?.length ? (Number((existing[0] as { sequence_order: number }).sequence_order) + 1) : 0
    const { error: err } = await supabase.from('people_labor_job_payments').insert({ job_id: jobId, amount: -Math.abs(amount), memo: memo.trim(), sequence_order: nextOrder, ...(paymentDate?.trim() ? { payment_date: paymentDate.trim() } : {}) })
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
    paymentDate: string | null,
    /** v2.7176: present when the Edit window drew the method chips; absent leaves the row's method as it is. */
    extras?: SubPaymentExtras
  ) {
    setError(null)
    const amt = isBackcharge ? -Math.abs(amount) : Math.abs(amount)
    const patch = {
      amount: amt,
      memo: memo?.trim() || null,
      payment_date: paymentDate?.trim() || null,
      ...(extras && 'method' in extras ? { method: extras.method || null, method_ref: extras.method ? extras.method_ref?.trim() || null : null } : {}),
    }
    const { error: err } = await supabase
      .from('people_labor_job_payments')
      .update(patch as never)
      .eq('id', paymentId)
    if (err) setError(err.message)
    else await loadLaborJobs()
  }

  /** v2.3562: re-point a payment to another sheet in one RPC; both sheets get the trace. */
  async function moveLaborJobPayment(paymentId: string, toJobId: string, reason: string | null): Promise<boolean> {
    setError(null)
    const { error: err } = await supabase.rpc('move_labor_job_payment' as never, { p_payment_id: paymentId, p_to_job_id: toJobId, p_reason: reason } as never)
    if (err) {
      setError(err.message)
      return false
    }
    await loadLaborJobs()
    return true
  }

  /** v2.3562: remove with a reason; the row is deleted and its snapshot kept for a 30-day Undo. */
  async function removeLaborJobPayment(paymentId: string, reason: string | null): Promise<boolean> {
    setError(null)
    const { error: err } = await supabase.rpc('remove_labor_job_payment' as never, { p_payment_id: paymentId, p_reason: reason } as never)
    if (err) {
      setError(err.message)
      return false
    }
    await loadLaborJobs()
    return true
  }

  /** v2.3562: undo a removal — the snapshot comes back as a new row on the sheet it left. */
  async function restoreLaborJobPayment(eventId: string): Promise<boolean> {
    setError(null)
    const { error: err } = await supabase.rpc('restore_labor_job_payment' as never, { p_event_id: eventId } as never)
    if (err) {
      setError(err.message)
      return false
    }
    await loadLaborJobs()
    return true
  }

  /** A write that leans on migration 20261114020000: PostgREST answers PGRST202 for a function it does not have yet. */
  const sendingRefusal = (err: { code?: string; message?: string }): SubSendingResult => ({ ok: false, missing: err.code === 'PGRST202', message: formatErrorMessage(err, 'That could not be saved.') })

  /**
   * v2.7235: record one sending. A payment row per sheet, all under one number that is never reused, and whatever
   * was sent past those sheets kept as the person's credit, in one statement (`record_sub_sending`).
   */
  async function recordSubSending(input: SubSendingInput): Promise<SubSendingResult> {
    setError(null)
    const { error: err } = await supabase.rpc('record_sub_sending' as never, {
      p_person_id: input.personId,
      p_lines: input.lines.map((l) => ({ job_id: l.jobId, amount: l.amount })),
      p_credit: input.credit,
      p_payment_date: input.paymentDate?.trim() || null,
      p_method: input.method,
      p_method_ref: input.methodRef?.trim() || null,
      p_memo: input.memo?.trim() || null,
      p_hidden_from_sub: input.hiddenFromSub,
    } as never)
    if (err) return sendingRefusal(err)
    await loadLaborJobs()
    return { ok: true }
  }

  /** v2.7235: pay a sheet from a person's credit. No money leaves: the row's method is `credit` (`apply_sub_credit`). */
  async function applySubCredit(personId: string, jobId: string, amount: number, paymentDate: string | null): Promise<SubSendingResult> {
    setError(null)
    const { error: err } = await supabase.rpc('apply_sub_credit' as never, { p_person_id: personId, p_job_id: jobId, p_amount: amount, p_payment_date: paymentDate?.trim() || null, p_memo: null } as never)
    if (err) return sendingRefusal(err)
    await loadLaborJobs()
    return { ok: true }
  }

  /**
   * v2.7237: tick or clear a payment against the bank (`set_sub_payment_checked`). Every row of the same sending
   * goes with it, since one check is one line at the bank. The rows are marked here at once, so ticking down a
   * list does not wait on a reload, and a refusal reads the truth back.
   */
  async function setSubPaymentChecked(paymentId: string, checked: boolean): Promise<SubSendingResult> {
    setError(null)
    let sendingId: string | null = null
    for (const j of laborJobs) for (const p of j.payments ?? []) if (p.id === paymentId) sendingId = p.sending_id ?? null
    const at = checked ? new Date().toISOString() : null
    const who = checked ? (authUserName ?? null) : null
    setLaborJobs((prev) =>
      prev.map((j) => {
        const hit = (j.payments ?? []).some((p) => p.id === paymentId || (sendingId && p.sending_id === sendingId))
        if (!hit) return j
        return { ...j, payments: (j.payments ?? []).map((p) => ((p.id === paymentId || (sendingId && p.sending_id === sendingId)) && Number(p.amount) > 0 && p.method !== 'credit' ? { ...p, checked_at: at, checked_by_name: who } : p)) }
      }),
    )
    const { error: err } = await supabase.rpc('set_sub_payment_checked' as never, { p_payment_id: paymentId, p_checked: checked } as never)
    if (!err) return { ok: true }
    await loadLaborJobs()
    return sendingRefusal(err)
  }

  return {
    subCreditByPersonId,
    recordSubSending,
    applySubCredit,
    setSubPaymentChecked,
    laborJobs,
    setLaborJobs,
    laborJobNamesByJobId,
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
    moveLaborJobPayment,
    removeLaborJobPayment,
    restoreLaborJobPayment,
  }
}
