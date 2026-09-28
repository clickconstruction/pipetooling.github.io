/**
 * The My Time day editor's "Discard unsaved changes?" confirm. JSX only — the open flag, the
 * Escape order and `requestDiscard` stay in the editor (MY_TIME_DAY_EDITOR_MODAL map, quirk 14).
 */

export type MyTimeDiscardChangesConfirmProps = {
  open: boolean
  /** Whose day it is, as the editor's title names them. */
  personLabel: string
  /** The work date, written out. */
  dateLabel: string
  onKeepEditing: () => void
  onDiscard: () => void
  zIndex: number
}

export function MyTimeDiscardChangesConfirm({
  open,
  personLabel,
  dateLabel,
  onKeepEditing,
  onDiscard,
  zIndex,
}: MyTimeDiscardChangesConfirmProps) {
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
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        onKeepEditing()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-changes-confirm-title"
        aria-describedby="discard-changes-confirm-desc"
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
          id="discard-changes-confirm-title"
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.05rem',
            fontWeight: 600,
            color: 'var(--text-strong)',
            lineHeight: 1.35,
          }}
        >
          Discard unsaved changes?
        </h2>
        <p
          id="discard-changes-confirm-desc"
          style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}
        >
          You have unsaved changes to <strong>{personLabel}</strong>&rsquo;s time for{' '}
          <strong>{dateLabel}</strong>. Closing now will discard them.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onKeepEditing}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              background: 'var(--surface)',
              cursor: 'pointer',
            }}
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #dc2626',
              borderRadius: 6,
              background: 'var(--bg-red-tint)',
              color: 'var(--text-red-700)',
              cursor: 'pointer',
            }}
          >
            Discard changes
          </button>
        </div>
      </div>
    </div>
  )
}
