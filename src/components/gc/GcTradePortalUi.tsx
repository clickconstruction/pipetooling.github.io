import type { ReactNode } from 'react'
import { CARD, COPPER, HAIR, PAPER } from '../../lib/portal/portalTheme'

/**
 * GC mode, the trade partner portal (P1b-ii-b): the pieces its page draws with, from the design spike's
 * `GcPortalUi.tsx`. The portal opens from a link outside the app, so it keeps the paper
 * look in both themes (`data-theme="light"` on its frame).
 */

/** One titled block of the portal. */
export function PortalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ background: CARD, border: `1px solid ${HAIR}`, borderRadius: 8, padding: '0.75rem 0.85rem' }}>
      <h2 style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER, fontWeight: 700 }}>{title}</h2>
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
        border: tone === 'paper' ? `1px solid ${HAIR}` : 'none',
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

/** One tappable line of a list, with the arrow that says it opens something. */
export function PortalRow({ first, onClick, children }: { first: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: '0.55rem',
        alignItems: 'flex-start',
        width: '100%',
        minHeight: 44,
        textAlign: 'left',
        padding: '0.55rem 0.1rem',
        border: 'none',
        borderTop: first ? 'none' : `1px solid ${HAIR}`,
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '0.9rem',
        lineHeight: 1.35,
      }}
    >
      {children}
      <span aria-hidden style={{ opacity: 0.5, fontSize: '1.1rem', lineHeight: 1, alignSelf: 'center' }}>
        ›
      </span>
    </button>
  )
}
