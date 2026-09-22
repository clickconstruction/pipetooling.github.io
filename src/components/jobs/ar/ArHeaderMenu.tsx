/**
 * The ⋯ menu in the Accounts Receivable header (AR refresh PR 1, v2.3379):
 * the rare controls that used to sit in the chrome — Mark returned deposits,
 * and the dev-only Mercury filter — behind one button, so the header can
 * carry the summary instead of instructions.
 */
import { useEffect, useRef, useState } from 'react'

export type ArHeaderMenuItem = {
  key: string
  label: string
  /** A second line under the label, muted. */
  hint?: string
  /** Renders a ✓ before the label when true (a toggle). */
  checked?: boolean
  onSelect: () => void
}

export function ArHeaderMenu({
  items,
  ariaLabel = 'More',
  label,
  openUp = false,
  align = 'right',
}: {
  items: ArHeaderMenuItem[]
  ariaLabel?: string
  /** A word after the ⋯ ("More") — for a footer, where a bare ⋯ reads as decoration (v2.3706). */
  label?: string
  /** Open above the button (a footer menu) rather than below it. */
  openUp?: boolean
  /** Which edge of the button the menu hangs from. */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  if (items.length === 0) return null
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          border: '1px solid var(--border)',
          background: open ? 'var(--bg-muted)' : 'var(--surface)',
          color: 'var(--text)',
          borderRadius: 6,
          padding: '0.35rem 0.6rem',
          cursor: 'pointer',
          fontSize: label ? '0.78rem' : '0.9375rem',
          lineHeight: 1,
          fontWeight: label ? 600 : 700,
        }}
      >
        ⋯{label ? ` ${label}` : ''}
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            ...(align === 'left' ? { left: 0 } : { right: 0 }),
            ...(openUp ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }),
            zIndex: 30,
            minWidth: 260,
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
            padding: '0.25rem',
            textAlign: 'left',
          }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role={it.checked == null ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={it.checked == null ? undefined : it.checked}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', border: 'none', background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text)' }}
            >
              <span style={{ fontWeight: 600 }}>
                {it.checked ? '✓ ' : ''}
                {it.label}
              </span>
              {it.hint ? <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 1 }}>{it.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
