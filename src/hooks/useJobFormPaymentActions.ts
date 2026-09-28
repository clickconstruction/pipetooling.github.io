/* eslint-disable react-hooks/exhaustive-deps -- the callback keeps the dependency list it had in the form */
import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { formatPostgrestOrUnknownError, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import type { UserRole } from './useAuth'
import type { JobWithDetails } from '../types/jobWithDetails'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { paymentRowsFromJob } from '../lib/jobs/jobFormRows'
import { jobFormPaymentRemovePreview, type JobFormPaymentRemovePreview } from '../lib/jobs/jobFormMoneyTotals'
import { paymentRemoveRefusalWords, paymentRemoveWritesNow, planPaymentRemoveRequest, removePaymentReply } from '../lib/jobs/jobFormPaymentActions'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  mercuryLinkedPaymentRow,
  stripeHoldsPaymentReason,
  stripeHoldsPaymentWords,
  unlinkedPaymentToastText,
} from '../lib/jobs/jobFormPaymentPredicates'
import type { PaymentRow } from '../lib/jobs/jobFormTypes'
import type { JobFormAutosaveSlice } from '../components/jobs/useJobFormAutosaveSlice'

export type JobFormPaymentActionsArgs = {
  editing: JobWithDetails | null
  setEditing: Dispatch<SetStateAction<JobWithDetails | null>>
  authRole: UserRole | null
  payments: PaymentRow[]
  setPayments: Dispatch<SetStateAction<PaymentRow[]>>
  /** The form's own row handler — drops a line from the list, refusing a linked one. */
  removePaymentRow: (id: string) => void
  /** The Job Total with riders — what the remove preview's remainders are figured from. */
  jobTotalWithRidersDollars: number
  /** The billing autosave: quieted before a hand-typed line is dropped by id. */
  billingAutosave: Pick<JobFormAutosaveSlice, 'cancelPending' | 'isRunning'>
  /** The payment ids the billing slice last read or wrote — its next diff starts from them. */
  hydratedPaymentIdsRef: MutableRefObject<string[]>
  /**
   * The engine's, for the re-read after a removal: the payments that came back are the saved
   * ones, and the billing slice takes them as saved rather than writing them again.
   */
  paymentsRereadFromDb: (found: Pick<JobWithDetails, 'payments'>) => void
  onSavedRef: MutableRefObject<(() => void) | null | undefined>
}

export type JobFormPaymentActions = {
  /** The line "Remove payment?" is open for. The form's close, hydrate and reset clear it. */
  paymentRemoveConfirmRowId: string | null
  setPaymentRemoveConfirmRowId: Dispatch<SetStateAction<string | null>>
  paymentRemoveRpcBusy: boolean
  setPaymentRemoveRpcBusy: Dispatch<SetStateAction<boolean>>
  /** The line "Unlink and remove?" is open for. */
  unlinkMercuryConfirmRowId: string | null
  setUnlinkMercuryConfirmRowId: Dispatch<SetStateAction<string | null>>
  unlinkingMercuryPaymentId: string | null
  /** The payment lines the job had when it was last read — the saved ones. */
  persistedLedgerPaymentIds: Set<string>
  paymentRemovePreview: JobFormPaymentRemovePreview | null
  paymentRemoveConfirmsPersistedRpc: boolean
  requestRemovePaymentRow: (row: PaymentRow) => void
  confirmRemovePaymentRow: () => Promise<void>
  finishRecordPaymentOnBill: (draftRowId: string | null) => Promise<void>
  confirmUnlinkMercuryFromBankRow: () => void
}

/**
 * The job form's payment actions, out of `JobFormModal` whole (the Job form map's order #8):
 * Remove and its confirm, the drop of a hand-typed line once its payment is recorded on the
 * bill, and Unlink and remove for a bank-matched line — with the confirm and busy states they
 * drive. The handlers are the form's own text; the rules they ask are `jobFormPaymentActions`.
 * The payment lines themselves, and the three payment windows' open states, stay the form's.
 */
export function useJobFormPaymentActions(args: JobFormPaymentActionsArgs): JobFormPaymentActions {
  const { editing, setEditing, authRole, payments, setPayments, removePaymentRow, jobTotalWithRidersDollars, billingAutosave, hydratedPaymentIdsRef, paymentsRereadFromDb, onSavedRef } = args
  const { showToast } = useToastContext()
  const [paymentRemoveConfirmRowId, setPaymentRemoveConfirmRowId] = useState<string | null>(null)
  const [unlinkMercuryConfirmRowId, setUnlinkMercuryConfirmRowId] = useState<string | null>(null)
  const [unlinkingMercuryPaymentId, setUnlinkingMercuryPaymentId] = useState<string | null>(null)
  const [paymentRemoveRpcBusy, setPaymentRemoveRpcBusy] = useState(false)

  const persistedLedgerPaymentIds = useMemo(
    () => new Set((editing?.payments ?? []).map((p) => p.id)),
    [editing?.payments],
  )

  const paymentRemovePreview = useMemo(
    () => jobFormPaymentRemovePreview({ rowId: paymentRemoveConfirmRowId, payments, jobTotalDollars: jobTotalWithRidersDollars }),
    [paymentRemoveConfirmRowId, payments, jobTotalWithRidersDollars],
  )

  const paymentRemoveConfirmsPersistedRpc = useMemo(() => {
    if (!paymentRemoveConfirmRowId || !editing) return false
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row) return false
    return paymentRemoveWritesNow(row, editing, persistedLedgerPaymentIds)
  }, [paymentRemoveConfirmRowId, payments, editing, persistedLedgerPaymentIds])

  function requestRemovePaymentRow(row: PaymentRow) {
    const request = planPaymentRemoveRequest(row, editing, persistedLedgerPaymentIds)
    if (request === 'nothing') return
    if (request !== 'confirm') {
      showToast(paymentRemoveRefusalWords(request), 'error')
      return
    }
    setPaymentRemoveConfirmRowId(row.id)
  }

  async function confirmRemovePaymentRow() {
    if (!paymentRemoveConfirmRowId || !editing) return
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row) {
      setPaymentRemoveConfirmRowId(null)
      return
    }

    const persistedRpc = paymentRemoveWritesNow(row, editing, persistedLedgerPaymentIds)

    if (persistedRpc) {
      setPaymentRemoveRpcBusy(true)
      try {
        const raw = await withSupabaseRetry(
          async () =>
            supabase.rpc('remove_jobs_ledger_payment_and_reconcile', { p_payment_id: row.id }),
          'remove_jobs_ledger_payment_and_reconcile',
        )
        const reply = removePaymentReply(raw)
        if (reply.kind === 'error') {
          showToast(reply.message, 'error')
          return
        }
        if (reply.kind === 'warning') {
          showToast(reply.message, 'warning')
        } else {
          showToast('Payment removed.', 'success')
        }

        const found = await fetchJobWithDetailsById(editing.id)
        if (found) {
          paymentsRereadFromDb(found)
          setEditing(found)
          setPayments(paymentRowsFromJob(found))
        }
        setPaymentRemoveConfirmRowId(null)
        onSavedRef.current?.()
      } catch (e: unknown) {
        showToast(formatPostgrestOrUnknownError(e, 'Failed to remove payment'), 'error')
      } finally {
        setPaymentRemoveRpcBusy(false)
      }
      return
    }

    if (!canRemovePaymentRowFromForm(row, editing)) {
      setPaymentRemoveConfirmRowId(null)
      return
    }
    removePaymentRow(paymentRemoveConfirmRowId)
    setPaymentRemoveConfirmRowId(null)
  }

  /**
   * v2.3692: the window recorded the payment (Stripe's webhook, or
   * mark_invoice_paid, wrote the row). Drop the hand-typed draft it replaced —
   * the billing autosave may already have persisted it under its own id, so
   * quiet the autosave, delete by id (a never-persisted row answers "not
   * found", which is fine), then re-read the job so the recorded row shows.
   */
  async function finishRecordPaymentOnBill(draftRowId: string | null) {
    const jobId = editing?.id
    if (!jobId) return
    if (draftRowId) {
      billingAutosave.cancelPending()
      while (billingAutosave.isRunning()) await new Promise((r) => setTimeout(r, 100))
      try {
        const raw = await withSupabaseRetry(
          async () => supabase.rpc('remove_jobs_ledger_payment_and_reconcile', { p_payment_id: draftRowId }),
          'remove_jobs_ledger_payment_and_reconcile',
        )
        const reply = removePaymentReply(raw)
        if (reply.kind === 'error' && reply.message !== 'Payment not found') showToast(reply.message, 'error')
      } catch (e: unknown) {
        showToast(formatPostgrestOrUnknownError(e, 'The payment was recorded, but the typed row could not be dropped'), 'error')
      }
    }
    const found = await fetchJobWithDetailsById(jobId)
    if (found) {
      setEditing(found)
      setPayments(paymentRowsFromJob(found))
      hydratedPaymentIdsRef.current = (found.payments ?? []).map((p) => p.id)
    }
    showToast('Payment recorded.', 'success')
    onSavedRef.current?.()
  }

  const executeUnlinkMercuryFromBankRow = useCallback(
    async (row: PaymentRow) => {
      const jobId = editing?.id
      if (!jobId || !mercuryLinkedPaymentRow(row) || !canUnlinkMercuryPayment(authRole)) {
        setUnlinkMercuryConfirmRowId(null)
        return
      }
      const stripeHolds = stripeHoldsPaymentReason(row, editing)
      if (stripeHolds) {
        showToast(stripeHoldsPaymentWords(stripeHolds), 'error')
        setUnlinkMercuryConfirmRowId(null)
        return
      }
      setUnlinkingMercuryPaymentId(row.id)
      try {
        const raw = await withSupabaseRetry(
          async () =>
            supabase.rpc('remove_jobs_ledger_payment_and_reconcile', { p_payment_id: row.id }),
          'remove_jobs_ledger_payment_and_reconcile',
        )
        const reply = removePaymentReply(raw)
        if (reply.kind === 'error') {
          showToast(reply.message, 'error')
          return
        }
        if (reply.kind === 'warning') {
          showToast(reply.message, 'warning')
        } else {
          showToast(unlinkedPaymentToastText(raw as { bank_failed?: boolean; bank_reason?: string; marked_returned?: boolean } | null), 'success')
        }

        const found = await fetchJobWithDetailsById(jobId)
        if (found) {
          paymentsRereadFromDb(found)
          setEditing(found)
          setPayments(paymentRowsFromJob(found))
        }
        onSavedRef.current?.()
      } catch (e: unknown) {
        showToast(formatPostgrestOrUnknownError(e, 'Failed to remove payment and unlink bank'), 'error')
      } finally {
        setUnlinkingMercuryPaymentId(null)
        setUnlinkMercuryConfirmRowId(null)
      }
    },
    [editing, authRole, showToast, paymentsRereadFromDb],
  )

  function confirmUnlinkMercuryFromBankRow() {
    if (!unlinkMercuryConfirmRowId) return
    const row = payments.find((r) => r.id === unlinkMercuryConfirmRowId)
    if (!row || !mercuryLinkedPaymentRow(row) || !canUnlinkMercuryPayment(authRole)) {
      setUnlinkMercuryConfirmRowId(null)
      return
    }
    void executeUnlinkMercuryFromBankRow(row)
  }

  return {
    paymentRemoveConfirmRowId,
    setPaymentRemoveConfirmRowId,
    paymentRemoveRpcBusy,
    setPaymentRemoveRpcBusy,
    unlinkMercuryConfirmRowId,
    setUnlinkMercuryConfirmRowId,
    unlinkingMercuryPaymentId,
    persistedLedgerPaymentIds,
    paymentRemovePreview,
    paymentRemoveConfirmsPersistedRpc,
    requestRemovePaymentRow,
    confirmRemovePaymentRow,
    finishRecordPaymentOnBill,
    confirmUnlinkMercuryFromBankRow,
  }
}
