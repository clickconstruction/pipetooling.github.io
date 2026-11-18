/**
 * Materials on site: the look of a tile on a box's screen (punch list #398), a press that carries its own fact under
 * its name. In a file of its own so the tab can dress its Photo press as a tile without importing the screen.
 */
import type { CSSProperties } from 'react'

export const BOX_PRESS_BLUE = '#2563eb'

/** The box screen's plain press: 48 high, the surface's own colours. */
export const BOX_PRESS: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }

/** A tile: a press that carries its own fact under its name. `due` is amber, `fresh` is outlined blue. */
export function boxTileStyle(tone: 'plain' | 'due' | 'fresh' = 'plain'): CSSProperties {
  return {
    ...BOX_PRESS,
    minHeight: 60,
    padding: '0.5rem 0.65rem',
    borderRadius: 10,
    display: 'grid',
    gap: '0.15rem',
    alignContent: 'center',
    justifyContent: 'stretch',
    justifyItems: 'start',
    textAlign: 'left',
    minWidth: 0,
    ...(tone === 'due' ? { borderColor: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' } : {}),
    ...(tone === 'fresh' ? { borderColor: BOX_PRESS_BLUE, boxShadow: `inset 0 0 0 1px ${BOX_PRESS_BLUE}`, color: 'var(--text-link)' } : {}),
  }
}
/** The fact under a tile's name. */
export function boxTileFactStyle(tone: 'plain' | 'due' | 'fresh' = 'plain'): CSSProperties {
  return { fontSize: '0.78rem', lineHeight: 1.25, fontWeight: tone === 'due' ? 600 : 500, color: tone === 'due' ? 'var(--text-amber-700)' : 'var(--text-muted)' }
}
