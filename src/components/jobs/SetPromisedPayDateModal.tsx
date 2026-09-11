import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { PromiseChannel } from '../../lib/jobs/paymentPromises'

/**
 * "They said…" on a Billed Awaiting Payment row: record the payment date the
 * customer actually named ("the check run is on the 25th"), who said it and
 * how. The promise overrides the statistical expected-pay estimate on the
 * chip and in the payment forecast, and every date named stays on record
 * ("Their Word" PR 2) — a changed date is a second promise, not an edit.
 * Clearing returns the row to the estimate; the promise stays in the record.
 */
const CHANNELS: ReadonlyArray<{ key: PromiseChannel; label: string }> = [
  { key: 'phone', label: 'Phone' },
  { key: 'text', label: 'Text' },
  { key: 'email', label: 'Email' },
  { key: 'in_person', label: 'In person' },
]

/** PostgREST's "no such function" — the migration hasn't been pushed yet; fall back to the old writer. */
function isMissingRpc(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  return /could not find the function|PGRST202/i.test(msg)
}

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
  const [saidBy, setSaidBy] = useState('')
  const [channel, setChannel] = useState<PromiseChannel>('phone')
  const [saving, setSaving] = useState(false)

  const submit = async (dateOrNull: string | null) => {
    setSaving(true)
    try {
      if (dateOrNull) {
        try {
          const { error } = await supabase.rpc('add_job_payment_promise' as never, {
            p_job_id: jobId,
            p_date: dateOrNull,
            p_said_by: saidBy.trim() || null,
            p_channel: channel,
            p_note: null,
          } as never)
          if (error) throw error
        } catch (e) {
          if (!isMissingRpc(e)) throw e
          const { error } = await supabase.rpc('set_job_promised_pay_date' as never, { p_job_id: jobId, p_date: dateOrNull } as never)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.rpc('set_job_promised_pay_date' as never, { p_job_id: jobId, p_date: null } as never)
        if (error) throw error
      }
      showToast(dateOrNull ? 'Promise saved.' : 'Promised date cleared — the promise stays on record.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the promise'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.45rem 0.6rem',
    fontSize: '0.9rem',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'inherit',
  } as const

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="They said — record a promised payment date"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(440px, calc(100vw - 2rem))' }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>They said…</h2>
        <p style={{ margin: '0.35rem 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {jobLabel} — the date the customer said this bill will be paid. It replaces the estimate on the board, and every
          date they name stays on record{initialYmd ? ' — a new date counts the earlier one as broken' : ''}.
        </p>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          Pay by
          <input type="date" value={ymd} onChange={(e) => setYmd(e.target.value)} aria-label="Promised payment date" style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.6rem 0 4px' }}>
          Who said it <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
          <input
            type="text"
            value={saidBy}
            onChange={(e) => setSaidBy(e.target.value.slice(0, 120))}
            placeholder="Tanya, their office"
            aria-label="Who said it"
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.6rem 0 4px' }}>How</div>
        <div role="radiogroup" aria-label="How they said it" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={channel === c.key}
              onClick={() => setChannel(c.key)}
              style={{
                padding: '0.3rem 0.7rem',
                fontSize: '0.8125rem',
                border: 'none',
                borderRight: '1px solid var(--border)',
                background: channel === c.key ? 'var(--text-link)' : 'var(--surface)',
                color: channel === c.key ? '#fff' : 'var(--text-muted)',
                fontWeight: channel === c.key ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <div>
            {initialYmd ? (
              <button
                type="button"
                onClick={() => void submit(null)}
                disabled={saving}
                title="Take the date off the board. The promise stays on record."
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                Clear date
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
