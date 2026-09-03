import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { OperationTimeoutError, withOperationTimeout, withSupabaseRetry } from '../utils/errorHandling'
import { addDaysToDate } from '../lib/jobs/jobFormatting'
import { composePctAutoNoteBody, composePctCompleteNoteBody } from '../lib/jobs/stagesPctNote'
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
import { todayYmdInAppTz } from '../utils/dateUtils'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Deadline for Stages mutation round-trips (status moves, % complete).
 * Retries only fire on failures — a frozen DB never settles the fetch, so
 * without this the row sticks on its busy state forever (v2.1063
 * schedule-save hang class). The request is NOT cancelled, so timeout
 * messages say "may or may not have saved".
 */
const STAGES_MUTATION_TIMEOUT_MS = 15000

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
  submitJobThreadNoteWithBody: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<boolean>
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
      const { data, error: err } = await withOperationTimeout(
        Promise.resolve(supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: toStatus })),
        STAGES_MUTATION_TIMEOUT_MS,
        'Move job',
      )
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
    } catch (e: unknown) {
      // Timeout: the request wasn't cancelled — it may still land when the
      // server recovers, so say so and let the board resync be the truth.
      if (!(e instanceof OperationTimeoutError)) throw e
      showToast(
        'The server is not responding. The move may or may not have saved — check the board before moving the job again.',
        'error',
      )
      void loadJobs()
      return false
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

  /**
   * Quick % input commit (Pipeline tables/cards "% done"). `previous` is the
   * row's current pct: unchanged blurs no-op (the input commits on EVERY blur),
   * and every real change also posts an auto thread note ("62% complete" /
   * "Cleared % complete — was 62%") so Job activity shows office edits too.
   * The note is best-effort — a notes hiccup must not block the pct save.
   */
  async function updateJobPctComplete(jobId: string, value: number | null, previous: number | null) {
    if (value === previous) return
    setPctCompleteSavingId(jobId)
    setError(null)
    try {
      try {
        await submitJobThreadNoteWithBody(jobId, composePctAutoNoteBody(value, previous), 'draft')
      } catch {
        // pct write proceeds; the thread realtime/merge paths self-heal stats.
      }
      const { error: err } = await withOperationTimeout(
        Promise.resolve(supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)),
        STAGES_MUTATION_TIMEOUT_MS,
        'Set % complete',
      )
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(
        err instanceof OperationTimeoutError
          ? 'The server is not responding. The % complete may or may not have saved — check the row before retrying.'
          : err instanceof Error
            ? err.message
            : 'Failed to update % complete',
      )
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
      const { error: err } = await withOperationTimeout(
        Promise.resolve(supabase.from('jobs_ledger').update({ pct_complete: value }).eq('id', jobId)),
        STAGES_MUTATION_TIMEOUT_MS,
        'Set % complete',
      )
      if (err) throw err
      await loadJobs()
    } catch (err: unknown) {
      setError(
        err instanceof OperationTimeoutError
          ? 'The server is not responding. The % complete may or may not have saved — check the row before retrying.'
          : err instanceof Error
            ? err.message
            : 'Failed to update % complete',
      )
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

  /** Ham ±1: seed from invoice date, else today. */
  async function bumpInvoiceEstimatedBillDate(
    invoiceId: string,
    jobId: string,
    inv: JobsLedgerInvoice,
    deltaDays: number
  ) {
    const base =
      inv.estimated_bill_date ??
      todayYmdInAppTz()
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
