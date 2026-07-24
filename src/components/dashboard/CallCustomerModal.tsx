import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import AutosizeTextarea from '../AutosizeTextarea'

/**
 * Mis-click guard + call log for the Dashboard phone icons (v2.995): tapping
 * the phone opens this modal instead of dialing straight away. The number is
 * one big tappable target (tel:), and after (or instead of) calling the tech
 * can jot notes about the call — saved as a normal `jobs_ledger_thread_notes`
 * row with a 📞 prefix, so it shows on every job activity thread across the
 * app (Stages panel, activity modals, customer summary). The baseline INSERT
 * policy already admits team-member/scheduled subs & helpers, so no RPC.
 */
export default function CallCustomerModal({
  phone,
  jobId,
  jobLabel,
  onClose,
}: {
  phone: string
  jobId: string
  /** e.g. "928 · Willow Brook Apartments" — shown so the user knows which job they tapped. */
  jobLabel: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const logCall = async () => {
    const trimmed = notes.trim()
    if (!user?.id || !trimmed || saving) return
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('jobs_ledger_thread_notes').insert({
            job_id: jobId,
            author_user_id: user.id,
            body: `📞 Call ${phone}: ${trimmed}`,
          }),
        'log call thread note',
      )
      showToast('Call note added to the job activity thread.', 'success')
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the call note'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call customer for ${jobLabel}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 8,
          width: 'min(420px, calc(100vw - 2rem))',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Call customer</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: 'var(--text-muted)', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '-0.5rem -0.5rem 0 0' }}
          >
            ×
          </button>
        </div>
        <button
          type="button"
          onClick={() => openInExternalBrowser(`tel:${phone}`)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '0.9rem',
            padding: '0.8rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            background: '#15803d',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {phone}
        </button>
        <label style={{ display: 'block', marginTop: '0.9rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Notes about the call</span>
          <AutosizeTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minRows={2}
            placeholder="Who you talked to, what was agreed…"
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.5rem', fontFamily: 'inherit', fontSize: '0.9375rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => void logCall()}
            disabled={!notes.trim() || saving}
            style={{
              padding: '0.45rem 0.9rem',
              fontSize: '0.875rem',
              background: !notes.trim() || saving ? 'var(--bg-muted)' : '#3b82f6',
              color: !notes.trim() || saving ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: !notes.trim() || saving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {saving ? 'Saving…' : 'Log call'}
          </button>
        </div>
      </div>
    </div>
  )
}
