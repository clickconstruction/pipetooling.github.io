import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import { getAccessTokenForEdgeFunctions } from '../lib/supabaseAccessTokenForEdge'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invoiceNeedsStripeVoidForRevert,
  invokeVoidStripeInvoiceForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../lib/voidStripeInvoiceForRevert'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'
import {
  shouldResyncJobsAfterUpdateJobStatusFailure,
  toastForUpdateJobStatusFailure,
} from '../lib/updateJobStatusClientFeedback'
import {
  buildReadyToBillDashboardUnits,
  resolveReadyToBillBillCustomerTarget,
} from '../lib/buildReadyToBillDashboardUnits'
import { wouldEnsureNothingLeftToBillForJob } from '../lib/wouldEnsureNothingLeftToBillForJob'
import {
  DASHBOARD_INVOICES_JOBS_LEDGER_SELECT,
  buildBilledWaitingDashboardUnits,
  buildPaymentsByInvoiceIdMap,
  isDashboardBillingInvoicesRole,
  mapJoinedInvoiceToDashboard,
  type DashboardInvoiceJoinRow,
  type InvoiceForDashboard,
  type JobForDashboard,
  type JobsLedgerPaymentRow,
  type ReadyToBillDashboardUnit,
} from '../lib/dashboardBillingInvoiceUnits'
import { releaseMutationLock, tryAcquireMutationLock } from '../lib/mutationLockSet'
import {
  isDashboardTeamReadyToBillRole,
  type DashboardTeamAssignedJobRow,
} from '../lib/dashboardTeamAssignedJobRow'
import type { DetailJobModalAssignedJobRow } from '../components/jobs/DetailJobModal'
import type { UserRole } from './useAuth'

export type UseDashboardBillingInvoicesInput = {
  authUserId: string | undefined
  role: UserRole | null
  /**
   * From `useDashboardAssignedJobs` — `updateJobStatus` optimistically prunes
   * and then reloads the three parent-owned job lists inline.
   */
  setAssignedJobs: Dispatch<SetStateAction<DashboardTeamAssignedJobRow[]>>
  setAssignedReadyToBillJobs: Dispatch<SetStateAction<DashboardTeamAssignedJobRow[]>>
  setSuperintendentJobs: Dispatch<SetStateAction<DashboardTeamAssignedJobRow[]>>
  /**
   * Declared by `useDashboardAssignedJobs`; its `.current` is assigned HERE, in
   * this hook's body during render (quirk #10 in
   * DASHBOARD_SECTIONS_ARCHITECTURE.md — preserved, do not convert to an
   * effect): the resync closure calls this engine's `refreshInvoices` before
   * reloading the three job lists.
   */
  resyncDashboardAfterUpdateJobStatusFailureRef: MutableRefObject<() => Promise<void>>
}

/**
 * Dashboard billing-invoices engine seam (extraction-series refactor; no
 * behavior change — MONEY PATH, moved verbatim). Owns the Ready to Bill /
 * Billed Waiting for Payment invoice+job lists and their loaders,
 * `refreshInvoices` (+ the `refreshInvoicesRef` render-body assignment,
 * quirk #10), the `update_job_status` mutation (+ Stripe prep variant), the
 * send-back revert/delete mutations with their mutation-lock refs, and the
 * derived display units. Modal state (`sendBack*`, `markPaid*`,
 * `sendRecordJobMeta`, `readyForBillingJob`) and the context glue that opens
 * app-level modals stay in the parent (`Dashboard.tsx`).
 */
export function useDashboardBillingInvoices({
  authUserId,
  role,
  setAssignedJobs,
  setAssignedReadyToBillJobs,
  setSuperintendentJobs,
  resyncDashboardAfterUpdateJobStatusFailureRef,
}: UseDashboardBillingInvoicesInput) {
  const { showToast } = useToastContext()
  const [readyToBillInvoices, setReadyToBillInvoices] = useState<InvoiceForDashboard[]>([])
  const [readyToBillJobs, setReadyToBillJobs] = useState<JobForDashboard[]>([])
  const [readyToBillLoading, setReadyToBillLoading] = useState(false)
  const readyToBillDashboardUnits = useMemo<ReadyToBillDashboardUnit[]>(
    () => buildReadyToBillDashboardUnits(readyToBillJobs, readyToBillInvoices),
    [readyToBillJobs, readyToBillInvoices],
  )
  const [waitingForPaymentInvoices, setWaitingForPaymentInvoices] = useState<InvoiceForDashboard[]>([])
  const [waitingForPaymentJobs, setWaitingForPaymentJobs] = useState<JobForDashboard[]>([])
  const [waitingForPaymentLoading, setWaitingForPaymentLoading] = useState(false)
  const billedWaitingDashboardUnits = useMemo(
    () => buildBilledWaitingDashboardUnits(waitingForPaymentJobs, waitingForPaymentInvoices),
    [waitingForPaymentJobs, waitingForPaymentInvoices],
  )
  const fieldQueueCombinedBillInvoices = useMemo(
    () => [...readyToBillInvoices, ...waitingForPaymentInvoices],
    [readyToBillInvoices, waitingForPaymentInvoices],
  )
  const shouldShowPrepareBillForFieldQueue = useCallback(
    (jobId: string) => {
      const resolved = resolveReadyToBillBillCustomerTarget(jobId, readyToBillDashboardUnits)
      if (resolved.mode !== 'job') return true
      const job = readyToBillJobs.find((j) => j.id === jobId) ?? null
      if (wouldEnsureNothingLeftToBillForJob(jobId, job, fieldQueueCombinedBillInvoices)) {
        return false
      }
      return true
    },
    [readyToBillDashboardUnits, readyToBillJobs, fieldQueueCombinedBillInvoices],
  )
  const [invoiceStatusUpdatingId, setInvoiceStatusUpdatingId] = useState<string | null>(null)
  const [jobStatusUpdatingId, setJobStatusUpdatingId] = useState<string | null>(null)
  // Per-id lock Sets (v2.732): the old single-slot `string | null` refs only
  // guarded same-id double-clicks — a mutation on a different id overwrote the
  // slot and broke the first mutation's finally-cleanup. Same-id guard
  // semantics are unchanged; different ids now lock independently.
  const dashboardInvoiceMutationLocksRef = useRef<Set<string>>(new Set())
  const dashboardJobStatusMutationLocksRef = useRef<Set<string>>(new Set())
  const dashboardInvoiceSendBackConfirmLockRef = useRef(false)

  const readyToBillDetailModalAssignedRows = useMemo((): DetailJobModalAssignedJobRow[] => {
    return readyToBillJobs.map((j) => ({
      id: j.id,
      hcp_number: j.hcp_number ?? '',
      job_name: j.job_name ?? '',
      job_address: j.job_address ?? '',
      google_drive_link: j.google_drive_link,
      job_plans_link: j.job_plans_link,
      revenue: j.revenue != null ? Number(j.revenue) : null,
      project_id: null,
    }))
  }, [readyToBillJobs])

  useEffect(() => {
    if (!authUserId || !isDashboardBillingInvoicesRole(role)) {
      // Keep state truthful when the user/role becomes ineligible (sign-out,
      // role change): clear the lists instead of leaving stale rows that only
      // the render gates hide (issue 6 of the billing bug-review pass).
      setReadyToBillInvoices([])
      setReadyToBillJobs([])
      setReadyToBillLoading(false)
      return
    }
    let cancelled = false
    setReadyToBillLoading(true)
    Promise.all([
      supabase
        .from('jobs_ledger_invoices')
        .select(DASHBOARD_INVOICES_JOBS_LEDGER_SELECT)
        .eq('status', 'ready_to_bill')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_jobs_ledger_by_status', { p_status: 'ready_to_bill' }),
    ]).then(([invRes, jobRes]) => {
      if (cancelled) return
      setReadyToBillLoading(false)
      if (!invRes.error) {
        const rows = (invRes.data ?? []) as DashboardInvoiceJoinRow[]
        const emptyPay = new Map<string, JobsLedgerPaymentRow[]>()
        setReadyToBillInvoices(rows.map((r) => mapJoinedInvoiceToDashboard(r, emptyPay)))
      }
      if (!jobRes.error) {
        setReadyToBillJobs((jobRes.data ?? []) as JobForDashboard[])
      }
    })
    return () => {
      cancelled = true
    }
  }, [authUserId, role])

  useEffect(() => {
    if (!authUserId || !isDashboardBillingInvoicesRole(role)) {
      setWaitingForPaymentInvoices([])
      setWaitingForPaymentJobs([])
      setWaitingForPaymentLoading(false)
      return
    }
    let cancelled = false
    setWaitingForPaymentLoading(true)
    Promise.all([
      supabase
        .from('jobs_ledger_invoices')
        .select(DASHBOARD_INVOICES_JOBS_LEDGER_SELECT)
        .eq('status', 'billed')
        .order('created_at', { ascending: false }),
      supabase.rpc('get_jobs_ledger_by_status', { p_status: 'billed' }),
    ]).then(async ([invRes, jobRes]) => {
      if (cancelled) return
      setWaitingForPaymentLoading(false)
      const jobs = (jobRes.data ?? []) as JobForDashboard[]
      if (!jobRes.error) {
        setWaitingForPaymentJobs(jobs)
      }
      if (invRes.error) return
      const rows = (invRes.data ?? []) as DashboardInvoiceJoinRow[]
      const jobIds = new Set<string>()
      for (const r of rows) jobIds.add(r.job_id)
      for (const j of jobs) jobIds.add(j.id)
      let payMap = new Map<string, JobsLedgerPaymentRow[]>()
      if (jobIds.size > 0) {
        const { data: payData } = await supabase.from('jobs_ledger_payments').select('*').in('job_id', [...jobIds])
        payMap = buildPaymentsByInvoiceIdMap((payData ?? []) as JobsLedgerPaymentRow[])
      }
      if (cancelled) return
      setWaitingForPaymentInvoices(rows.map((r) => mapJoinedInvoiceToDashboard(r, payMap)))
    })
    return () => {
      cancelled = true
    }
  }, [authUserId, role])

  async function updateJobStatus(jobId: string, toStatus: 'working' | 'ready_to_bill' | 'billed' | 'paid'): Promise<boolean> {
    if (!tryAcquireMutationLock(dashboardJobStatusMutationLocksRef.current, jobId)) return false
    setJobStatusUpdatingId(jobId)
    try {
      const { data, error } = await supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })
      if (error) {
        const { text, variant } = toastForUpdateJobStatusFailure(error.message)
        showToast?.(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(error.message)) {
          void resyncDashboardAfterUpdateJobStatusFailureRef.current()
        }
        return false
      }
      const result = data as { error?: string } | null
      if (result?.error) {
        const { text, variant } = toastForUpdateJobStatusFailure(result.error)
        showToast?.(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(result.error)) {
          void resyncDashboardAfterUpdateJobStatusFailureRef.current()
        }
        return false
      }
      showToast?.('Status updated', 'success')
      setAssignedJobs((prev) => prev.filter((j) => j.id !== jobId))
      setAssignedReadyToBillJobs((prev) => prev.filter((j) => j.id !== jobId))
      setSuperintendentJobs((prev) => prev.filter((j) => j.id !== jobId))
      // Runs concurrently with the job-list reloads below, but its completion is
      // part of the returned promise (awaited before `return true`) so callers
      // never observe stale invoice state after awaiting updateJobStatus.
      const invoicesRefreshed = refreshInvoices()
      const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
      if (assignedData) setAssignedJobs(assignedData as unknown as DashboardTeamAssignedJobRow[])
      if (isDashboardTeamReadyToBillRole(role)) {
        const { data: rtbAssignedData } = await supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard')
        if (rtbAssignedData) setAssignedReadyToBillJobs(rtbAssignedData as unknown as DashboardTeamAssignedJobRow[])
      }
      if (role === 'superintendent') {
        const { data: superintendentData } = await supabase.rpc('list_superintendent_jobs_for_dashboard')
        if (superintendentData) setSuperintendentJobs(superintendentData as unknown as DashboardTeamAssignedJobRow[])
      }
      await invoicesRefreshed
      return true
    } finally {
      setJobStatusUpdatingId(null)
      releaseMutationLock(dashboardJobStatusMutationLocksRef.current, jobId)
    }
  }

  async function moveJobToReadyToBillWithStripePrep(jobId: string): Promise<boolean> {
    const token = await getAccessTokenForEdgeFunctions()
    if (!token) {
      showToast?.('Not signed in', 'error')
      return false
    }
    const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
      jobId,
      authRole: role,
      accessToken: token,
    })
    if (!prep.ok) {
      showToast?.(prep.message, 'error')
      return false
    }
    return updateJobStatus(jobId, 'ready_to_bill')
  }

  async function refreshInvoices() {
    if (!isDashboardBillingInvoicesRole(role)) return
    const emptyPay = new Map<string, JobsLedgerPaymentRow[]>()
    const fetchInvoiceRows = async (status: string) => {
      const { data } = await supabase
        .from('jobs_ledger_invoices')
        .select(DASHBOARD_INVOICES_JOBS_LEDGER_SELECT)
        .eq('status', status)
        .order('created_at', { ascending: false })
      return (data ?? []) as DashboardInvoiceJoinRow[]
    }
    const fetchJobs = async (status: string) => {
      const { data } = await supabase.rpc('get_jobs_ledger_by_status', { p_status: status })
      return (data ?? []) as JobForDashboard[]
    }
    const [readyRows, billedRows, readyJobs, billedJobs] = await Promise.all([
      fetchInvoiceRows('ready_to_bill'),
      fetchInvoiceRows('billed'),
      fetchJobs('ready_to_bill'),
      fetchJobs('billed'),
    ])
    setReadyToBillInvoices(readyRows.map((r) => mapJoinedInvoiceToDashboard(r, emptyPay)))
    const jobIds = new Set<string>()
    for (const r of billedRows) jobIds.add(r.job_id)
    for (const j of billedJobs) jobIds.add(j.id)
    let payMap = emptyPay
    if (jobIds.size > 0) {
      const { data: payData } = await supabase.from('jobs_ledger_payments').select('*').in('job_id', [...jobIds])
      payMap = buildPaymentsByInvoiceIdMap((payData ?? []) as JobsLedgerPaymentRow[])
    }
    setWaitingForPaymentInvoices(billedRows.map((r) => mapJoinedInvoiceToDashboard(r, payMap)))
    setReadyToBillJobs(readyJobs)
    setWaitingForPaymentJobs(billedJobs)
  }

  resyncDashboardAfterUpdateJobStatusFailureRef.current = async () => {
    await refreshInvoices()
    const { data: assignedData } = await supabase.rpc('list_assigned_jobs_for_dashboard')
    if (assignedData) setAssignedJobs(assignedData as unknown as DashboardTeamAssignedJobRow[])
    if (isDashboardTeamReadyToBillRole(role)) {
      const { data: rtbAssignedData } = await supabase.rpc('list_ready_to_bill_assigned_jobs_for_dashboard')
      if (rtbAssignedData) setAssignedReadyToBillJobs(rtbAssignedData as unknown as DashboardTeamAssignedJobRow[])
    }
    if (role === 'superintendent') {
      const { data: superintendentData } = await supabase.rpc('list_superintendent_jobs_for_dashboard')
      if (superintendentData) setSuperintendentJobs(superintendentData as unknown as DashboardTeamAssignedJobRow[])
    }
  }

  // `refreshInvoicesRef` (the render-assigned ref other surfaces call) stays
  // in the PARENT: all of its consumers (edit-job/detail-modal onSaved, the
  // sendRecordJobMeta effect, CreateTripChargeModal.onCreated) live there, and
  // a parent-local useRef keeps its render-body assignment verbatim (quirk
  // #10). The parent assigns it from this hook's `refreshInvoices`.

  async function revertBilledDashboardInvoiceToReadyToBill(inv: InvoiceForDashboard): Promise<boolean> {
    if (!invoiceNeedsStripeVoidForRevert(inv)) {
      if (!tryAcquireMutationLock(dashboardInvoiceMutationLocksRef.current, inv.id)) return false
      setInvoiceStatusUpdatingId(inv.id)
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: inv.id }),
          'delete_billed_invoice_on_send_back',
        )
        const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
        if (!result?.ok) {
          showToast?.(result?.error ?? 'Failed to send back invoice', 'error')
          return false
        }
        const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
        if (!sync.ok) {
          showToast?.(sync.message, 'error')
          return false
        }
        showToast?.('Invoice sent back', 'success')
        await refreshInvoices()
        return true
      } catch (e) {
        showToast?.(e instanceof Error ? e.message : 'Failed to send back invoice', 'error')
        return false
      } finally {
        setInvoiceStatusUpdatingId(null)
        releaseMutationLock(dashboardInvoiceMutationLocksRef.current, inv.id)
      }
    }
    if (!tryAcquireMutationLock(dashboardInvoiceMutationLocksRef.current, inv.id)) return false
    setInvoiceStatusUpdatingId(inv.id)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        showToast?.('Not signed in', 'error')
        return false
      }
      const r = await invokeVoidStripeInvoiceForRevert({
        invoiceId: inv.id,
        stripeModeForBilling: stripeModeForBillingFromRole(role),
        accessToken: token,
      })
      if (!r.ok) {
        showToast?.(r.message, 'error')
        return false
      }
      const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
      if (!cleaned.ok) {
        showToast?.(cleaned.message, 'error')
        return false
      }
      const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
      if (!sync.ok) {
        showToast?.(sync.message, 'error')
        return false
      }
      showToast?.('Invoice sent back', 'success')
      await refreshInvoices()
      return true
    } finally {
      setInvoiceStatusUpdatingId(null)
      releaseMutationLock(dashboardInvoiceMutationLocksRef.current, inv.id)
    }
  }

  async function deleteInvoice(invoiceId: string) {
    if (!tryAcquireMutationLock(dashboardInvoiceMutationLocksRef.current, invoiceId)) return
    setInvoiceStatusUpdatingId(invoiceId)
    try {
      const data = await withSupabaseRetry(
        async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: invoiceId }),
        'delete_ready_to_bill_invoice',
      )
      const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
      if (!result?.ok) {
        showToast?.(result?.error ?? 'Failed to remove invoice', 'error')
        return
      }
      if (result.deleted === true) {
        showToast?.('Invoice removed', 'success')
      }
      await refreshInvoices()
    } catch (e) {
      showToast?.(e instanceof Error ? e.message : 'Failed to remove invoice', 'error')
    } finally {
      setInvoiceStatusUpdatingId(null)
      releaseMutationLock(dashboardInvoiceMutationLocksRef.current, invoiceId)
    }
  }

  return {
    readyToBillInvoices,
    readyToBillJobs,
    readyToBillLoading,
    readyToBillDashboardUnits,
    waitingForPaymentInvoices,
    waitingForPaymentJobs,
    waitingForPaymentLoading,
    billedWaitingDashboardUnits,
    fieldQueueCombinedBillInvoices,
    shouldShowPrepareBillForFieldQueue,
    invoiceStatusUpdatingId,
    jobStatusUpdatingId,
    dashboardInvoiceSendBackConfirmLockRef,
    readyToBillDetailModalAssignedRows,
    updateJobStatus,
    moveJobToReadyToBillWithStripePrep,
    refreshInvoices,
    revertBilledDashboardInvoiceToReadyToBill,
    deleteInvoice,
  }
}
