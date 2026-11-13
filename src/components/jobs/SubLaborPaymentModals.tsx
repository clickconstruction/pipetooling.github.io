import { forwardRef, useImperativeHandle, useState, type ForwardedRef } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { SubLaborBackchargeTarget, SubLaborPaymentTarget, SubPaymentExtras } from '../../types/laborJob'
import { AmountPaidField, PaidDateField, PayMethodPicker, PaymentNoteField, RecordPaymentFooter, RecordPaymentHelp, RecordPaymentShell, RecordPaymentSummary } from '../pay/RecordPaymentPieces'
import { isSubPayMethod, planSubPayment, subPayMethodRefField, subPayMethodWrite, subPaymentAfterWords, subPaymentAmountDefault, subPaymentSummaryWords, SUB_PAY_METHOD_OPTIONS, type SubPayMethod } from '../../lib/subWorkOrders/subPaymentWindow'
import { localCalendarDayKey, todayYmdInAppTz } from '../../utils/dateUtils'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

/** Memos are sub-visible on the sub portal (sub-portal train) — say so at the point of writing. */
const MEMO_PORTAL_HINT = '👁 Shown to the sub on their portal — write it like they’ll read it.'

/** The same line once the memo is kept off the portal. */
const MEMO_HIDDEN_HINT = 'Kept off the sub’s portal. Only the office reads this memo.'

const memoHintStyle = { margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' } as const

/** The payment/backcharge row being edited (single declaration — the form modal imports it from here). */
export type EditingPaymentTarget = {
  id: string
  jobId: string
  amount: number
  memo: string | null
  isBackcharge: boolean
  /** User-set "date sent" (YYYY-MM-DD); null on legacy rows, which display created_at instead. */
  paymentDate: string | null
  createdAt: string | null
  /** v2.7176: how it was sent and that method's number; absent on callers that do not know them. */
  method?: string | null
  methodRef?: string | null
}

/** Local YYYY-MM-DD for date inputs (same pattern as the form modal's Date of Labor seed). */
function todayYmd(): string {
  return todayYmdInAppTz()
}

/** Seed for the Edit modal's date input: the stored date, else the recorded timestamp's local day. */
function paymentDateSeed(payment: EditingPaymentTarget): string {
  if (payment.paymentDate?.trim()) return payment.paymentDate.slice(0, 10)
  return payment.createdAt ? localCalendarDayKey(new Date(payment.createdAt)) : todayYmd()
}

/**
 * Imperative handle the parent (Jobs.tsx) uses to drive the always-mounted
 * payment modal trio. These modals are opened from two surfaces — the
 * JobsSubLaborTab ledger rows and JobsSubLaborFormModal's payments list — so
 * they live in a sibling component, mirroring the JobsSubLaborFormModal pattern.
 */
export type SubLaborPaymentModalsHandle = {
  openMakePayment: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  openBackcharge: (target: SubLaborBackchargeTarget) => void
  openEditPayment: (payment: EditingPaymentTarget, amountSeed: string, memoSeed: string) => void
  /** Used by the form modal's closeLaborModal — clears an open Edit Payment modal. */
  clearEditPayment: () => void
}

export type SubLaborPaymentModalsProps = {
  recordLaborJobPayment: (jobId: string, amount: number, memo: string | null, paymentDate: string | null, extras?: SubPaymentExtras) => Promise<void>
  recordLaborJobBackcharge: (jobId: string, amount: number, memo: string) => Promise<void>
  deleteLaborJobPayment: (paymentId: string) => Promise<void>
  updateLaborJobPayment: (paymentId: string, amount: number, memo: string | null, isBackcharge: boolean, paymentDate: string | null, extras?: SubPaymentExtras) => Promise<void>
  /** v2.3562: when set, the Edit dialog's Remove hands the row to the reason dialog instead of deleting on a confirm. */
  onRequestRemove?: (payment: EditingPaymentTarget) => void
}

function SubLaborPaymentModalsInner(
  {
    recordLaborJobPayment,
    recordLaborJobBackcharge,
    deleteLaborJobPayment,
    updateLaborJobPayment,
    onRequestRemove,
  }: SubLaborPaymentModalsProps,
  ref: ForwardedRef<SubLaborPaymentModalsHandle>,
) {
  const confirmDialog = useConfirmDialog()
  const [makePaymentLaborJob, setMakePaymentLaborJob] = useState<SubLaborPaymentTarget | null>(null)
  const [makePaymentAmount, setMakePaymentAmount] = useState('')
  const [makePaymentDate, setMakePaymentDate] = useState('')
  const [makePaymentMemo, setMakePaymentMemo] = useState('')
  const [makePaymentSaving, setMakePaymentSaving] = useState(false)
  // v2.7176: how it was sent, that method's number, and whether the memo is kept off the sub's portal.
  const [makePaymentMethod, setMakePaymentMethod] = useState<SubPayMethod | null>(null)
  const [makePaymentMethodRef, setMakePaymentMethodRef] = useState('')
  const [makePaymentHideMemo, setMakePaymentHideMemo] = useState(false)
  const [backchargeLaborJob, setBackchargeLaborJob] = useState<SubLaborBackchargeTarget | null>(null)
  const [backchargeAmount, setBackchargeAmount] = useState('')
  const [backchargeMemo, setBackchargeMemo] = useState('')
  const [backchargeSaving, setBackchargeSaving] = useState(false)
  const [editingPayment, setEditingPayment] = useState<EditingPaymentTarget | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentDate, setEditPaymentDate] = useState('')
  const [editPaymentMemo, setEditPaymentMemo] = useState('')
  const [editPaymentSaving, setEditPaymentSaving] = useState(false)
  const [editPaymentMethod, setEditPaymentMethod] = useState<SubPayMethod | null>(null)
  const [editPaymentMethodRef, setEditPaymentMethodRef] = useState('')
  // Hide-memo toggle (sub-portal train): tri-state — null until the user
  // touches it, so an unrelated edit never flips a previously chosen state.
  const [editPaymentHideMemo, setEditPaymentHideMemo] = useState<boolean | null>(null)

  async function applyMemoVisibility(paymentId: string): Promise<void> {
    if (editPaymentHideMemo == null) return
    try {
      await withSupabaseRetry(
        () => supabase.rpc('set_sub_payment_visibility' as never, {
          p_payment_id: paymentId,
          p_hidden: editPaymentHideMemo,
        } as never),
        'set sub payment visibility',
      )
    } catch (e) {
      console.error('set_sub_payment_visibility failed', e)
    }
  }

  useImperativeHandle(ref, () => ({
    openMakePayment: (target, defaultAmount) => {
      // The box opens on what is left, to the cent, as the pay stubs' window does.
      const seeded = Number(defaultAmount)
      setMakePaymentAmount(Number.isFinite(seeded) && seeded > 0 ? subPaymentAmountDefault(seeded) : defaultAmount)
      setMakePaymentDate(todayYmd())
      setMakePaymentMemo('')
      setMakePaymentMethod(null)
      setMakePaymentMethodRef('')
      setMakePaymentHideMemo(false)
      setMakePaymentLaborJob(target)
    },
    openBackcharge: (target) => {
      setBackchargeAmount('')
      setBackchargeMemo('')
      setBackchargeLaborJob(target)
    },
    openEditPayment: (payment, amountSeed, memoSeed) => {
      setEditPaymentAmount(amountSeed)
      setEditPaymentDate(paymentDateSeed(payment))
      setEditPaymentMemo(memoSeed)
      setEditPaymentHideMemo(null)
      setEditPaymentMethod(isSubPayMethod(payment.method) ? payment.method : null)
      setEditPaymentMethodRef(payment.methodRef ?? '')
      setEditingPayment(payment)
    },
    clearEditPayment: () => {
      setEditingPayment(null)
    },
  }))

  return (
    <>
      {makePaymentLaborJob &&
        (() => {
          const target = makePaymentLaborJob
          const remaining = Math.max(0, target.outstanding)
          const plan = planSubPayment(makePaymentAmount, remaining)
          const refField = subPayMethodRefField(makePaymentMethod)
          const close = () => {
            setMakePaymentLaborJob(null)
            setMakePaymentAmount('')
            setMakePaymentMemo('')
          }
          const record = async () => {
            if (!plan.ok) return
            setMakePaymentSaving(true)
            await recordLaborJobPayment(target.id, plan.amount, makePaymentMemo.trim() || null, makePaymentDate.trim() || null, { ...subPayMethodWrite(makePaymentMethod, makePaymentMethodRef), hidden_from_sub: makePaymentHideMemo && !!makePaymentMemo.trim() })
            setMakePaymentSaving(false)
            close()
          }
          return (
            <RecordPaymentShell title="Record payment" zIndex={760} testId="sub-record-payment">
              <RecordPaymentSummary>{subPaymentSummaryWords(target)}</RecordPaymentSummary>
              <AmountPaidField value={makePaymentAmount} onChange={setMakePaymentAmount} disabled={makePaymentSaving} />
              <RecordPaymentHelp>
                <strong>Record payment</strong> records this amount on the sheet. A part payment is fine: what is left stays due, and the sheet reads Paid once nothing is left.
              </RecordPaymentHelp>
              {plan.ok ? (
                <p data-sub-payment-after style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: plan.settles ? 'var(--text-green-700)' : 'var(--text-700)' }}>
                  {subPaymentAfterWords(plan)}
                </p>
              ) : plan.reason === 'blank' ? null : (
                <p role="alert" data-sub-payment-refusal={plan.reason} style={{ margin: '-0.35rem 0 0.75rem', padding: '0.5rem 0.65rem', fontSize: '0.8125rem', lineHeight: 1.4, color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  {plan.error}
                </p>
              )}
              <PaidDateField value={makePaymentDate} onChange={setMakePaymentDate} disabled={makePaymentSaving} />
              <PayMethodPicker
                options={SUB_PAY_METHOD_OPTIONS}
                value={makePaymentMethod}
                onChange={setMakePaymentMethod}
                disabled={makePaymentSaving}
                refBox={refField ? { id: 'sub-payment-method-ref', ...refField } : null}
                refValue={makePaymentMethodRef}
                onRefChange={setMakePaymentMethodRef}
              />
              <PaymentNoteField value={makePaymentMemo} onChange={setMakePaymentMemo} label="Memo for the sub (optional)" placeholder="e.g. rough-in draw" rows={2} disabled={makePaymentSaving}>
                <p style={memoHintStyle}>{makePaymentHideMemo ? MEMO_HIDDEN_HINT : MEMO_PORTAL_HINT}</p>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                  <input type="checkbox" checked={makePaymentHideMemo} disabled={makePaymentSaving} onChange={(e) => setMakePaymentHideMemo(e.target.checked)} />
                  Hide this memo from the sub&#8217;s portal (the amount still shows)
                </label>
              </PaymentNoteField>
              <RecordPaymentFooter onCancel={close} onConfirm={() => void record()} confirmLabel="Record payment" busy={makePaymentSaving} disabled={!plan.ok} />
            </RecordPaymentShell>
          )
        })()}
      {backchargeLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 760, paddingTop: 'var(--app-top-chrome, 0px)' }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Backcharge</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{backchargeLaborJob.contractor} · {backchargeLaborJob.hcp}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>Total: ${formatCurrency(backchargeLaborJob.totalCost)} · Paid: ${formatCurrency(backchargeLaborJob.paid)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={backchargeAmount}
                onChange={(e) => setBackchargeAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
              <textarea
                value={backchargeMemo}
                onChange={(e) => setBackchargeMemo(e.target.value)}
                placeholder="Required for backcharges"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <p style={memoHintStyle}>{MEMO_PORTAL_HINT}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim()} onClick={async () => { if (!backchargeLaborJob) return; const amt = parseFloat(backchargeAmount); if (!(amt > 0) || !backchargeMemo.trim()) return; setBackchargeSaving(true); await recordLaborJobBackcharge(backchargeLaborJob.id, amt, backchargeMemo); setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeSaving(false) }} style={{ padding: '0.5rem 1rem', background: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? DEAD_PRESS_FILL : '#dc2626', color: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? 'not-allowed' : 'pointer' }}>{backchargeSaving ? '…' : 'Record Backcharge'}</button>
            </div>
          </div>
        </div>
      )}
      {editingPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 760, paddingTop: 'var(--app-top-chrome, 0px)' }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{editingPayment.isBackcharge ? 'Edit Backcharge' : 'Edit Payment'}</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={editPaymentAmount}
                onChange={(e) => setEditPaymentAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date sent</label>
              <input
                type="date"
                value={editPaymentDate}
                onChange={(e) => setEditPaymentDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            {editingPayment.isBackcharge ? null : (
              <PayMethodPicker
                options={SUB_PAY_METHOD_OPTIONS}
                value={editPaymentMethod}
                onChange={setEditPaymentMethod}
                disabled={editPaymentSaving}
                refBox={subPayMethodRefField(editPaymentMethod) ? { id: 'sub-payment-edit-method-ref', ...subPayMethodRefField(editPaymentMethod)! } : null}
                refValue={editPaymentMethodRef}
                onRefChange={setEditPaymentMethodRef}
              />
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo {editingPayment.isBackcharge ? <span style={{ color: 'var(--text-red-700)' }}>*</span> : '(optional)'}</label>
              <textarea
                value={editPaymentMemo}
                onChange={(e) => setEditPaymentMemo(e.target.value)}
                placeholder={editingPayment.isBackcharge ? 'Required for backcharges' : 'Optional note'}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <p style={memoHintStyle}>{MEMO_PORTAL_HINT}</p>
              <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: 6, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                <input
                  type="checkbox"
                  checked={editPaymentHideMemo ?? false}
                  onChange={(e) => setEditPaymentHideMemo(e.target.checked)}
                />
                Hide this memo from the sub&#8217;s portal (the amount still shows)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" disabled={editPaymentSaving} onClick={async () => { if (editingPayment && onRequestRemove) { const p = editingPayment; setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); onRequestRemove(p); return } if (!editingPayment || !(await confirmDialog({ message: 'Remove this payment?', confirmLabel: 'Remove', danger: true }))) return; setEditPaymentSaving(true); await deleteLaborJobPayment(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving ? DEAD_PRESS_FILL : 'var(--bg-red-100)', color: editPaymentSaving ? DEAD_PRESS_TEXT : '#991b1c', border: 'none', borderRadius: 4, cursor: editPaymentSaving ? 'not-allowed' : 'pointer' }}>Remove</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="button" disabled={editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim())} onClick={async () => { if (!editingPayment) return; const amt = parseFloat(editPaymentAmount); if (!(amt > 0)) return; if (editingPayment.isBackcharge && !editPaymentMemo.trim()) return; setEditPaymentSaving(true); await updateLaborJobPayment(editingPayment.id, amt, editPaymentMemo || null, editingPayment.isBackcharge, editPaymentDate || null, editingPayment.isBackcharge ? undefined : subPayMethodWrite(editPaymentMethod, editPaymentMethodRef)); await applyMemoVisibility(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? DEAD_PRESS_FILL : '#059669', color: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? DEAD_PRESS_TEXT : 'white', border: 'none', borderRadius: 4, cursor: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? 'not-allowed' : 'pointer' }}>{editPaymentSaving ? '…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * The Make Payment / Backcharge / Edit Payment modal trio for the Sub Labor
 * ledger. Always mounted by Jobs.tsx; opened via the imperative handle from
 * both JobsSubLaborTab and JobsSubLaborFormModal. Moved verbatim from
 * Jobs.tsx in v2.824 (step 4b of JOBS_TABS_ARCHITECTURE.md).
 */
export const SubLaborPaymentModals = forwardRef(SubLaborPaymentModalsInner)
export default SubLaborPaymentModals
