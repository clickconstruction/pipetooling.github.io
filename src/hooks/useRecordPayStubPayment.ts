import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import type { PayStubRow } from '../components/people/PeoplePayStubsTab'
import type { PersonOffsetInitialDraft } from '../components/pay/PersonOffsetFormModal'
import { isPaySourceDuplicateError, PAY_SOURCE_DUPLICATE_MESSAGE, paySourceWrite, type PaySourceKind } from '../lib/people/paySources'
import { employeeCreditDraftFromPayment, payStubBalance, payStubPaymentAmountDefault, planPayStubPayment, type PayStubLineMaps } from '../lib/pay/recordPayStubPayment'
import type { PayStubsLoadSnapshot } from '../lib/pay/payStubsData'

function paidAtIsoFromYyyyMmDd(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toISOString()
}

export type UseRecordPayStubPaymentInput = {
  authUserId: string | undefined
  payStubLineMaps: PayStubLineMaps
  loadPayStubs: () => Promise<PayStubsLoadSnapshot | null>
  setError: (value: string | null) => void
}

export type RecordPayStubPaymentApi = {
  payStubLineMaps: PayStubLineMaps
  /** The stub whose payment is being saved — Pay run, Draft Payroll and Catch-up grey their own buttons on it. */
  markingPayStubId: string | null
  payStubMarkPaidTarget: PayStubRow | null
  payStubMarkPaidDate: string
  setPayStubMarkPaidDate: Dispatch<SetStateAction<string>>
  payStubMarkPaidAmount: string
  setPayStubMarkPaidAmount: Dispatch<SetStateAction<string>>
  payStubMarkPaidNote: string
  setPayStubMarkPaidNote: Dispatch<SetStateAction<string>>
  payStubMarkPaidCashAppId: string
  setPayStubMarkPaidCashAppId: Dispatch<SetStateAction<string>>
  payStubMarkPaidKind: PaySourceKind | null
  setPayStubMarkPaidKind: Dispatch<SetStateAction<PaySourceKind | null>>
  openPayStubMarkPaidModal: (stub: PayStubRow) => void
  closePayStubMarkPaidModal: () => void
  openEmployeeCreditFromRecordPayment: () => void
  confirmPayStubMarkPaid: () => Promise<void>
  offsetFormOpen: boolean
  offsetFormInitialCreateDraft: PersonOffsetInitialDraft | null
  closeOffsetForm: () => void
  /** The Add offset form saved: reload the stubs, refresh the open target, and reset the amount to what is left. */
  onOffsetSaved: () => Promise<void>
}

/**
 * People → Payroll → Record payment: the dialog's fields, the payment write (with the Cash App
 * queue's side write), and the employee-credit round trip through the Add offset form. One
 * instance serves every door — Pay run, Balances, Draft Payroll, Catch-up.
 */
export function useRecordPayStubPayment({ authUserId, payStubLineMaps, loadPayStubs, setError }: UseRecordPayStubPaymentInput): RecordPayStubPaymentApi {
  const [markingPayStubId, setMarkingPayStubId] = useState<string | null>(null)
  const [payStubMarkPaidTarget, setPayStubMarkPaidTarget] = useState<PayStubRow | null>(null)
  const [payStubMarkPaidDate, setPayStubMarkPaidDate] = useState('')
  const [payStubMarkPaidAmount, setPayStubMarkPaidAmount] = useState('')
  const [payStubMarkPaidNote, setPayStubMarkPaidNote] = useState('')
  /** Cash App reconcile (v2.3330): the Cash App Transaction ID, when the payment was a Cash App send — written into the memo so the next import matches it exactly. */
  const [payStubMarkPaidCashAppId, setPayStubMarkPaidCashAppId] = useState('')
  /** How the payment was sent (v2.3717) — written to source_kind / source_id and the memo's first words. */
  const [payStubMarkPaidKind, setPayStubMarkPaidKind] = useState<PaySourceKind | null>(null)
  /** After Add offset save from Record payment employee-credit path: reload stub row and reset amount to remaining. */
  const recordPaymentRefreshAfterEmployeeCreditRef = useRef(false)
  const [offsetFormOpen, setOffsetFormOpen] = useState(false)
  const [offsetFormInitialCreateDraft, setOffsetFormInitialCreateDraft] = useState<PersonOffsetInitialDraft | null>(null)

  function openPayStubMarkPaidModal(stub: PayStubRow) {
    setPayStubMarkPaidTarget(stub)
    setPayStubMarkPaidDate(todayYmdInAppTz())
    setPayStubMarkPaidAmount(payStubPaymentAmountDefault(payStubBalance(stub, payStubLineMaps).remaining))
    setPayStubMarkPaidNote('')
  }

  function closePayStubMarkPaidModal() {
    setPayStubMarkPaidTarget(null)
    setPayStubMarkPaidDate('')
    setPayStubMarkPaidAmount('')
    setPayStubMarkPaidNote('')
    setPayStubMarkPaidCashAppId('')
    setPayStubMarkPaidKind(null)
  }

  function openOffsetFormWithDraft(draft: PersonOffsetInitialDraft) {
    setOffsetFormInitialCreateDraft(draft)
    setOffsetFormOpen(true)
  }

  function closeOffsetForm() {
    recordPaymentRefreshAfterEmployeeCreditRef.current = false
    setOffsetFormOpen(false)
    setOffsetFormInitialCreateDraft(null)
  }

  function openEmployeeCreditFromRecordPayment() {
    if (!payStubMarkPaidTarget) return
    const stub = payStubMarkPaidTarget
    recordPaymentRefreshAfterEmployeeCreditRef.current = true
    openOffsetFormWithDraft(
      employeeCreditDraftFromPayment({
        stub,
        amountText: payStubMarkPaidAmount,
        remaining: payStubBalance(stub, payStubLineMaps).remaining,
        memo: payStubMarkPaidNote,
        paidDateYmd: payStubMarkPaidDate,
        todayYmd: todayYmdInAppTz(),
      }),
    )
  }

  async function confirmPayStubMarkPaid() {
    if (!authUserId || !payStubMarkPaidTarget) return
    const stub = payStubMarkPaidTarget
    // The method the office picked → the two columns and the memo, the same shape record_pay_send writes (v2.3717).
    const source = paySourceWrite(payStubMarkPaidKind, payStubMarkPaidCashAppId, payStubMarkPaidNote)
    const cashAppId = source.source_kind === 'cashapp' ? source.source_id : null
    const paidAt = paidAtIsoFromYyyyMmDd(payStubMarkPaidDate.trim() || todayYmdInAppTz())
    const plan = planPayStubPayment(payStubMarkPaidAmount, payStubBalance(stub, payStubLineMaps).remaining)
    if (!plan.ok) {
      setError(plan.error)
      return
    }
    const applied = plan.applied
    setMarkingPayStubId(stub.id)
    setError(null)
    try {
      const inserted = await withSupabaseRetry(
        async () =>
          await supabase
            .from('pay_stub_payments')
            .insert({
              pay_stub_id: stub.id,
              amount: applied,
              paid_at: paidAt,
              memo: source.memo,
              source_kind: source.source_kind,
              source_id: source.source_id,
              created_by: authUserId,
            })
            .select('id')
            .single(),
        'record pay report payment'
      )
      // A Cash App send waiting in the reconcile queue is filed as recorded by this payment. Best-effort:
      // the payment is already saved; a miss here only leaves the row for the next import's rule (a).
      if (cashAppId) {
        const paymentId = (inserted as { id: string } | null)?.id ?? null
        await supabase
          .from('cashapp_transactions')
          .update({ lane: 'recorded', match_rule: 'manual', pay_stub_payment_id: paymentId, person_name: stub.person_name.trim(), decided_at: new Date().toISOString(), decided_by: authUserId })
          .eq('id', cashAppId)
          .eq('lane', 'review')
      }
      closePayStubMarkPaidModal()
      await loadPayStubs()
    } catch (e) {
      setError(isPaySourceDuplicateError(e) ? PAY_SOURCE_DUPLICATE_MESSAGE : e instanceof Error ? e.message : 'Failed to record payment')
    }
    setMarkingPayStubId(null)
  }

  async function onOffsetSaved() {
    const shouldRefreshRecordPayment = recordPaymentRefreshAfterEmployeeCreditRef.current
    recordPaymentRefreshAfterEmployeeCreditRef.current = false
    const recordStubId = payStubMarkPaidTarget?.id ?? null
    setOffsetFormInitialCreateDraft(null)
    const fresh = await loadPayStubs()
    if (!fresh) return
    if (recordStubId) {
      const stub = fresh.stubs.find((s) => s.id === recordStubId)
      if (stub) setPayStubMarkPaidTarget(stub)
      if (shouldRefreshRecordPayment && stub) {
        setPayStubMarkPaidAmount(payStubPaymentAmountDefault(payStubBalance(stub, fresh).remaining))
      }
    }
  }

  return {
    payStubLineMaps,
    markingPayStubId,
    payStubMarkPaidTarget,
    payStubMarkPaidDate,
    setPayStubMarkPaidDate,
    payStubMarkPaidAmount,
    setPayStubMarkPaidAmount,
    payStubMarkPaidNote,
    setPayStubMarkPaidNote,
    payStubMarkPaidCashAppId,
    setPayStubMarkPaidCashAppId,
    payStubMarkPaidKind,
    setPayStubMarkPaidKind,
    openPayStubMarkPaidModal,
    closePayStubMarkPaidModal,
    openEmployeeCreditFromRecordPayment,
    confirmPayStubMarkPaid,
    offsetFormOpen,
    offsetFormInitialCreateDraft,
    closeOffsetForm,
    onOffsetSaved,
  }
}
