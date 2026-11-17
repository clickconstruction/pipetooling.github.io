import type { CSSProperties } from 'react'

/** Filled buttons carry a white label, so the fill is a literal that holds in both themes — the `--text-*` tokens go pale in dark mode and the label with them. */
export const LIEN_FILL = { primary: '#2563eb', green: '#166534', amber: '#92400e' } as const

/** The Lien desk's button, in its four kinds; a dead one is faded and keeps the default cursor. Shared by the desk and its lists (out of `LienDesk.tsx`). */
export const lienBtnStyle = (kind: 'primary' | 'green' | 'amber' | 'plain' = 'plain', disabled = false): CSSProperties => ({
  padding: '5px 10px',
  borderRadius: 7,
  border: `1px solid ${kind === 'plain' ? 'var(--border-strong)' : 'transparent'}`,
  background: kind === 'plain' ? 'var(--surface)' : LIEN_FILL[kind],
  color: kind === 'plain' ? 'var(--text-700)' : '#fff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  whiteSpace: 'nowrap',
})

/**
 * The title bar's doors share § Rules' height (v2.4746, the owner's ask): its 0.78rem line at the root's 1.5, 2px of
 * padding above and below, and the 1px border. Put a GC on notice…, ☎ and Share (on a computer) take it.
 */
export const LIEN_HEAD_DOOR: CSSProperties = { height: 'calc(0.78rem * 1.5 + 6px)', boxSizing: 'border-box', paddingTop: 0, paddingBottom: 0, display: 'inline-flex', alignItems: 'center' }
