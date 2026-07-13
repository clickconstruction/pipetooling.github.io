import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { defaultClockOutLocal } from '../../lib/forceClockOutDefaultOut'
import { fromDatetimeLocal } from '../../utils/datetimeLocal'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type ForceClockOutSession = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  approved_at: string | null
}

export type ForceClockOutModalProps = {
  session: ForceClockOutSession
  onClose: () => void
  onSaved?: () => void
  showToast?: (message: string, variant?: 'success' | 'error' | 'warning' | 'info') => void
  zIndex?: number
}

export function ForceClockOutModal({
  session,
  onClose,
  onSaved,
  showToast,
  zIndex = 1110,
}: ForceClockOutModalProps) {
  const [clockOutLocal, setClockOutLocal] = useState(() => defaultClockOutLocal(session.clocked_in_at))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setClockOutLocal(defaultClockOutLocal(session.clocked_in_at))
    setError(null)
  }, [session.id, session.clocked_in_at])

  async function handleSubmit() {
    setError(null)
    const outIso = fromDatetimeLocal(clockOutLocal)
    if (!outIso) {
      setError('Clock out time is required.')
      return
    }
    const inMs = new Date(session.clocked_in_at).getTime()
    const outMs = new Date(outIso).getTime()
    if (outMs <= inMs) {
      setError('Clock out must be after clock in.')
      return
    }
    const nowMs = Date.now()
    if (outMs > nowMs) {
      setError('Clock out cannot be in the future.')
      return
    }

    if (session.approved_at) {
      const ok = window.confirm(
        'This session was already approved. Setting clock-out will change recorded hours and may require re-approval. Continue?',
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({ clocked_out_at: outIso })
            .eq('id', session.id),
        'force clock out',
      )
      showToast?.('Clock out saved.', 'success')
      onSaved?.()
      onClose()
    } catch (e: unknown) {
      setError(formatErrorMessage(e, 'Failed to save clock out'))
    } finally {
      setSaving(false)
    }
  }

  const clockInLabel = new Date(session.clocked_in_at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: APP_CALENDAR_TZ,
  })

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-clock-out-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h2 id="force-clock-out-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
          Force clock out and fix hours
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Sets when they stopped working. If the session is not yet approved, hours still flow through the usual approve flow.
        </p>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.25rem' }}>
            Clock in
          </span>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-strong)' }}>{clockInLabel}</div>
        </div>
        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.25rem' }}>
            Clock out (correct time)
          </span>
          <input
            type="datetime-local"
            value={clockOutLocal}
            onChange={(e) => setClockOutLocal(e.target.value)}
            disabled={saving}
            style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', width: '100%', maxWidth: 280 }}
          />
        </label>
        {error ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }} role="alert">
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            style={{
              padding: '0.45rem 0.85rem',
              border: 'none',
              borderRadius: 4,
              background: '#ea580c',
              color: 'white',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
