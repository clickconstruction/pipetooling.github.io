import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../deadPress'

/** The shared look of a price card's field, press and link (punch list #308). */
export const cardInput: CSSProperties = { padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box' }

export const cardPress = (dead: boolean, primary: boolean): CSSProperties => ({
  padding: '0.4rem 0.8rem',
  background: dead ? DEAD_PRESS_FILL : primary ? '#2563eb' : 'var(--surface)',
  color: dead ? DEAD_PRESS_TEXT : primary ? 'white' : 'var(--text-base)',
  border: primary || dead ? 'none' : '1px solid var(--border-strong)',
  borderRadius: 4,
  cursor: dead ? 'not-allowed' : 'pointer',
  fontWeight: 600,
  fontSize: '0.8125rem',
  whiteSpace: 'nowrap',
})

export const cardLink: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8125rem' }

export const CHIP_TONE: Record<'green' | 'blue' | 'amber' | 'gray', CSSProperties> = {
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  gray: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
}
