/** The Subs Ledger's shared looks: the by-date table and the by-sub views draw from one set (punch list #347). */
import type { CSSProperties } from 'react'

export const chip = (on: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.78rem',
  fontWeight: 600,
  padding: '0.25rem 0.7rem',
  borderRadius: 999,
  border: `1px solid ${on ? 'var(--text-strong)' : 'var(--border-strong)'}`,
  background: on ? 'var(--text-strong)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-700)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})
export const outPress: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
export const field: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', minWidth: 0 }
export const tile: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', minWidth: 0 }
export const tileLabel: CSSProperties = { display: 'block', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
export const tileSub: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }
export const th: CSSProperties = { padding: '0.55rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', whiteSpace: 'nowrap' }
export const td: CSSProperties = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
export const pill = (tone: 'red' | 'green' | 'amber' | 'gray'): CSSProperties => ({
  display: 'inline-block',
  fontSize: '0.68rem',
  fontWeight: 700,
  padding: '1px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  background: tone === 'red' ? 'var(--bg-red-tint)' : tone === 'green' ? 'var(--bg-green-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
  color: tone === 'red' ? 'var(--text-red-700)' : tone === 'green' ? 'var(--text-green-700)' : tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)',
})
export const jobLink: CSSProperties = { font: 'inherit', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
