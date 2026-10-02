import { useEffect, useRef } from 'react'
import type { EmailPreview } from '../../hooks/useEmailPreview'
import { previewFrameHtml } from '../../lib/jobsDocuments/previewFrame'

/**
 * An email, exactly as it will arrive, over the window that asked for it
 * (v2.4250): full size, in a sandboxed frame, with Back. It replaced the
 * separate browser window for GC Review's previews — there is nothing to allow
 * and nothing to go and find, and the dialog underneath keeps what was typed.
 */
export function EmailPreviewOverlay({ preview, onClose }: { preview: EmailPreview; onClose: () => void }) {
  const backRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    backRef.current?.focus()
    // Capture phase: Escape closes the preview alone, never the window under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${preview.title}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 766,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        // The Dispatch / Job mode footer stands over every window: the email ends above it.
        paddingBottom: 'max(var(--app-bottom-chrome, 0px), env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <button
          ref={backRef}
          type="button"
          onClick={onClose}
          style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', flexShrink: 0 }}
        >
          ← Back
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Preview. Nothing has been sent.</div>
        </div>
      </div>
      {preview.html === null ? (
        <p role="status" style={{ margin: 0, padding: '1.25rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Building the preview…
        </p>
      ) : (
        <iframe
          title={`Preview: ${preview.title}`}
          // No scripts, no forms; a link opens a tab of its own (previewFrameHtml sets the target).
          // allow-same-origin keeps the frame in this page's process, so the email paints at once
          // (a fully sandboxed frame waits on a process of its own); with scripts off it grants nothing.
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={previewFrameHtml(preview.html)}
          style={{ flex: '1 1 auto', minHeight: 0, width: '100%', border: 'none', display: 'block', background: 'var(--bg-page)' }}
        />
      )}
    </div>
  )
}
