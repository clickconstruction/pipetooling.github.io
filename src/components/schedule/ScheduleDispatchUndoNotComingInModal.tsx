/**
 * Confirm modal for undoing a single-day "Not coming in" mark from the
 * Schedule Dispatch grid. Mirrors `RemoveScheduleBlockConfirmModal`'s style,
 * but uses positive blue for the confirm button (this restores normal
 * scheduling, it isn't a destructive action).
 */
export function ScheduleDispatchUndoNotComingInModal({
  open,
  busy,
  personLabel,
  workDateLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  personLabel: string
  workDateLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
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
        zIndex: 1004,
      }}
      onClick={() => {
        if (!busy) onCancel()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dispatch-undo-not-coming-in-title"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 440,
          width: '92%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="schedule-dispatch-undo-not-coming-in-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}
        >
          Remove the Not coming in mark?
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.875rem', lineHeight: 1.4 }}>
          {personLabel} on {workDateLabel} — they’ll be schedulable again.
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
              background: busy ? '#e5e7eb' : '#2563eb',
              color: busy ? '#6b7280' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Updating…' : 'Mark as coming in'}
          </button>
        </div>
      </div>
    </div>
  )
}
