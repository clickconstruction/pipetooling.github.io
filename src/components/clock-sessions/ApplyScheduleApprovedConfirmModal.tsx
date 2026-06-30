import { useEffect } from 'react'

/**
 * Confirm dialog shown before "Apply Schedule %" splits an already-approved clock session.
 * Mirrors the layout of `RemoveProjectSuperintendentConfirmModal`; the action removes payroll
 * hours until a lead re-approves, so the confirm button is amber (caution, not destructive).
 */
export function ApplyScheduleApprovedConfirmModal({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
      }}
      onClick={() => {
        if (!busy) onCancel()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-schedule-approved-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 460,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="apply-schedule-approved-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
          Split an approved session?
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.875rem', lineHeight: 1.45 }}>
          This session was already approved. Splitting it across scheduled jobs will remove those
          hours from payroll until a lead re-approves the new segments.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: busy ? '#e5e7eb' : '#b45309',
              color: busy ? '#6b7280' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Applying…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
