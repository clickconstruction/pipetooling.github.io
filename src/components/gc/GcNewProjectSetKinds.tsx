import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { SET_KIND_HELP } from '../../lib/gc/setKinds'

/**
 * GC mode design spike: what the kinds of plan sets are (the owner, 2026-10-04: "Perhaps as a
 * information icon to the right of the three plan set choosers"). An ⓘ after the chips opens a
 * card on hover, on focus or on a click (a click keeps it open): one part a kind, in the chips'
 * order, each saying when it comes, who gets it, what is in it and what it is for.
 */

/** Above the windows (1200) and the book's window (1250), with the pickers' lists. */
const OVER_THE_WINDOW = 1300

const ROWS: { key: 'when' | 'who' | 'inIt' | 'forWhat'; label: string }[] = [
  { key: 'when', label: 'When it comes' },
  { key: 'who', label: 'Who gets it' },
  { key: 'inIt', label: 'What is in it' },
  { key: 'forWhat', label: 'What it is for' },
]

export function SetKindsInfo() {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [place, setPlace] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null)
  const open = pinned || hovered

  const hoverOn = () => {
    if (leave.current) clearTimeout(leave.current)
    setHovered(true)
  }
  // A short wait, so the pointer can cross from the button to the card.
  const hoverOff = () => {
    if (leave.current) clearTimeout(leave.current)
    leave.current = setTimeout(() => setHovered(false), 180)
  }
  useEffect(() => () => {
    if (leave.current) clearTimeout(leave.current)
  }, [])

  // Below the button when there is room, above it when not; never past the screen's edges.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const r = button.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.min(544, window.innerWidth - 32)
      const left = Math.max(16, Math.min(r.left - 24, window.innerWidth - width - 16))
      const below = window.innerHeight - r.bottom - 16
      const above = r.top - 16
      setPlace(
        below >= 280 || below >= above
          ? { top: r.bottom + 6, left, width, maxHeight: Math.max(160, below - 6) }
          : { bottom: window.innerHeight - r.top + 6, left, width, maxHeight: Math.max(160, above - 6) },
      )
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  // Escape closes the card first, never the window under it; a press elsewhere closes a kept-open card.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setPinned(false)
      setHovered(false)
    }
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      if (button.current?.contains(t) || card.current?.contains(t)) return
      setPinned(false)
      setHovered(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', away)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', away)
    }
  }, [open])

  const circle: CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${open ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
    background: open ? 'var(--bg-blue-tint)' : 'var(--surface)',
    color: open ? 'var(--text-blue-500)' : 'var(--text-600)',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
    fontWeight: 700,
    fontSize: '0.85rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label="What a bid set, a pricing set and a permit set are"
        aria-expanded={open}
        aria-controls={id}
        title="What these kinds of plans are"
        onClick={() => setPinned((p) => !p)}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
        onFocus={hoverOn}
        onBlur={hoverOff}
        style={circle}
      >
        i
      </button>
      {open &&
        place &&
        createPortal(
          <div
            ref={card}
            id={id}
            role="dialog"
            aria-label="The kinds of plan sets"
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
            style={{
              position: 'fixed',
              ...(place.top !== undefined ? { top: place.top } : { bottom: place.bottom }),
              left: place.left,
              width: place.width,
              maxHeight: place.maxHeight,
              overflowY: 'auto',
              zIndex: OVER_THE_WINDOW,
              background: 'var(--surface)',
              color: 'var(--text-base)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.22)',
              padding: '0.7rem 0.85rem',
              display: 'grid',
              gap: '0.75rem',
              fontSize: '0.83rem',
              lineHeight: 1.4,
            }}
          >
            {SET_KIND_HELP.map((k, i) => (
              <section key={k.kind} style={{ display: 'grid', gap: '0.3rem', paddingTop: i > 0 ? '0.65rem' : 0, borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                <div>
                  <strong style={{ fontSize: '0.92rem' }}>{k.kind}</strong>
                  {k.alsoCalled && <span style={{ color: 'var(--text-muted)' }}> {k.alsoCalled}</span>}
                </div>
                {ROWS.map((row) => (
                  <div key={row.key} style={{ display: 'grid', gridTemplateColumns: place.width >= 420 ? '7.2rem minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: '0.1rem 0.6rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', paddingTop: '0.12rem' }}>{row.label}</span>
                    <span>{k[row.key]}</span>
                  </div>
                ))}
              </section>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
