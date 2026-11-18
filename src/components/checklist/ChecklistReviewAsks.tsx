/**
 * Checklist → Review, the two things the board raises over itself: the bar that offers Undo after a tick, and the
 * ask before a task is deleted. Each is markup over what it is handed; the tab keeps every state and every write.
 * They sat inside `ChecklistOutstandingTab` until v2.7766 (CHECKLIST_TABS map).
 */

/** The bar after a tick: what was finished, Undo, and the five seconds draining. Draws nothing with no tick to undo. */
export function ReviewUndoBar({ toast, onUndo }: { toast: { title: string; count: number } | null; onUndo: () => void }) {
  if (!toast) return null
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        zIndex: 1001,
        width: 'min(560px, calc(100vw - 24px))',
        background: 'var(--text-strong)',
        color: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
        padding: '0.75rem 0.9rem 0.9rem',
        overflow: 'hidden',
      }}
    >
      <style>{'@keyframes checklist-undo-drain { from { width: 100% } to { width: 0% } }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          ✓ Completed{toast.count > 1 ? ` ×${toast.count}` : ''} — {toast.title}
        </span>
        <button
          type="button"
          onClick={onUndo}
          style={{
            flexShrink: 0,
            minHeight: 40,
            padding: '0 1.1rem',
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: '#4ade80',
            background: 'transparent',
            border: '1.5px solid #4ade80',
            borderRadius: 9,
            cursor: 'pointer',
          }}
        >
          Undo
        </button>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          background: '#4ade80',
          animation: 'checklist-undo-drain 5s linear forwards',
        }}
      />
    </div>
  )
}

/**
 * The ask before an open task is deleted. `missedCount` is how many missed copies the row stands for; `deletingInstanceId`
 * is the row a delete is running on, which holds Cancel and the click outside until it ends.
 */
export function OutstandingDeleteAsk({
  pending,
  missedCount,
  deletingInstanceId,
  onCancel,
  onDelete,
}: {
  pending: { id: string; scheduled_date: string; checklist_items?: { title?: string } | null } | null
  missedCount: number
  deletingInstanceId: string | null
  onCancel: () => void
  onDelete: () => void
}) {
  if (!pending) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 755,
        padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem',
      }}
      onClick={() => {
        if (deletingInstanceId) return
        onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-outstanding-delete-title"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          minWidth: 320,
          maxWidth: 480,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="checklist-outstanding-delete-title"
          style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
        >
          Delete outstanding task?
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
          <strong>{pending.checklist_items?.title ?? '—'}</strong>
          <span style={{ color: 'var(--text-muted)' }}> ({pending.scheduled_date})</span>
        </p>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {missedCount > 1
            ? `Removes all ${missedCount} missed copies of this task. This cannot be undone.`
            : 'This cannot be undone.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { if (!deletingInstanceId) onCancel() }}
            disabled={deletingInstanceId === pending.id}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-200)',
              color: 'var(--text-700)',
              border: 'none',
              borderRadius: 4,
              cursor: deletingInstanceId ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deletingInstanceId === pending.id}
            style={{
              padding: '0.5rem 1rem',
              background: '#b91c1c',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: deletingInstanceId === pending.id ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {deletingInstanceId === pending.id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
