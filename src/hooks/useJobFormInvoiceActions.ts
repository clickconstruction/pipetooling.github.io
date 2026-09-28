import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { useBillCustomerModal } from '../contexts/BillCustomerModalContext'
import type { UserRole } from './useAuth'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { JobBillingContext } from '../lib/jobBillingContext'
import { jobLedgerHasCustomerForBilling } from '../lib/jobLedgerCustomerForBilling'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { getAccessTokenForEdgeFunctions } from '../lib/supabaseAccessTokenForEdge'
import { prepareBilledInvoicesBeforeJobRevertToReadyToBill } from '../lib/voidStripeInvoiceForRevert'
import { linkHazmatFeeIncidentToInvoice } from '../lib/hazmatFeeEdit'
import type { JobHazmatIncidentRow } from '../lib/hazmatIncidents'
import { formatCurrency, parseMoneyInputToNumber } from '../lib/jobs/jobFormMoney'
import { breakOffPrefillAmountStringFromJob, unallocatedBillableDollars } from '../lib/jobs/jobFormBreakOff'
import { jobFormPaidDollars } from '../lib/jobs/jobFormMoneyTotals'
import { draftInvoiceErrorMessage, linkFixturesToInvoiceByPositions, writeDraftInvoice } from '../lib/jobs/draftInvoiceWrite'
import { isFullRemainingAmount, planTypedInvoice, segmentSelectionBillCheck } from '../lib/jobs/jobFormInvoiceClamps'
import {
  exactSingleSegmentMatchForAmount,
  linkableSelectedIds,
  segmentSelectionNetSummary,
  selectedSegmentSequencePositions,
  type JobDollarCoverage,
} from '../lib/jobs/jobSegmentsCoverage'
import { planPayerCarves } from '../lib/jobs/splitByPayer'
import type { FixtureRow, PaymentRow } from '../lib/jobs/jobFormTypes'
import type { BillToEditorInvoice } from '../components/jobs/JobFormBillToEditor'

export type JobFormInvoiceActionsArgs = {
  editing: JobWithDetails | null
  setEditing: Dispatch<SetStateAction<JobWithDetails | null>>
  authRole: UserRole | null
  payments: PaymentRow[]
  /** The Job Total with riders — the gross every remainder is figured from. */
  jobTotalWithRidersDollars: number
  segmentCoverage: JobDollarCoverage
  /** The line items as the billing autosave last saw them — what the flush writes. */
  autosaveFixturesRef: MutableRefObject<FixtureRow[]>
  setFixtures: Dispatch<SetStateAction<FixtureRow[]>>
  flushBillingAutosave: () => Promise<void>
  newInvoiceAmount: string
  setNewInvoiceAmount: (value: string) => void
  setNewInvoiceAmountInputFocused: (focused: boolean) => void
  /** The ② bar's selection — the form's: the toggle, hydrate, reset and undo write it too. */
  selectedSegmentIds: Set<string>
  setSelectedSegmentIds: Dispatch<SetStateAction<Set<string>>>
  setBillToEditorInvoice: Dispatch<SetStateAction<BillToEditorInvoice | null>>
  setError: (message: string | null) => void
  onSavedRef: MutableRefObject<(() => void) | null | undefined>
  refreshHazmatIncidents: () => void
  refreshEditingJobAndHydratePayments: (jobId: string) => void
}

export type JobFormInvoiceActions = {
  creatingInvoice: boolean
  movingJobToReadyToBill: boolean
  creatingSegmentInvoice: boolean
  /** The stage row "Bill it" is running for. */
  billingStageFixtureId: string | null
  /** The hazmat incident "Bill separately…" is running for. */
  billingFeeSeparatelyId: string | null
  carvingByPayer: boolean
  createInvoice: () => Promise<void>
  moveWorkingJobToReadyToBillFromEdit: () => Promise<void>
  createInvoiceFromSelectedSegments: () => Promise<string | null>
  billStageRow: (fixtureId: string) => Promise<void>
  carveInvoicesByPayer: () => Promise<void>
  billHazmatFeeSeparately: (row: JobHazmatIncidentRow) => Promise<void>
}

/**
 * The job form's invoice doors, out of `JobFormModal` whole (the Job form map's order #6): a
 * typed amount, a picked selection, one stage row, a draft per payer, a hazmat fee billed
 * separately, and Working → Ready to Bill — each with its busy flag. The handlers are plain
 * functions, made again on every render as they were in the form, so each reads the job, the
 * payments and the coverage of the render it was called from. The money rules are
 * `jobFormInvoiceClamps`; the write's order is `draftInvoiceWrite`.
 */
export function useJobFormInvoiceActions(args: JobFormInvoiceActionsArgs): JobFormInvoiceActions {
  const {
    editing,
    setEditing,
    authRole,
    payments,
    jobTotalWithRidersDollars,
    segmentCoverage,
    autosaveFixturesRef,
    setFixtures,
    flushBillingAutosave,
    newInvoiceAmount,
    setNewInvoiceAmount,
    setNewInvoiceAmountInputFocused,
    selectedSegmentIds,
    setSelectedSegmentIds,
    setBillToEditorInvoice,
    setError,
    onSavedRef,
    refreshHazmatIncidents,
    refreshEditingJobAndHydratePayments,
  } = args
  const { showToast } = useToastContext()
  const billCustomer = useBillCustomerModal()
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [movingJobToReadyToBill, setMovingJobToReadyToBill] = useState(false)
  const [creatingSegmentInvoice, setCreatingSegmentInvoice] = useState(false)
  const [billingStageFixtureId, setBillingStageFixtureId] = useState<string | null>(null)
  const [billingFeeSeparatelyId, setBillingFeeSeparatelyId] = useState<string | null>(null)
  const [carvingByPayer, setCarvingByPayer] = useState(false)

  function getEditJobBillableRemaining(): number {
    return unallocatedBillableDollars(jobTotalWithRidersDollars, jobFormPaidDollars(payments), editing?.invoices, payments)
  }

  async function moveWorkingJobToReadyToBillFromEdit() {
    if (!editing || editing.status !== 'working') return
    // Make the DB match the on-screen totals before the status/invoice writes.
    await flushBillingAutosave()
    const remaining = getEditJobBillableRemaining()
    const amount = parseMoneyInputToNumber(newInvoiceAmount)
    if (!isFullRemainingAmount(amount, remaining)) {
      setError('Enter the full unallocated amount to move this job to Ready to Bill.')
      return
    }
    setMovingJobToReadyToBill(true)
    setError(null)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        setError('Not signed in')
        return
      }
      const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
        jobId: editing.id,
        authRole: authRole ?? null,
        accessToken: token,
      })
      if (!prep.ok) {
        setError(prep.message)
        return
      }
      const data = await withSupabaseRetry(
        async () => supabase.rpc('update_job_status', { p_job_id: editing.id, p_to_status: 'ready_to_bill' }),
        'update_job_status working to ready_to_bill from edit job',
      )
      const result = data as { error?: string } | null
      if (result?.error) {
        setError(result.error)
        return
      }
      showToast('Job moved to Ready to Bill', 'success')
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmountInputFocused(false)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
      }
      onSavedRef.current?.()
    } catch (e: unknown) {
      const errObj = e as { message?: string }
      setError(errObj?.message ?? 'Failed to update job status')
    } finally {
      setMovingJobToReadyToBill(false)
    }
  }

  function createInvoiceFromSelectedSegments() {
    return createInvoiceFromSegmentIds(selectedSegmentIds)
  }

  /** Stage Plan (PR 2): "Bill it" on one ready row — that row alone, through the segment-invoice path. */
  async function billStageRow(fixtureId: string) {
    const only = new Set([fixtureId])
    setSelectedSegmentIds(only)
    setBillingStageFixtureId(fixtureId)
    try {
      await createInvoiceFromSegmentIds(only)
    } finally {
      setBillingStageFixtureId(null)
    }
  }

  async function createInvoiceFromSegmentIds(selection: ReadonlySet<string>): Promise<string | null> {
    if (!editing) return null
    const fixturesNow = autosaveFixturesRef.current
    // The invoice bills the selection NET of dollar coverage — money already
    // paid or invoiced by amount against these rows is subtracted, so a
    // partially covered segment bills only what's left on it.
    const { netDollars, coveredDollars, count } = segmentSelectionNetSummary(
      fixturesNow,
      selection,
      segmentCoverage,
    )
    const selectionCheck = segmentSelectionBillCheck({ netDollars, count, remainingDollars: segmentCoverage.remainingDollars })
    if (selectionCheck === 'empty') {
      setError('Select at least one unbilled segment first')
      return null
    }
    // Cents-exact backstop for the UI clamp (v2.1132): never invoice past the
    // slider's Remaining — dollar invoices already cover that money.
    if (selectionCheck === 'over') {
      setError(
        `This selection would bill more than the $${formatCurrency(segmentCoverage.remainingDollars)} left on the job — void or delete an existing bill first.`,
      )
      return null
    }
    setCreatingSegmentInvoice(true)
    setError(null)
    try {
      // Flush so the DB rows match this exact fixtures array — the link
      // UPDATE below keys on the sequence_order positions the flush wrote.
      await flushBillingAutosave()
      const positions = selectedSegmentSequencePositions(fixturesNow, selection)
      const linkedRowIds = new Set(linkableSelectedIds(fixturesNow, selection))
      const jobId = editing.id
      const nextOrder = (editing.invoices ?? []).length
      // The invoice is written before the re-sync runs — a failed remainder
      // re-sync must not read as a failed create (it did for Taunya on job 978:
      // the RPC's zero-remainder envelope surfaced as "Nothing left to bill"
      // with a stale screen while her invoice existed). Refetch either way;
      // report a real re-sync failure alongside the created invoice, not
      // instead of it.
      const { invoiceId: newInvoiceId, ensureFailure } = await writeDraftInvoice(supabase, {
        jobId,
        amount: netDollars,
        sequenceOrder: nextOrder,
        jobStatus: editing.status,
        resyncLabel: 'ensure RTB remainder after segment invoice',
        afterInsert: async (invoiceId) => {
          const { error: linkErr } = await linkFixturesToInvoiceByPositions(supabase, { jobId, invoiceId, positions })
          if (linkErr) throw linkErr
          // Mirror the links into local state so the next delete+reinsert keeps
          // them (the refetch below re-hydrates editing, not the fixtures state).
          setFixtures((prev) => prev.map((r) => (linkedRowIds.has(r.id) ? { ...r, invoice_id: invoiceId } : r)))
        },
      })
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
        setNewInvoiceAmountInputFocused(false)
      }
      setSelectedSegmentIds(new Set())
      onSavedRef.current?.()
      if (ensureFailure) {
        setError(`Invoice created, but the remainder draft did not re-sync: ${ensureFailure}`)
      } else {
        showToast(
          `Invoice created for the remaining $${formatCurrency(netDollars)} on ${count} segment${count === 1 ? '' : 's'}${coveredDollars > 0 ? ` ($${formatCurrency(coveredDollars)} already covered was subtracted)` : ''}`,
          'success',
        )
      }
      return newInvoiceId
    } catch (e: unknown) {
      setError(draftInvoiceErrorMessage(e, 'Failed to create invoice from segments'))
      return null
    } finally {
      setCreatingSegmentInvoice(false)
    }
  }

  /**
   * Split by line (v2.3349): one draft per payer from every unbilled work row,
   * through the same segment-invoice path as a hand-picked selection, then
   * each draft is stamped with its party so Bill Customer addresses it.
   */
  async function carveInvoicesByPayer() {
    if (!editing || carvingByPayer) return
    setCarvingByPayer(true)
    try {
      let made = 0
      for (const carve of planPayerCarves(autosaveFixturesRef.current, segmentCoverage)) {
        const id = await createInvoiceFromSegmentIds(new Set(carve.fixtureIds))
        if (!id) break
        const { error: partyErr } = await supabase.from('jobs_ledger_invoices').update({ bill_to_party: carve.party }).eq('id', id)
        if (partyErr) {
          setError(`Bill created, but its payer did not save (${partyErr.message}) — pick it with Bill to ▾.`)
        }
        made += 1
      }
      if (made > 0) {
        const found = await fetchJobWithDetailsById(editing.id)
        if (found) setEditing(found)
      }
    } finally {
      setCarvingByPayer(false)
    }
  }

  async function createInvoice() {
    if (!editing) return
    // Make the DB match the on-screen totals before the invoice is written.
    await flushBillingAutosave()
    const plan = planTypedInvoice({
      typedAmount: parseMoneyInputToNumber(newInvoiceAmount),
      remainingDollars: getEditJobBillableRemaining(),
      jobStatus: editing.status,
    })
    if (plan.kind === 'invalid') {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (plan.kind === 'nothing-left') {
      setError('No remaining balance to bill')
      return
    }
    const { amount: amountToUse, amountCents: amountToUseCents } = plan
    if (plan.adjusted) {
      showToast(`Adjusted to remaining unallocated ($${formatCurrency(amountToUse)})`, 'info')
      setNewInvoiceAmount(String(amountToUse))
    }
    if (plan.kind === 'bill-customer') {
      if (!jobLedgerHasCustomerForBilling(editing.customer_id)) {
        showToast('Link this job to a customer before billing.', 'error')
        return
      }
      const jobId = editing.id
      const ctx: JobBillingContext = {
        id: editing.id,
        master_user_id: editing.master_user_id,
        hcp_number: editing.hcp_number,
        click_number: editing.click_number,
        job_name: editing.job_name,
        customer_id: editing.customer_id,
        customer_name: editing.customer_name,
        customer_email: editing.customer_email,
        job_address: editing.job_address,
        customer_phone: editing.customer_phone,
        last_work_date: editing.last_work_date,
      }
      billCustomer?.openBillCustomer({
        payload: { kind: 'job', job: ctx },
        onSuccess: async () => {
          onSavedRef.current?.()
          const found = await fetchJobWithDetailsById(jobId)
          if (found) setEditing(found)
        },
        onAfterEnsureSuccess: async () => {
          const found = await fetchJobWithDetailsById(jobId)
          if (found) setEditing(found)
        },
        onAfterOobUnwindSuccess: async () => {
          refreshEditingJobAndHydratePayments(jobId)
        },
      })
      return
    }
    setCreatingInvoice(true)
    setError(null)
    try {
      // v2.2467: a typed amount that IS exactly one segment's remaining net is
      // that segment — link it so the bill lists that line instead of the
      // whole job prorated. flushBillingAutosave() above makes the DB rows
      // match this fixtures array, same contract as the segment-select path.
      const fixturesNow = autosaveFixturesRef.current
      const segmentMatch = exactSingleSegmentMatchForAmount(fixturesNow, segmentCoverage, amountToUseCents)
      const jobId = editing.id
      const nextOrder = (editing.invoices ?? []).length
      // Invoice already written when the re-sync runs — a failed remainder
      // re-sync is reported, not treated as a failed create (fully-allocated
      // envelopes are success).
      const { ensureFailure } = await writeDraftInvoice(supabase, {
        jobId,
        amount: amountToUse,
        sequenceOrder: nextOrder,
        jobStatus: editing.status,
        resyncLabel: 'ensure RTB remainder after partial invoice',
        afterInsert: async (newInvoiceId) => {
          if (!segmentMatch) return
          const positions = selectedSegmentSequencePositions(fixturesNow, new Set([segmentMatch.fixtureId]))
          const { error: linkErr } = await linkFixturesToInvoiceByPositions(supabase, { jobId, invoiceId: newInvoiceId, positions })
          if (linkErr) {
            // The invoice itself is fine — it just bills as an unlinked dollar
            // carve (whole-job prorated lines), exactly as before this feature.
            showToast(
              `Invoice created, but it could not be attached to "${segmentMatch.label}" — the bill will list all line items prorated.`,
              'error',
            )
          } else {
            setFixtures((prev) =>
              prev.map((r) => (r.id === segmentMatch.fixtureId ? { ...r, invoice_id: newInvoiceId } : r)),
            )
            showToast(
              `Billed as "${segmentMatch.label}" — the amount matched that stage exactly, so the bill lists just that line.`,
              'success',
            )
          }
        },
      })
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmountInputFocused(false)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
      } else {
        setNewInvoiceAmount('')
        setNewInvoiceAmountInputFocused(false)
      }
      onSavedRef.current?.()
      if (ensureFailure) {
        setError(`Invoice created, but the remainder draft did not re-sync: ${ensureFailure}`)
      }
    } catch (e: unknown) {
      setError(draftInvoiceErrorMessage(e, 'Failed to create invoice'))
    } finally {
      setCreatingInvoice(false)
    }
  }

  /**
   * "Bill separately…" on a RIDERS row (v2.1087): split the hazmat fee onto
   * its own non-primary invoice, repoint the incident to it (RPC — the table
   * has no client write policies), re-sync the primary remainder, then open
   * the Bill-to editor so the office picks who pays it (e.g. the tenant).
   * A fee already sitting on its own unsent non-primary draft skips straight
   * to the editor.
   */
  async function billHazmatFeeSeparately(row: JobHazmatIncidentRow) {
    if (!editing) return
    const fee = Number(row.fee_amount)
    if (!(fee > 0)) {
      setError('This fee has no amount to bill')
      return
    }
    const invoices = editing.invoices ?? []
    const linked = row.invoice_id ? invoices.find((i) => i.id === row.invoice_id) : undefined
    if (
      linked &&
      linked.status === 'ready_to_bill' &&
      !linked.is_primary_rtb_bundle &&
      !(linked.stripe_invoice_id ?? '').trim() &&
      !(linked.sent_to_customer_at ?? '').trim() &&
      !(linked.external_send_channel ?? '').trim()
    ) {
      setBillToEditorInvoice(linked)
      return
    }
    setBillingFeeSeparatelyId(row.id)
    setError(null)
    try {
      // Same discipline as createInvoiceFromSelectedSegments: flush first so
      // the DB totals match the screen before the invoice math runs.
      await flushBillingAutosave()
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(row.incident_at ?? ''))
      const memo = m
        ? `Biohazard remediation fee — incident ${m[2]}/${m[3]}/${m[1]}`
        : 'Biohazard remediation fee'
      const nextOrder = invoices.length
      // Fee invoice + link already written when the re-sync runs —
      // fully-allocated envelopes are success; only a real re-sync failure is
      // surfaced (after the refetch).
      const { invoiceId: newInvoiceId, ensureFailure } = await writeDraftInvoice(supabase, {
        jobId: editing.id,
        amount: fee,
        sequenceOrder: nextOrder,
        memo,
        jobStatus: editing.status,
        resyncLabel: 'ensure RTB remainder after fee split',
        afterInsert: async (invoiceId) => {
          const linkRes = await linkHazmatFeeIncidentToInvoice(row.id, invoiceId)
          if (!linkRes.ok) {
            throw new Error(linkRes.error ?? 'Fee invoice created, but linking the incident to it failed')
          }
        },
      })
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
        setNewInvoiceAmountInputFocused(false)
      }
      refreshHazmatIncidents()
      onSavedRef.current?.()
      if (ensureFailure) {
        setError(`Fee invoice created, but the remainder draft did not re-sync: ${ensureFailure}`)
      } else {
        showToast(`Fee split to its own invoice ($${formatCurrency(fee)}). Now choose who pays it.`, 'success')
      }
      setBillToEditorInvoice({
        id: newInvoiceId,
        amount: fee,
        bill_to_name: null,
        bill_to_email: null,
        bill_to_phone: null,
      })
    } catch (e: unknown) {
      setError(draftInvoiceErrorMessage(e, 'Failed to split the fee to its own invoice'))
    } finally {
      setBillingFeeSeparatelyId(null)
    }
  }

  return {
    creatingInvoice,
    movingJobToReadyToBill,
    creatingSegmentInvoice,
    billingStageFixtureId,
    billingFeeSeparatelyId,
    carvingByPayer,
    createInvoice,
    moveWorkingJobToReadyToBillFromEdit,
    createInvoiceFromSelectedSegments,
    billStageRow,
    carveInvoicesByPayer,
    billHazmatFeeSeparately,
  }
}
