/**
 * Pricing header: the split Share button (v2.2198, option A from artifact df8daa33) — Share keeps its
 * one-click green self; the ▾ beside it files Print / Download CSV / "Print all prices — review" into
 * a small menu. Roles that can't Share get a single "Export ▾" over the same menu. Handlers are the
 * caller's existing ones (★ chooser and disabled gates unchanged).
 */
import { useEffect, useRef, useState } from 'react'

type Item = {
  key: 'print' | 'csv' | 'review' | 'fixtures' | 'd22audit' | 'plugquote'
  label: string
  hint?: string
  disabled?: boolean
  title?: string
  /** Draw a separator above this item. */
  dividerBefore?: boolean
  /** Render as an indented child of the item above (elbow connector, smaller type). */
  childOfPrevious?: boolean
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
  onOpenD22Audit,
  onPlugInQuote,
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
  /** Ledger-writer roles only — omit to hide the "Division 22 codes" item. */
  onOpenD22Audit?: () => void
  /** Cost-side roles only — omit to hide the "Plug in a quote" item (RFQ v2.2630). */
  onPlugInQuote?: () => void
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
    { key: 'fixtures', label: 'Supply house list', hint: 'names + counts by Division 22, no prices — scope it, then copy', disabled: fixturesDisabled, title: fixturesDisabled ? fixturesTitle : undefined, dividerBefore: true, onPick: onCopyFixtures },
    ...(onOpenD22Audit
      ? [{ key: 'd22audit', label: 'Division 22 codes', hint: 'audit every fixture name — pin the missing codes', childOfPrevious: true, onPick: onOpenD22Audit } satisfies Item]
      : []),
    ...(onPlugInQuote
      ? [{ key: 'plugquote', label: 'Plug in a quote', hint: 'paste a supply house reply — prices land on each part', childOfPrevious: true, onPick: onPlugInQuote } satisfies Item]
      : []),
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
        aria-label={canShare ? 'More ways to get this pricing out — Print, CSV, review, supply house list' : 'Export — Print, CSV, review, supply house list'}
        title={'Print · Download CSV · Print all prices · Supply house list'}
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
                style={{
                  display: it.childOfPrevious ? 'flex' : 'block',
                  ...(it.childOfPrevious ? { gap: '0.45rem', alignItems: 'flex-start', paddingLeft: '0.9rem' } : null),
                  width: '100%',
                  padding: it.childOfPrevious ? '0.3rem 0.55rem 0.4rem 0.9rem' : '0.45rem 0.55rem',
                  border: 'none',
                  background: 'none',
                  borderRadius: 6,
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: it.disabled ? 'not-allowed' : 'pointer',
                  color: it.disabled ? 'var(--text-faint)' : 'var(--text-strong)',
                }}
              >
                {it.childOfPrevious ? (
                  <svg width="14" height="26" viewBox="0 0 14 26" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" style={{ flex: '0 0 auto' }} aria-hidden="true">
                    <path d="M4 0v12a6 6 0 0 0 6 6h4" />
                  </svg>
                ) : null}
                <span style={it.childOfPrevious ? { display: 'block', fontSize: '0.875rem' } : undefined}>
                  {it.label}
                  {it.hint ? <span style={{ display: 'block', color: it.disabled ? 'var(--text-faint)' : 'var(--text-muted)', fontSize: '0.74rem' }}>{it.hint}</span> : null}
                </span>
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
