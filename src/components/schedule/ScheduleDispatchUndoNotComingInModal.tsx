import { undoNotComingInCopy } from '../../lib/scheduleDispatchNotComingInCopy'

/**
 * Confirm modal for undoing a single-day "Not coming in" mark from the
 * Schedule Dispatch grid. Mirrors `RemoveScheduleBlockConfirmModal`'s style,
 * but uses positive blue for the confirm button (this restores normal
 * scheduling, it isn't a destructive action). Copy lives in
 * `lib/scheduleDispatchNotComingInCopy.ts` — including the J18-F3 honesty
 * line: the undo never re-creates blocks the mark removed.
 */
export function ScheduleDispatchUndoNotComingInModal({
  open,
  busy,
  personLabel,
  workDateLabel,
  onCancel,
  onConfirm,
  isNcns = false,
}: {
  open: boolean
  busy: boolean
  personLabel: string
  workDateLabel: string
  onCancel: () => void
  onConfirm: () => void
  /** NCNS chip (v2.2540): sterner copy — clearing the mark never deletes the attendance incident. */
  isNcns?: boolean
}) {
  if (!open) return null
  const copy = undoNotComingInCopy({ personLabel, workDateLabel, isNcns })
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
          id="schedule-dispatch-undo-not-coming-in-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}
        >
          {copy.title}
        </h2>
        <p style={{ margin: '0 0 0.5rem', color: 'var(--text-700)', fontSize: '0.875rem', lineHeight: 1.4 }}>
          {copy.lead}
        </p>
        {copy.blocksNote ? (
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-700)', fontSize: '0.875rem', lineHeight: 1.4 }}>
            {copy.blocksNote}
          </p>
        ) : null}
        {copy.ncnsNote ? (
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-700)', fontSize: '0.875rem', lineHeight: 1.4 }}>
            <strong>{copy.ncnsNote}</strong>
          </p>
        ) : null}
        <div style={{ height: '0.5rem' }} />
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
              background: busy ? 'var(--bg-200)' : '#2563eb',
              color: busy ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Updating…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
