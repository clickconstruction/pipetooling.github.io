import { useRef } from 'react'

export type PayStubViewModalProps = {
  /** Dialog title, e.g. "Pay report — Taunya (6/22 – 6/28)". */
  title: string
  /** Full pay-stub HTML document from buildPayStubHtml — rendered in a sandboxed-by-origin iframe. */
  html: string
  zIndex: number
  onClose: () => void
}

/**
 * In-app viewer for a generated pay stub: the built HTML document renders in an iframe
 * (it is a complete `<!DOCTYPE html>` document with its own styles), and Print calls the
 * iframe window's print() so only the stub prints — not the app page.
 */
export function PayStubViewModal({ title, html, zIndex, onClose }: PayStubViewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  function handlePrint() {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.focus()
    win.print()
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-stub-view-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 900,
          width: '100%',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <h2 id="pay-stub-view-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, flex: 1, minWidth: 200 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '0.4rem 0.9rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            style={{
              padding: '0.4rem 0.7rem',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ×
          </button>
        </div>
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          style={{ flex: 1, width: '100%', border: 'none', background: 'var(--surface)' }}
        />
      </div>
    </div>
  )
}
