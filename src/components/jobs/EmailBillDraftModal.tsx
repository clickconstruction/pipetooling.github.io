import { useEffect, type CSSProperties } from 'react'

const preBox: CSSProperties = {
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
}

export function EmailBillDraftModal({
  open,
  onClose,
  subject,
  body,
  onCopy,
  onOpenMailto,
  showOpenInEmailApp,
  overlayZIndex = 1300,
}: {
  open: boolean
  onClose: () => void
  subject: string
  body: string
  onCopy: () => void
  onOpenMailto: () => void
  showOpenInEmailApp: boolean
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
        aria-labelledby="email-bill-draft-title"
        style={{
          background: 'white',
          borderRadius: 8,
          minWidth: 280,
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(85vh, 560px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="email-bill-draft-title" style={{ margin: 0, padding: '1rem 1rem 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Email Bill Draft
        </h2>
        <div style={{ padding: '0 1rem', flex: '1 1 auto', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: '#6b7280' }}>Subject</p>
            <pre style={{ ...preBox, maxHeight: 120 }}>{subject}</pre>
          </div>
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.8125rem', color: '#6b7280' }}>Email draft</p>
            <pre style={{ ...preBox, flex: '1 1 auto', overflow: 'auto', maxHeight: 280 }}>{body}</pre>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
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
          {showOpenInEmailApp ? (
            <button
              type="button"
              onClick={() => onOpenMailto()}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                background: 'white',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Open in email app
            </button>
          ) : null}
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
