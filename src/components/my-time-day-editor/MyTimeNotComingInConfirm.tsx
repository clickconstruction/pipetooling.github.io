/**
 * The My Time day editor's "Not coming in" pieces: the footer button (mounted in both footers)
 * and its confirm. No data — the editor's `onMarkNotComingIn` prop does the work; the open and
 * busy flags stay in the editor, where `closeTopmostSubFlow` reads them.
 */

export type MyTimeNotComingInButtonProps = {
  busy: boolean
  /** The editable footer also holds the button while a save is in flight. */
  disabled?: boolean
  onClick: () => void
}

export function MyTimeNotComingInButton({ busy, disabled = false, onClick }: MyTimeNotComingInButtonProps) {
  const held = disabled || busy
  return (
    <button
      type="button"
      disabled={held}
      onClick={onClick}
      title="Add unpaid day off; they can still clock in"
      style={{
        padding: '0.35rem 0.65rem',
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: '#6b21a8',
        background: '#f3e8ff',
        border: '1px solid #e9d5ff',
        borderRadius: 6,
        cursor: held ? 'not-allowed' : 'pointer',
      }}
    >
      {busy ? '…' : 'Not coming in'}
    </button>
  )
}

export type MyTimeNotComingInConfirmProps = {
  open: boolean
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
  zIndex: number
}

export function MyTimeNotComingInConfirm({ open, busy, onCancel, onConfirm, zIndex }: MyTimeNotComingInConfirmProps) {
  if (!open) return null
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
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return
        onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-not-coming-in-confirm-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          border: '1px solid var(--border)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="mark-not-coming-in-confirm-title"
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'var(--text-strong)',
            lineHeight: 1.35,
          }}
        >
          Not coming in
        </h2>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
          Mark this person as not coming in on this day? This adds unpaid time off on the calendar. They can still
          clock in if plans change.
        </p>
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
            onClick={onConfirm}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#6b21a8',
              background: '#f3e8ff',
              border: '1px solid #e9d5ff',
              borderRadius: 6,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? '…' : 'Mark not coming in'}
          </button>
        </div>
      </div>
    </div>
  )
}
