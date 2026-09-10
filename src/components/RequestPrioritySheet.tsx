import { useState } from 'react'
import AutosizeTextarea from './AutosizeTextarea'
import { formatPriorityChangeNote, LOWER_PRIORITY_REASONS, type LowerPriorityReasonKey } from '../lib/requestPriority'

/**
 * Lower / raise priority on an inbox request (Customer Waiting, v2.3247).
 * Lowering asks why in one tap — Scheduled · Not urgent · Spam or duplicate ·
 * Other — plus an optional note; the pair goes into the thread as
 * "Priority lowered — Scheduled: Thu 9/12, 8–10 am", so a week later the
 * request still tells its own story. Raising just takes the optional note.
 */
export function RequestPrioritySheet({
  direction,
  requestLabel,
  saving,
  onConfirm,
  onClose,
}: {
  direction: 'lower' | 'raise'
  /** e.g. "Jane Doe · asks for a visit" */
  requestLabel: string
  saving: boolean
  onConfirm: (note: string | null) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState<LowerPriorityReasonKey | null>(direction === 'lower' ? 'scheduled' : null)
  const [note, setNote] = useState('')
  const reasonLabel = direction === 'lower' ? (LOWER_PRIORITY_REASONS.find((r) => r.key === reason)?.label ?? null) : null
  const lowering = direction === 'lower'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lowering ? 'Lower priority' : 'Raise priority'}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.1rem 1.25rem', borderRadius: 12, width: 'min(440px, 100%)', boxSizing: 'border-box', display: 'grid', gap: '0.75rem' }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{lowering ? 'Lower priority — why?' : 'Raise priority'}</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {requestLabel}
            {lowering
              ? ' · One tap. It goes in the thread so the request keeps its story, and the banner ends for everyone.'
              : ' · Marks it a customer waiting: red rail, top of the list, banner for the whole team.'}
          </p>
        </div>
        {lowering ? (
          <div role="radiogroup" aria-label="Reason" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LOWER_PRIORITY_REASONS.map((r) => {
              const on = r.key === reason
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(r.key)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 999,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${on ? '#93c5fd' : 'var(--border)'}`,
                    background: on ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                    color: on ? 'var(--text-blue-700)' : 'var(--text-strong)',
                  }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        ) : null}
        <label style={{ display: 'block' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{lowering ? 'Note (optional)' : 'Why (optional)'}</span>
          <AutosizeTextarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            minRows={2}
            maxLength={500}
            placeholder={lowering ? 'Thu 9/12, 8–10 am, Sam going' : 'Gas smell at the meter — needs a truck today'}
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.5rem', fontFamily: 'inherit', fontSize: '0.9375rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(formatPriorityChangeNote(reasonLabel, note))}
            disabled={saving}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: saving ? 'var(--bg-muted)' : lowering ? '#2563eb' : '#dc2626', color: saving ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : lowering ? 'Lower priority' : 'Raise priority'}
          </button>
        </div>
      </div>
    </div>
  )
}
