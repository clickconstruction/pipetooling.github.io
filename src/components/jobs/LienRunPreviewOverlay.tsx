import { useEffect, useRef, type CSSProperties } from 'react'
import { stepRunPreview, type RunCopyPage } from '../../lib/jobs/lienDeskRun'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * Send the run — read a copy before it prints (v2.4621).
 *
 * A layer over the run window, which stays mounted underneath with its
 * tracking numbers and ticks untouched. One entry per copy in packet order
 * (envelope by envelope, the owner's copy then the original contractor's);
 * ‹ › and the arrow keys walk the packet without closing, Esc closes only
 * this. The pages are the ones `runCopyPages` gives the printed packet, so
 * the preview can never differ from the paper. Read-only, as the GC-notice
 * preview is (`GcNoticePreviewModal`).
 */
export type LienRunPreviewEntry = {
  key: string
  /** "273 · Dudley (Lennox) · owner of record" */
  title: string
  /** "Envelope 1 · Owner of record KHAN UMAR … · 3203 Spider Lily …" */
  envelopeLine: string
  pages: ReadonlyArray<RunCopyPage>
}

type Props = {
  entries: ReadonlyArray<LienRunPreviewEntry>
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}

const faint: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const pageHead: CSSProperties = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const navBtn = (disabled: boolean): CSSProperties => ({ padding: '3px 9px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.9rem', lineHeight: 1.2, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 })
/** The paper stays light in both themes — `data-theme="light"` re-pins the tokens and the text color (index.css), as on the desk. */
const paperStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', padding: '1.1rem 1.4rem', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }
const kbd: CSSProperties = { fontSize: '0.7rem', border: '1px solid var(--border-strong)', borderBottomWidth: 2, borderRadius: 4, padding: '0 5px', background: 'var(--surface)' }

export default function LienRunPreviewOverlay({ entries, index, onIndex, onClose }: Props) {
  const isMobile = useIsMobile()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const paperScrollRef = useRef<HTMLDivElement | null>(null)
  const total = entries.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const entry = entries[safeIndex]

  // Esc closes only the preview; the arrows walk the packet. Capture, so the run window underneath never sees the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.stopPropagation()
      e.preventDefault()
      if (e.key === 'Escape') onClose()
      else onIndex(stepRunPreview(safeIndex, e.key === 'ArrowRight' ? 1 : -1, total))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, onIndex, safeIndex, total])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  // A new copy starts at its first page.
  useEffect(() => {
    if (paperScrollRef.current) paperScrollRef.current.scrollTop = 0
  }, [safeIndex])

  if (!entry) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Copy preview"
      data-testid="lien-run-preview"
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 795 }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 10, width: 'min(880px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} data-testid="lien-run-preview-title">{entry.title}</h2>
            <div style={faint} data-testid="lien-run-preview-envelope">{entry.envelopeLine}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
            <button type="button" aria-label="Previous copy" disabled={safeIndex === 0} onClick={() => onIndex(stepRunPreview(safeIndex, -1, total))} style={navBtn(safeIndex === 0)}>‹</button>
            <span data-testid="lien-run-preview-count">{safeIndex + 1} of {total}</span>
            <button type="button" aria-label="Next copy" disabled={safeIndex >= total - 1} onClick={() => onIndex(stepRunPreview(safeIndex, 1, total))} style={navBtn(safeIndex >= total - 1)}>›</button>
            <button ref={closeRef} type="button" aria-label="Close preview" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '2px 6px', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div ref={paperScrollRef} style={{ overflow: 'auto', minHeight: 0, display: 'grid', gap: '0.6rem', padding: isMobile ? '0.6rem' : '0.85rem', background: 'var(--bg-muted)', alignContent: 'start' }}>
          {entry.pages.map((pg, i) => (
            <div key={`${entry.key}-${i}`} style={{ display: 'grid', gap: 4 }}>
              <div style={pageHead} data-testid="lien-run-preview-page-label">{`Page ${i + 1} of ${entry.pages.length} · ${pg.label}`}</div>
              <div data-theme="light" style={paperStyle}>
                <div dangerouslySetInnerHTML={{ __html: pg.html }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', ...faint }}>
          <span>Read-only: what the packet prints for this copy, from the run as it stands now.</span>
          {isMobile ? null : <span><span style={kbd}>←</span> <span style={kbd}>→</span> next copy · <span style={kbd}>Esc</span> back to the run</span>}
        </div>
      </div>
    </div>
  )
}
