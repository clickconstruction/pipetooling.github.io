import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { LienFooterMenu, LienFooterMenuRowKey } from '../../lib/jobs/lienFooterMenu'

/**
 * A draft footer's small menu (v2.7324): one plain press with a ▾, and above it the rare doors as rows — the
 * office's *He already okayed it ▾* (his word, the pen), the leader's *Sign another way ▾* (the pad, his code).
 * Opens on the press, closes on Escape, on a press outside and on a row; the arrow keys walk the rows. Each row
 * runs exactly what the old footer press ran; the host decides what that is from the row's key.
 */
export function LienFootMenu({ menu, onPick, disabled = false, style }: { menu: LienFooterMenu; onPick: (key: LienFooterMenuRowKey) => void; disabled?: boolean; style: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const pressRef = useRef<HTMLButtonElement | null>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    // The first row takes focus so the keyboard can pick one at once.
    const first = wrapRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    first?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      pressRef.current?.focus({ preventScroll: true })
    }
    const onPress = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPress)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPress)
    }
  }, [open])
  const walk = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = Array.from(wrapRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    if (!rows.length) return
    e.preventDefault()
    const at = rows.findIndex((r) => r === document.activeElement)
    const next = e.key === 'ArrowDown' ? (at + 1) % rows.length : (at - 1 + rows.length) % rows.length
    rows[next]?.focus({ preventScroll: true })
  }
  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }} data-lien-foot-menu={menu.key}>
      <button type="button" ref={pressRef} onClick={() => setOpen((o) => !o)} disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} style={style} data-lien-foot-menu-press>
        {menu.label}
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={menu.aria}
          onKeyDown={walk}
          style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 4px)', zIndex: 6, minWidth: 260, maxWidth: 'min(360px, calc(100vw - 2rem))', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)', overflow: 'hidden' }}
        >
          {menu.rows.map((row, i) => (
            <button
              key={row.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(row.key)
              }}
              title={row.title}
              data-lien-foot-menu-row={row.key}
              style={{ display: 'grid', gap: 2, width: '100%', padding: '0.45rem 0.75rem', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem', whiteSpace: 'normal' }}
            >
              <strong>{row.label}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{row.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
