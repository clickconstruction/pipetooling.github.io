type WorkingBoardArchiveConfirmDialogProps = {
  bidId: string | null
  label: string | null
  onCancel: () => void
  onConfirm: (bidId: string) => void
}

export function WorkingBoardArchiveConfirmDialog({ bidId, label, onCancel, onConfirm }: WorkingBoardArchiveConfirmDialogProps) {
  if (!bidId) return null
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="working-board-archive-confirm-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        role="document"
        style={{
          background: '#fff',
          borderRadius: 8,
          maxWidth: 420,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="working-board-archive-confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Archive this bid from Unsent/Working?
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
          <strong style={{ color: '#111827' }}>{label ?? 'this bid'}</strong> will be hidden from your Working
          board, Bid Board unsent lists, and Clock In quick picks. Column placement stays on the board. Restore from{' '}
          <strong>Bid Board</strong> → <strong>Archived</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '0.5rem 0.85rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(bidId)}
            style={{
              padding: '0.5rem 0.85rem',
              border: 'none',
              borderRadius: 4,
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
