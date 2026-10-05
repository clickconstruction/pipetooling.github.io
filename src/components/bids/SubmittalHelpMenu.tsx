/**
 * The Submittals tab's one help door (2026-10-05), after the open bid's title: *? Help* opens a
 * short menu with each choice spelled out — the walkthrough, the words on the page, the written
 * guide. It took the place of three separate doors (the title's ?, *Words on this page*, and the
 * strip's *Walk me through it*). Each step keeps its own ? while it is open, to start the
 * walkthrough there.
 *
 * A menu, not a window: it closes on a choice, on Esc and on a click anywhere else.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const item: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.1rem', width: '100%', textAlign: 'left', padding: '0.45rem 0.6rem', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'none', boxSizing: 'border-box' }
const hint: CSSProperties = { fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }

export function SubmittalHelpMenu({ onWalkThrough, onWords, wordCount, guideHref }: {
  onWalkThrough: () => void
  onWords: () => void
  /** How many terms the words page explains. */
  wordCount: number
  guideHref: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const pick = (run: () => void) => () => {
    setOpen(false)
    run()
  }
  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="How this page works: a walkthrough, the words it uses, and the guide"
        style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: open ? 'var(--bg-blue-tint)' : 'var(--surface)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        data-testid="submittal-help"
      >
        ? Help
      </button>
      {open ? (
        <span role="menu" aria-label="Help with this page" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60, width: 'min(19rem, 80vw)', padding: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)', fontWeight: 400 }} data-testid="submittal-help-menu">
          <button type="button" role="menuitem" onClick={pick(onWalkThrough)} style={item} data-testid="submittal-help-walk">
            <b style={{ fontWeight: 600 }}>Walk me through it</b>
            <span style={hint}>About a minute, from the first step to the last.</span>
          </button>
          <button type="button" role="menuitem" onClick={pick(onWords)} style={item} data-testid="submittal-words">
            <b style={{ fontWeight: 600 }}>Words on this page</b>
            <span style={hint}>Cut sheet, revision, tag and {wordCount - 3} more.</span>
          </button>
          <a role="menuitem" href={guideHref} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} style={item} data-testid="submittal-help-guide">
            <b style={{ fontWeight: 600 }}>Open the guide</b>
            <span style={hint}>The full written guide, in a new tab.</span>
          </a>
        </span>
      ) : null}
    </span>
  )
}
