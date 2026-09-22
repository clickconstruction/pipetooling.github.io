import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { splitPaymentMemo, splitSend, type OpenReportRow } from '../../lib/people/openReports'
import { PaymentSplitEditor, type SplitEditorRow } from './PaymentSplitEditor'
import { AmountSmallCents } from '../AmountSmallCents'

/**
 * Balances → "Record one payment, oldest first…" (v2.3693): one send, one
 * date, one memo, split across the person's open weeks by the shared editor.
 * Writes one `pay_stub_payments` row per week that takes a share, memo
 * numbered `… · 2 of 4 from $5,000.00` when the send became more than one.
 */
export type RecordSplitPaymentModalProps = {
  personName: string
  /** The person's open reports, oldest first (only positive balances take a share). */
  rows: readonly OpenReportRow[]
  weekLabel: (r: OpenReportRow) => string
  defaultAmount: number
  authUserId: string | null
  onClose: () => void
  onSaved: () => Promise<unknown> | void
  showToast: (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void
  zIndex?: number
}

const field: CSSProperties = { font: 'inherit', fontSize: '0.85rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', width: '100%' }
const btn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }

export function RecordSplitPaymentModal({ personName, rows, weekLabel, defaultAmount, authUserId, onClose, onSaved, showToast, zIndex = 1150 }: RecordSplitPaymentModalProps) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? defaultAmount.toFixed(2) : '')
  const [date, setDate] = useState(todayYmdInAppTz())
  const [memo, setMemo] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const send = Number(amount.replace(/[$,\s]/g, ''))
  const editorRows: SplitEditorRow[] = rows.filter((r) => r.balance > 0.005).map((r) => ({ stubId: r.stubId, balance: r.balance, label: `Week of ${weekLabel(r)}` }))
  const { splits, total } = splitSend(Number.isFinite(send) ? send : 0, editorRows, edits)
  const parts = splits.filter((s) => s.amount > 0.005)

  const save = async () => {
    if (!Number.isFinite(send) || send <= 0) {
      showToast('Enter the amount sent.', 'warning')
      return
    }
    if (parts.length === 0) {
      showToast('Nothing to record — every box is empty.', 'warning')
      return
    }
    setSaving(true)
    try {
      // Noon on the chosen day, the same stamp Record payment writes.
      const paidAt = new Date(`${date.trim() || todayYmdInAppTz()}T12:00:00`).toISOString()
      const base = memo.trim()
      await withSupabaseRetry(
        async () =>
          await supabase.from('pay_stub_payments').insert(
            parts.map((p, i) => ({ pay_stub_id: p.stubId, amount: p.amount, paid_at: paidAt, memo: splitPaymentMemo(base, i, parts.length, total) || null, created_by: authUserId })),
          ),
        'record a split payment',
      )
      showToast(parts.length === 1 ? `Recorded $${total.toFixed(2)} on ${personName}'s oldest open week.` : `Recorded $${total.toFixed(2)} as ${parts.length} payments on ${personName}'s open weeks.`, 'success')
      await onSaved()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not record the payment', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-split-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !saving) onClose()
        }}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 560, width: '100%', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: '1rem 1.1rem' }}
      >
        <h2 id="record-split-title" style={{ margin: 0, fontSize: '1.05rem' }}>Record a payment · {personName}</h2>
        <p style={{ margin: '0.2rem 0 0.8rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>One send, applied to the oldest open week first. Edit any box before saving; each week takes at most what it is owed.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.7rem' }}>
          <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Amount sent
            <input id="record-split-amount" value={amount} inputMode="decimal" placeholder="0.00" onChange={(e) => setAmount(e.target.value)} onBlur={() => setEdits({})} style={{ ...field, marginTop: 4, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
          </label>
          <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Paid on
            <input id="record-split-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            Memo
            <input id="record-split-memo" value={memo} placeholder='Cash App #D-… "Cashapp", Mercury, cash off a job…' onChange={(e) => setMemo(e.target.value)} style={{ ...field, marginTop: 4 }} />
          </label>
        </div>
        <PaymentSplitEditor amount={Number.isFinite(send) ? send : 0} rows={editorRows} edits={edits} onChange={setEdits} disabled={saving} idPrefix="record-split" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.8rem' }}>
          <button type="button" onClick={onClose} disabled={saving} style={btn}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || parts.length === 0} style={{ ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: '#fff', opacity: saving || parts.length === 0 ? 0.6 : 1 }}>
            {saving ? 'Saving…' : parts.length <= 1 ? <>Record <AmountSmallCents value={total} /></> : <>Record {parts.length} payments · <AmountSmallCents value={total} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
