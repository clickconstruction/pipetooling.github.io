import { useEffect } from 'react'

/**
 * Destructive-confirm dialog for removing a superintendent's project-level
 * access. Mirrors the layout of `ScheduleDispatchUndoNotComingInModal` but
 * uses a red confirm button because the action is destructive.
 */
export function RemoveProjectSuperintendentConfirmModal({
  open,
  busy,
  personLabel,
  projectName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  personLabel: string
  projectName: string
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
        aria-labelledby="remove-project-superintendent-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 440,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="remove-project-superintendent-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}
        >
          Remove this superintendent?
        </h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-700)', fontSize: '0.875rem', lineHeight: 1.4 }}>
          {personLabel} will no longer have access to {projectName}.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.875rem',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border-strong)',
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
              background: busy ? 'var(--bg-200)' : '#b91c1c',
              color: busy ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Removing\u2026' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}
