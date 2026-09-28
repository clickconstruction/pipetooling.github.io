/**
 * The My Time day editor's "Reject clock session?" confirm. JSX only — the write (the
 * `rejected_at` UPDATE paired with the `people_hours` resync), the busy id and the error stay in
 * the editor (MY_TIME_DAY_EDITOR_MODAL map, quirk 7).
 */
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import { formatDenverTimeOnly } from '../../utils/dateUtils'

export type MyTimeRejectSessionDialogProps = {
  /** The session being rejected; null renders nothing. */
  session: DayEditorSession | null
  /** The work date, written out. */
  dateLabel: string
  /** A reject is in flight: both buttons are disabled. The backdrop calls `onCancel`, which the editor guards. */
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (session: DayEditorSession) => void
  zIndex: number
}

export function MyTimeRejectSessionDialog({
  session,
  dateLabel,
  busy,
  error,
  onCancel,
  onConfirm,
  zIndex,
}: MyTimeRejectSessionDialogProps) {
  if (!session) return null
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="reject-session-dialog-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reject-session-dialog-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
          Reject clock session?
        </h3>
        <p
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatDenverTimeOnly(new Date(session.clocked_in_at).getTime())} –{' '}
          {session.clocked_out_at
            ? formatDenverTimeOnly(new Date(session.clocked_out_at).getTime())
            : ''}
          {` · ${dateLabel}`}
        </p>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          This session will no longer count toward hours until restored by staff.
        </p>
        {session.approved_at != null ? (
          <p
            style={{
              margin: '0 0 1rem 0',
              fontSize: '0.875rem',
              color: 'var(--text-amber-800)',
              background: 'var(--bg-amber-tint)',
              border: '1px solid var(--border-amber)',
              borderRadius: 6,
              padding: '0.65rem 0.75rem',
              lineHeight: 1.5,
            }}
          >
            This session was already approved. Rejecting removes those hours from payroll until it is approved
            again.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            style={{
              margin: '0 0 0.75rem 0',
              fontSize: '0.8125rem',
              color: 'var(--text-red-700)',
              background: 'var(--bg-red-tint)',
              border: '1px solid #fecaca',
              borderRadius: 6,
              padding: '0.5rem 0.65rem',
              lineHeight: 1.45,
            }}
          >
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(session)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #dc2626',
              borderRadius: 6,
              background: 'var(--bg-red-tint)',
              color: 'var(--text-red-700)',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Rejecting…' : 'Reject session'}
          </button>
        </div>
      </div>
    </div>
  )
}
