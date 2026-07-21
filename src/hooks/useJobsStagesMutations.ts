import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { addDaysToDate } from '../lib/jobs/jobFormatting'
import { composePctCompleteNoteBody } from '../lib/jobs/stagesPctNote'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invoiceNeedsStripeVoidForRevert,
  invokeVoidStripeInvoiceForRevert,
  prepareBilledInvoicesBeforeJobRevertToReadyToBill,
  stripeModeForBillingFromRole,
} from '../lib/voidStripeInvoiceForRevert'
import { getAccessTokenForEdgeFunctions } from '../lib/supabaseAccessTokenForEdge'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'
import { runJobsStagesSerializedPipeline } from '../lib/jobsStagesSerializedPipeline'
import {
  shouldResyncJobsAfterUpdateJobStatusFailure,
  toastForUpdateJobStatusFailure,
} from '../lib/updateJobStatusClientFeedback'
import type { InvoiceWithJob } from '../lib/jobsStagesBoard'
import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages job-mutation engine (Jobs.tsx decomposition seam, step 7 — see
 * docs/JOBS_TABS_ARCHITECTURE.md "The job-mutation engine"). Owns the five core
 * status/invoice mutations (`updateJobStatus`, `moveJobToReadyToBillWithStripePrep`,
 * `revertBilledInvoiceToReadyToBill`, `deleteInvoice`, plus the inner
 * `executeUpdateJobStatus`), the movable row-level writes
 * (`setInvoiceEstimatedBillDate`/`bumpInvoiceEstimatedBillDate`,
 * `updateJobPctComplete`/`commitStagesPctWithNote`), their busy-id states
 * (`stagesStatusUpdatingId`, `stagesInvoiceUpdatingId`,
 * `invoiceEstimatedBillDateSavingId`, `pctCompleteSavingId`), and the invoice
 * mutation lock ref. Behavior-preserving extraction: the page destructures the
 * return so every downstream reference keeps its name.
 *
 * Quirk #12 (preserve): optimistic `setJobs` status patch + the injected 300 ms
 * debounced `scheduleLoadJobsAfterMutation` refetch — timings untouched.
 * Quirk #14 (preserve): the serial queue is module-level state in
 * `lib/jobsStagesSerializedPipeline.ts` and STAYS module-level (it must survive
 * re-renders and stay shared with `JobsCombineSeparateModal.onAfterSuccess`);
 * this hook just keeps calling `runJobsStagesSerializedPipeline`.
 * Quirk #17 (preserve): two % complete commit paths — `updateJobPctComplete`
 * (bare write) and `commitStagesPctWithNote` (thread note first) — share
 * `pctCompleteSavingId`.
 *
 * Stays in the page (UI-entangled; moves with the step-9 tab move):
 * `updateJobTeamMembers` (writes `assignedEdit*` UI state),
 * `createInvoiceFromModal` (reads `createPartialInvoice*` modal state + the
 * bill-customer context), and the collections confirm handler (writes
 * `collectionsConfirm`/`collectionsSaving`; the `setJobCollectionsFlag` lib
 * call is already extracted).
 */
export function useJobsStagesMutations({
  authRole,
  setError,
  showToast,
  setJobs,
  loadJobs,
  scheduleLoadJobsAfterMutation,
  followMovedJob,
  submitJobThreadNoteWithBody,
}: {
  /** Stripe billing mode source (`stripeModeForBillingFromRole`); the engine reads no other auth-derived value. */
  authRole: string | null
  /** Page-global error (Jobs map quirk #7 — one error state shared across tabs). */
  setError: (msg: string | null) => void
  showToast: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void
  /** Shared jobs-list cache setter (JobsListCacheContext) — optimistic status/est-date patches (quirk #12). */
  setJobs: Dispatch<SetStateAction<JobWithDetails[]>>
  loadJobs: () => Promise<unknown>
  /** The page's 300 ms debounced post-mutation refetch (quirk #12 — timings live in the page, untouched). */
  scheduleLoadJobsAfterMutation: () => void
  /** "Follow cards I move" — page closure over `stagesFollowMoves` + the section/focus/flash states. */
  followMovedJob: (jobId: string, toStatus: string) => void
  /** From the shared `useJobThreadNotes` engine — `commitStagesPctWithNote` posts its note through it (v2.757). */
  submitJobThreadNoteWithBody: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<void>
}) {
  const [stagesStatusUpdatingId, setStagesStatusUpdatingId] = useState<string | null>(null)
  const [stagesInvoiceUpdatingId, setStagesInvoiceUpdatingId] = useState<string | null>(null)
  const stagesInvoiceMutationLockRef = useRef<string | null>(null)
  const [invoiceEstimatedBillDateSavingId, setInvoiceEstimatedBillDateSavingId] = useState<string | null>(null)
  const [pctCompleteSavingId, setPctCompleteSavingId] = useState<string | null>(null)

  /** RPC + loadJobs; not queued — use via `updateJobStatus` or inside `moveJobToReadyToBillWithStripePrep`’s serialized block only. */
  async function executeUpdateJobStatus(
    jobId: string,
    toStatus: 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'paid',
  ): Promise<boolean> {
    setStagesStatusUpdatingId(jobId)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })
      if (err) {
        const { text, variant } = toastForUpdateJobStatusFailure(err.message)
        showToast(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(err.message)) void loadJobs()
        return false
      }
      const result = data as { error?: string } | null
      if (result?.error) {
        const { text, variant } = toastForUpdateJobStatusFailure(result.error)
        showToast(text, variant)
        if (shouldResyncJobsAfterUpdateJobStatusFailure(result.error)) void loadJobs()
        return false
      }
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: toStatus } : j)))
      followMovedJob(jobId, toStatus)
      scheduleLoadJobsAfterMutation()
      return true
    } finally {
      setStagesStatusUpdatingId(null)
    }
  }

  async function updateJobStatus(jobId: string, toStatus: 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'paid'): Promise<boolean> {
    return runJobsStagesSerializedPipeline(() => executeUpdateJobStatus(jobId, toStatus))
  }

  /** Void Stripe (or revert non-Stripe) on all billed lines, then move job to Ready to Bill. */
  async function moveJobToReadyToBillWithStripePrep(jobId: string): Promise<boolean> {
    return runJobsStagesSerializedPipeline(async () => {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        setError('Not signed in')
        return false
      }
      const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
        jobId,
        authRole,
        accessToken: token,
      })
      if (!prep.ok) {
        setError(prep.message)
        return false
      }
      return executeUpdateJobStatus(jobId, 'ready_to_bill')
    })
  }

  /** Send back from Billed: void Stripe when needed, else delete billed row (RPC). */
  async function revertBilledInvoiceToReadyToBill(inv: InvoiceWithJob): Promise<boolean> {
    return runJobsStagesSerializedPipeline(async () => {
      if (!invoiceNeedsStripeVoidForRevert(inv)) {
        if (stagesInvoiceMutationLockRef.current === inv.id) return false
        stagesInvoiceMutationLockRef.current = inv.id
        setStagesInvoiceUpdatingId(inv.id)
        setError(null)
        try {
          const data = await withSupabaseRetry(
            async () => await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: inv.id }),
            'delete_billed_invoice_on_send_back',
          )
          const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
          if (!result?.ok) {
            setError(result?.error ?? 'Failed to send back invoice')
            return false
          }
          const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
          if (!sync.ok) {
            setError(sync.message)
            return false
          }
          followMovedJob(inv.job_id, 'ready_to_bill')
          scheduleLoadJobsAfterMutation()
          return true
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : 'Failed to send back invoice')
          return false
        } finally {
          setStagesInvoiceUpdatingId(null)
          if (stagesInvoiceMutationLockRef.current === inv.id) {
            stagesInvoiceMutationLockRef.current = null
          }
        }
      }
      if (stagesInvoiceMutationLockRef.current === inv.id) return false
      stagesInvoiceMutationLockRef.current = inv.id
      setStagesInvoiceUpdatingId(inv.id)
      setError(null)
      try {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) {
          setError('Not signed in')
          return false
        }
        const r = await invokeVoidStripeInvoiceForRevert({
          invoiceId: inv.id,
          stripeModeForBilling: stripeModeForBillingFromRole(authRole),
          accessToken: token,
        })
        if (!r.ok) {
          setError(r.message)
          return false
        }
        const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
        if (!cleaned.ok) {
          setError(cleaned.message)
          return false
        }
        const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, inv.job_id)
        if (!sync.ok) {
          setError(sync.message)
          return false
        }
        followMovedJob(inv.job_id, 'ready_to_bill')
        scheduleLoadJobsAfterMutation()
        return true
      } finally {
        setStagesInvoiceUpdatingId(null)
        if (stagesInvoiceMutationLockRef.current === inv.id) {
          stagesInvoiceMutationLockRef.current = null
        }
      }
    })
  }

  async function deleteInvoice(invoiceId: string) {
    await runJobsStagesSerializedPipeline(async () => {
      if (stagesInvoiceMutationLockRef.current === invoiceId) return
      stagesInvoiceMutationLockRef.current = invoiceId
      setStagesInvoiceUpdatingId(invoiceId)
      setError(null)
      try {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: invoiceId }),
          'delete_ready_to_bill_invoice',
        )
        const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
      if (!result?.ok) {
        setError(result?.error ?? 'Failed to delete invoice')
        return
      }
      scheduleLoadJobsAfterMutation()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete invoice')
    } finally {
      setStagesInvoiceUpdatingId(null)
      if (stagesInvoiceMutationLockRef.current === invoiceId) {
        stagesInvoiceMutationLockRef.current = null
      }
    }
    })
  }

  async function updateJobPctComplete(jobId: string, value: number | null) {
    setPctCompleteSavingId(jobId)
    setError(null)
    try {
      const { error: err } = await supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update % complete')
    } finally {
      setPctCompleteSavingId(null)
    }
  }

  /**
   * Stages "Set % complete" commit: post a thread note ("N% complete — <note>",
   * best-effort with its own toast) then write jobs_ledger.pct_complete. One saving
   * flag spans both so the editor stays disabled and closes when it clears.
   */
  async function commitStagesPctWithNote(jobId: string, value: number, note: string) {
    setPctCompleteSavingId(jobId)
    setError(null)
    try {
      await submitJobThreadNoteWithBody(jobId, composePctCompleteNoteBody(value, note), 'draft')
      const { error: err } = await supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update % complete')
    } finally {
      setPctCompleteSavingId(null)
    }
  }

  async function setInvoiceEstimatedBillDate(invoiceId: string, jobId: string, date: string | null) {
    setInvoiceEstimatedBillDateSavingId(invoiceId)
    setError(null)
    try {
      await withSupabaseRetry(
        async () => {
          const r = await supabase
            .from('jobs_ledger_invoices')
            .update({ estimated_bill_date: date })
            .eq('id', invoiceId)
          return { data: r.data, error: r.error }
        },
        'update invoice estimated bill date'
      )
      setJobs((prev) =>
        prev.map((j) =>
          j.id !== jobId
            ? j
            : {
                ...j,
                invoices: (j.invoices ?? []).map((i) =>
                  i.id === invoiceId ? { ...i, estimated_bill_date: date } : i
                ),
              }
        )
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice bill date')
    } finally {
      setInvoiceEstimatedBillDateSavingId(null)
    }
  }

  /** Ham ±1: seed from invoice date, else job est. date, else today. */
  async function bumpInvoiceEstimatedBillDate(
    invoiceId: string,
    jobId: string,
    inv: JobsLedgerInvoice,
    job: JobWithDetails,
    deltaDays: number
  ) {
    const base =
      inv.estimated_bill_date ??
      job.last_bill_date ??
      new Date().toISOString().slice(0, 10)
    const newDate = addDaysToDate(base, deltaDays)
    await setInvoiceEstimatedBillDate(invoiceId, jobId, newDate)
  }

  return {
    stagesStatusUpdatingId,
    stagesInvoiceUpdatingId,
    stagesInvoiceMutationLockRef,
    updateJobStatus,
    moveJobToReadyToBillWithStripePrep,
    revertBilledInvoiceToReadyToBill,
    deleteInvoice,
    invoiceEstimatedBillDateSavingId,
    setInvoiceEstimatedBillDate,
    bumpInvoiceEstimatedBillDate,
    pctCompleteSavingId,
    updateJobPctComplete,
    commitStagesPctWithNote,
  }
}
