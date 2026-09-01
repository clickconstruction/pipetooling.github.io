/**
 * Pricing header: the split Share button (v2.2198, option A from artifact df8daa33) — Share keeps its
 * one-click green self; the ▾ beside it files Print / Download CSV / "Print all prices — review" into
 * a small menu. Roles that can't Share get a single "Export ▾" over the same menu. Handlers are the
 * caller's existing ones (★ chooser and disabled gates unchanged).
 */
import { useEffect, useRef, useState } from 'react'

type Item = {
  key: 'print' | 'csv' | 'review' | 'fixtures'
  label: string
  hint?: string
  disabled?: boolean
  title?: string
  /** Draw a separator above this item. */
  dividerBefore?: boolean
  onPick: () => void
}

export function PricingShareMenu({
  canShare,
  shareDisabled,
  shareTitle,
  onShare,
  csvDisabled,
  csvTitle,
  fixturesDisabled,
  fixturesTitle,
  onPrint,
  onCsv,
  onReview,
  onCopyFixtures,
}: {
  canShare: boolean
  shareDisabled: boolean
  shareTitle: string
  onShare: () => void
  csvDisabled: boolean
  csvTitle: string
  fixturesDisabled: boolean
  fixturesTitle: string
  onPrint: () => void
  onCsv: () => void
  onReview: () => void
  onCopyFixtures: () => void
}) {
  const [open, setOpen] = useState(false)
  // Phone fix: the menu hangs right-aligned off the button; near the screen's left edge that clips,
  // so flip the anchor when there isn't ~16rem of room to the left.
  const [alignLeft, setAlignLeft] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
        if (items.length === 0) return
        const i = items.findIndex((el) => el === document.activeElement)
        const next = e.key === 'ArrowDown' ? items[Math.min(items.length - 1, i + 1)] : items[Math.max(0, i - 1)]
        next?.focus()
        e.preventDefault()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const items: Item[] = [
    { key: 'print', label: 'Print', hint: 'the price you’re viewing', onPick: onPrint },
    { key: 'csv', label: 'Download CSV', disabled: csvDisabled, title: csvDisabled ? csvTitle : undefined, onPick: onCsv },
    { key: 'review', label: 'Print all prices — review', hint: 'every price option in one document', dividerBefore: true, onPick: onReview },
    { key: 'fixtures', label: 'Copy fixtures for text', hint: 'names + counts only, no prices — for parts houses', disabled: fixturesDisabled, title: fixturesDisabled ? fixturesTitle : undefined, dividerBefore: true, onPick: onCopyFixtures },
  ]

  const caretStyle: React.CSSProperties = canShare
    ? { padding: '0.5rem 0.55rem', background: '#16a34a', color: 'white', border: 'none', borderLeft: '1px solid rgba(255, 255, 255, 0.35)', borderRadius: '0 4px 4px 0', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }
    : { padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {canShare ? (
        <button
          type="button"
          onClick={onShare}
          disabled={shareDisabled}
          title={shareTitle}
          style={{
            padding: '0.5rem 1rem',
            background: shareDisabled ? 'var(--bg-200)' : '#16a34a',
            color: shareDisabled ? 'var(--text-faint)' : 'white',
            border: 'none',
            borderRadius: '4px 0 0 4px',
            cursor: shareDisabled ? 'not-allowed' : 'pointer',
            font: 'inherit',
          }}
        >
          Share
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          const r = wrapRef.current?.getBoundingClientRect()
          setAlignLeft(!!r && r.right < 264)
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={canShare ? 'More ways to get this pricing out — Print, CSV, review, copy fixtures' : 'Export — Print, CSV, review, copy fixtures'}
        title={'Print · Download CSV · Print all prices · Copy fixtures for text'}
        style={caretStyle}
      >
        {canShare ? '▾' : 'Export ▾'}
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Get this pricing out"
          style={{ position: 'absolute', ...(alignLeft ? { left: 0 } : { right: 0 }), top: 'calc(100% + 0.3rem)', minWidth: '15.5rem', maxWidth: 'calc(100vw - 1rem)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.14)', padding: '0.3rem', zIndex: 40 }}
        >
          {items.map((it) => (
            <span key={it.key}>
              {it.dividerBefore ? <div style={{ borderTop: '1px solid var(--border)', margin: '0.25rem 0.4rem' }} /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={it.disabled}
                title={it.title}
                onClick={() => {
                  setOpen(false)
                  it.onPick()
                }}
                onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = 'var(--bg-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                style={{ display: 'block', width: '100%', padding: '0.45rem 0.55rem', border: 'none', background: 'none', borderRadius: 6, font: 'inherit', textAlign: 'left', cursor: it.disabled ? 'not-allowed' : 'pointer', color: it.disabled ? 'var(--text-faint)' : 'var(--text-strong)' }}
              >
                {it.label}
                {it.hint ? <span style={{ display: 'block', color: it.disabled ? 'var(--text-faint)' : 'var(--text-muted)', fontSize: '0.74rem' }}>{it.hint}</span> : null}
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
