import { forwardRef, useImperativeHandle, useState, type ForwardedRef } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import type { SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../../types/laborJob'

/** The payment/backcharge row being edited (single declaration — the form modal imports it from here). */
export type EditingPaymentTarget = {
  id: string
  jobId: string
  amount: number
  memo: string | null
  isBackcharge: boolean
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
  recordLaborJobPayment: (jobId: string, amount: number, memo: string | null) => Promise<void>
  recordLaborJobBackcharge: (jobId: string, amount: number, memo: string) => Promise<void>
  deleteLaborJobPayment: (paymentId: string) => Promise<void>
  updateLaborJobPayment: (paymentId: string, amount: number, memo: string | null, isBackcharge: boolean) => Promise<void>
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
  const [makePaymentLaborJob, setMakePaymentLaborJob] = useState<SubLaborPaymentTarget | null>(null)
  const [makePaymentAmount, setMakePaymentAmount] = useState('')
  const [makePaymentMemo, setMakePaymentMemo] = useState('')
  const [makePaymentSaving, setMakePaymentSaving] = useState(false)
  const [backchargeLaborJob, setBackchargeLaborJob] = useState<SubLaborBackchargeTarget | null>(null)
  const [backchargeAmount, setBackchargeAmount] = useState('')
  const [backchargeMemo, setBackchargeMemo] = useState('')
  const [backchargeSaving, setBackchargeSaving] = useState(false)
  const [editingPayment, setEditingPayment] = useState<EditingPaymentTarget | null>(null)
  const [editPaymentAmount, setEditPaymentAmount] = useState('')
  const [editPaymentMemo, setEditPaymentMemo] = useState('')
  const [editPaymentSaving, setEditPaymentSaving] = useState(false)

  useImperativeHandle(ref, () => ({
    openMakePayment: (target, defaultAmount) => {
      setMakePaymentAmount(defaultAmount)
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
      setEditPaymentMemo(memoSeed)
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
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
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo (optional)</label>
              <textarea
                value={makePaymentMemo}
                onChange={(e) => setMakePaymentMemo(e.target.value)}
                placeholder="Optional note"
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={makePaymentSaving || !(parseFloat(makePaymentAmount) > 0)} onClick={async () => { if (!makePaymentLaborJob) return; const amt = parseFloat(makePaymentAmount); if (!(amt > 0)) return; setMakePaymentSaving(true); await recordLaborJobPayment(makePaymentLaborJob.id, amt, makePaymentMemo || null); setMakePaymentLaborJob(null); setMakePaymentAmount(''); setMakePaymentMemo(''); setMakePaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: makePaymentSaving || !(parseFloat(makePaymentAmount) > 0) ? 'not-allowed' : 'pointer' }}>{makePaymentSaving ? '…' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
      {backchargeLaborJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: 480 }}>
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
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Memo {editingPayment.isBackcharge ? <span style={{ color: 'var(--text-red-700)' }}>*</span> : '(optional)'}</label>
              <textarea
                value={editPaymentMemo}
                onChange={(e) => setEditPaymentMemo(e.target.value)}
                placeholder={editingPayment.isBackcharge ? 'Required for backcharges' : 'Optional note'}
                rows={2}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <button type="button" disabled={editPaymentSaving} onClick={async () => { if (!editingPayment || !confirm('Remove this payment?')) return; setEditPaymentSaving(true); await deleteLaborJobPayment(editingPayment.id); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving ? '#9ca3af' : 'var(--bg-red-100)', color: '#991b1c', border: 'none', borderRadius: 4, cursor: editPaymentSaving ? 'not-allowed' : 'pointer' }}>Remove</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => { setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo('') }} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="button" disabled={editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim())} onClick={async () => { if (!editingPayment) return; const amt = parseFloat(editPaymentAmount); if (!(amt > 0)) return; if (editingPayment.isBackcharge && !editPaymentMemo.trim()) return; setEditPaymentSaving(true); await updateLaborJobPayment(editingPayment.id, amt, editPaymentMemo || null, editingPayment.isBackcharge); setEditingPayment(null); setEditPaymentAmount(''); setEditPaymentMemo(''); setEditPaymentSaving(false) }} style={{ padding: '0.5rem 1rem', background: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: editPaymentSaving || !(parseFloat(editPaymentAmount) > 0) || (editingPayment.isBackcharge && !editPaymentMemo.trim()) ? 'not-allowed' : 'pointer' }}>{editPaymentSaving ? '…' : 'Save'}</button>
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
