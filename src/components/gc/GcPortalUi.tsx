import { useEffect, type ReactNode } from 'react'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: the pieces the trade's portal draws with. The portal is a page of its own
 * that a company opens from a link, so it keeps the paper look in both themes (`data-theme="light"`).
 */

const INK = '#16283c'
const PAPER = '#f6f3ec'
const COPPER = '#b0662f'
const RULE = '#d9d2c3'

/** One titled block of the portal. */
export function PortalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: 'var(--surface)', border: `1px solid ${RULE}`, borderRadius: 8, padding: '0.75rem 0.85rem' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER, fontWeight: 700, marginBottom: '0.4rem' }}>
        {title}
      </div>
      {children}
    </section>
  )
}

/** A boxed note inside a block: amber for something to act on, paper for a quiet aside. */
export function PortalNote({ tone, children }: { tone: 'amber' | 'paper'; children: ReactNode }) {
  return (
    <div
      style={{
        padding: '0.5rem 0.65rem',
        background: tone === 'amber' ? 'var(--bg-amber-100)' : PAPER,
        border: tone === 'paper' ? `1px solid ${RULE}` : 'none',
        borderRadius: 6,
        fontSize: '0.85rem',
        display: 'grid',
        gap: '0.4rem',
      }}
    >
      {children}
    </div>
  )
}

/** A window over the page, in the portal's paper look. Escape or the backdrop closes it. */
export function PortalWindow({
  title,
  sub,
  onClose,
  width = 760,
  children,
  footer,
}: {
  title: string
  sub?: ReactNode
  onClose: () => void
  width?: number
  children: ReactNode
  footer?: ReactNode
}) {
  const { t } = usePortalLang()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        data-theme="light"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PAPER,
          color: INK,
          borderRadius: 10,
          width: `min(${width}px, 100%)`,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${INK}`,
        }}
      >
        <div style={{ background: INK, color: PAPER, padding: '0.7rem 0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{title}</div>
            {sub && <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{sub}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: PAPER, padding: '0.1rem 0.3rem' }}
          >
            ×
          </button>
        </div>
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        {footer && <div style={{ padding: '0.65rem 0.9rem', borderTop: `1px solid ${RULE}`, background: 'var(--surface)' }}>{footer}</div>}
      </div>
    </div>
  )
}
