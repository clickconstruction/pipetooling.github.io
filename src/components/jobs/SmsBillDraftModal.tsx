import { useEffect } from 'react'

export function SmsBillDraftModal({
  open,
  onClose,
  text,
  onCopy,
  overlayZIndex = 1300,
}: {
  open: boolean
  onClose: () => void
  text: string
  onCopy: () => void
  /** Above Bill Customer (1020), View bill stacks, etc. */
  overlayZIndex?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sms-bill-draft-title"
        style={{
          background: 'white',
          borderRadius: 8,
          minWidth: 280,
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(70vh, 420px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sms-bill-draft-title" style={{ margin: 0, padding: '1rem 1rem 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
          SMS Bill Draft
        </h2>
        <p style={{ margin: '0 1rem 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>SMS draft</p>
        <div style={{ padding: '0 1rem', flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
              color: '#111827',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '0.65rem 0.75rem',
            }}
          >
            {text}
          </pre>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            padding: '1rem',
            flexShrink: 0,
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onCopy()}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: '#2563eb',
              color: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}
