import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * "Mark promised date" on a Billed Awaiting Payment row: record the payment
 * date the customer actually named ("the check run is on the 25th"). The
 * promise overrides the statistical expected-pay estimate on the chip and in
 * the payment forecast, and shows who marked it. Clearing returns the row to
 * the estimate.
 */
export default function SetPromisedPayDateModal({
  jobId,
  jobLabel,
  initialYmd,
  onClose,
  onSaved,
}: {
  jobId: string
  jobLabel: string
  /** Existing promise to edit, or null when marking fresh. */
  initialYmd: string | null
  onClose: () => void
  /** Fired after a successful save/clear so the board can refresh its promise map. */
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const [ymd, setYmd] = useState(initialYmd ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (dateOrNull: string | null) => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('set_job_promised_pay_date' as never, {
        p_job_id: jobId,
        p_date: dateOrNull,
      } as never)
      if (error) throw error
      showToast(dateOrNull ? 'Promised date saved.' : 'Promised date cleared.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the promised date'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark promised payment date"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(420px, calc(100vw - 2rem))' }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Promised payment date</h2>
        <p style={{ margin: '0.35rem 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {jobLabel} — the date the customer said this bill will be paid. It replaces the statistical estimate on the
          board and records who marked it.
        </p>
        <input
          type="date"
          value={ymd}
          onChange={(e) => setYmd(e.target.value)}
          aria-label="Promised payment date"
          style={{ width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <div>
            {initialYmd ? (
              <button
                type="button"
                onClick={() => void submit(null)}
                disabled={saving}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Clear promise
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit(ymd || null)}
              disabled={saving || !ymd}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: saving || !ymd ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              {saving ? '…' : 'Save promise'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
