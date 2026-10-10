/**
 * The Workflow page's error banner (v2.5108, the map's quirk 21): a refused action on a page that
 * is already drawn shows here, pinned to the top while the page scrolls, instead of replacing the
 * page. It draws the message it is handed and never composes one — the words come from the write
 * that failed (`projectionWriteError` and its siblings). Dismiss clears it; so does the next
 * action, which clears the page's error before it writes.
 */
export function WorkflowErrorBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null
  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 'var(--app-top-chrome, 0px)',
        zIndex: 5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '0.6rem 0.75rem',
        border: '1px solid var(--border-red)',
        borderRadius: 6,
        background: 'var(--bg-red-tint)',
        color: 'var(--text-red-700)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
        style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '1.1rem', lineHeight: 1, padding: '0 0.25rem' }}
      >
        ×
      </button>
    </div>
  )
}
