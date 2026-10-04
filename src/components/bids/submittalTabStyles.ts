/**
 * The Submittals tab's shared looks (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04): the muted
 * line, the four buttons and the rows table's cells. The tab and the pieces split out of it draw
 * with the same constants, so a moved piece looks as it did.
 */
import type { CSSProperties } from 'react'

export const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
export const btn: CSSProperties = { padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
export const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
export const btnQuiet: CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-muted)', cursor: 'pointer' }
export const btnGreen: CSSProperties = { ...btn, background: '#16a34a', borderColor: '#16a34a', color: 'white', fontWeight: 600 }
export const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
export const td: CSSProperties = { padding: '0.5rem 0.5rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'top', fontSize: '0.8125rem', color: 'var(--text-base)' }
export const sub: CSSProperties = { display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }
