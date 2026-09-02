import { forwardRef, useImperativeHandle, useState, type ForwardedRef } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../../types/laborJob'

/** Memos are sub-visible on the sub portal (sub-portal train) — say so at the point of writing. */
const MEMO_PORTAL_HINT = '👁 Shown to the sub on their portal — write it like they’ll read it.'

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
}

/** Local YYYY-MM-DD for date inputs (same pattern as the form modal's Date of Labor seed). */
function todayYmd(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** Seed for the Edit modal's date input: the stored date, else the recorded timestamp's local day. */
function paymentDateSeed(payment: EditingPaymentTarget): string {
  if (payment.paymentDate?.trim()) return payment.paymentDate.slice(0, 10)
  return payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-CA') : todayYmd()
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
  recordLaborJobPayment: (jobId: string, amount: number, memo: string | null, paymentDate: string | null) => Promise<void>
  recordLaborJobBackcharge: (jobId: string, amount: number, memo: string) => Promise<void>
  deleteLaborJobPayment: (paymentId: string) => Promise<void>
  updateLaborJobPayment: (paymentId: string, amount: number, memo: string | null, isBackcharge: boolean, paymentDate: string | null) => Promise<void>
}

function SubLaborPaymentModalsInner(
  {
    recordLaborJobPayment,
    recordLaborJobBackcharge,
    deleteLaborJobPayment,
    updateLaborJobPayment,
  }: SubLaborPaymentModalsProps,
  ref: ForwardedRef<SubLaborPaymentModalsHandle>,
) {
  const confirmDialog = useConfirmDialog()
  const [makePaymentLaborJob, setMakePaymentLaborJob] = useState<SubLaborPaymentTarget | null>(null)
  const [makePaymentAmount, setMakePaymentAmount] = useState('')
  const [makePaymentDate, setMakePaymentDate] = useState('')
  const [makePaymentMemo, setMakePaymentMemo] = useState('')
  const [makePaymentSaving, setMakePaymentSaving] = useState(false)
  const [backchargeLaborJob, setBackchargeLaborJob] = useState<SubLaborBackchargeTarget | null>(null)
  const [backchargeAmount, setBackchargeAmount] = useState('')
  const [backchargeMemo, setBackchargeMemo] = useState('')
  const [backchargeSaving, setBackchargeSaving] = useState(false)
  const [editingPayment, setEditingPayment] = useState<EditingPaymentTarget | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentDate, setEditPaymentDate] = useState('')
  const [editPaymentMemo, setEditPaymentMemo] = useState('')
  const [editPaymentSaving, setEditPaymentSaving] = useState(false)
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
      setMakePaymentAmount(defaultAmount)
      setMakePaymentDate(todayYmd())
      setMakePaymentMemo('')
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
      setEditingPayment(payment)
    },
    clearEditPayment: () => {
      setEditingPayment(null)
    },
  }))

  return (
    <>
      {makePaymentLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(480px, calc(100vw - 2rem))', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>Make Payment</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{makePaymentLaborJob.contractor} · {makePaymentLaborJob.hcp}</p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>Total: ${formatCurrency(makePaymentLaborJob.totalCost)} · Paid: ${formatCurrency(makePaymentLaborJob.paid)} · Outstanding: ${formatCurrency(makePaymentLaborJob.outstanding)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Amount ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={makePaymentAmount}
                onChange={(e) => setMakePaymentAmount(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Date sent</label>
              <input
                type="date"
                value={makePaymentDate}
                onChange={(e) => setMakePaymentDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo (optional)</label>
              <textarea
                value={makePaymentMemo}
                onChange={(e) => setMakePaymentMemo(e.target.value)}
                placeholder="Optional note"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <p style={memoHintStyle}>{MEMO_PORTAL_HINT}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={makePaymentSaving || !(parseFloat(makePaymentAmount) > 0)} onClick={async () => { if (!makePaymentLaborJob) return; const amt = parseFloat(makePaymentAmount); if (!(amt > 0)) return; setMakePaymentSaving(true); await recordLaborJobPayment(makePaymentLaborJob.id, amt, makePaymentMemo || null, makePaymentDate || null); setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo(''); setMakePaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? 'not-allowed' : 'pointer' }}>{makePaymentSaving ? '…' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
      {backchargeLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
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
              <button type="button" disabled={backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim()} onClick={async () => { if (!backchargeLaborJob) return; const amt = parseFloat(backchargeAmount); if (!(amt > 0) || !backchargeMemo.trim()) return; setBackchargeSaving(true); await recordLaborJobBackcharge(backchargeLaborJob.id, amt, backchargeMemo); setBackchargeLaborJob(null); setBackchargeAmount(''); setBackchargeMemo(''); setBackchargeSaving(false) }} style={{ padding: '0.5rem 1rem', background: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: backchargeSaving || !(parseFloat(backchargeAmount) > 0) || !backchargeMemo.trim() ? 'not-allowed' : 'pointer' }}>{backchargeSaving ? '…' : 'Record Backcharge'}</button>
            </div>
          </div>
        </div>
      )}
      {editingPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
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
              <button type="button" disabled={editPaymentSaving} onClick={async () => { if (!editingPayment || !(await confirmDialog({ message: 'Remove this payment?', confirmLabel: 'Remove', danger: true }))) return; setEditPaymentSaving(true); await deleteLaborJobPayment(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving ? '#9ca3af' : 'var(--bg-red-100)', color: '#991b1c', border: 'none', borderRadius: 4, cursor: editPaymentSaving ? 'not-allowed' : 'pointer' }}>Remove</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="button" disabled={editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim())} onClick={async () => { if (!editingPayment) return; const amt = parseFloat(editPaymentAmount); if (!(amt > 0)) return; if (editingPayment.isBackcharge && !editPaymentMemo.trim()) return; setEditPaymentSaving(true); await updateLaborJobPayment(editingPayment.id, amt, editPaymentMemo || null, editingPayment.isBackcharge, editPaymentDate || null); await applyMemoVisibility(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? 'not-allowed' : 'pointer' }}>{editPaymentSaving ? '…' : 'Save'}</button>
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
