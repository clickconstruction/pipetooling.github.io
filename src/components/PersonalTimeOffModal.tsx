import { TimeOffSettings } from './TimeOffSettings'

/**
 * Personal Time Off in a modal (v2.1544): wraps the unchanged TimeOffSettings
 * component (entries list, "Not coming in today", add form, salary-session
 * sync). Opened from the Dashboard My Time section's button and the Calendar's
 * time-off chips — the former Settings → Your account section moved here.
 */
export function PersonalTimeOffModal({
  open,
  userId,
  onClose,
}: {
  open: boolean
  userId: string
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Personal Time Off"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: '96%',
          maxWidth: 480,
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: '1rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Personal Time Off</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Personal Time Off"
            style={{
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 999,
              padding: '0.25rem 0.6rem',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              color: 'var(--text-700)',
            }}
          >
            ✕
          </button>
        </div>
        <TimeOffSettings userId={userId} />
      </div>
    </div>
  )
}
