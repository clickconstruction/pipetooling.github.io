/** The field sheets' shared looks (v2.5573): the message sheet's, so On my way and I'm here read as one family. */
import type { CSSProperties } from 'react'
import { CUSTOMER_BAR, CUSTOMER_LOOK } from '../gc/messages/reply/kindLook'

export const muted: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }
export const label: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.9rem 0 0.3rem' }
export const bubble: CSSProperties = { ...CUSTOMER_LOOK, ...CUSTOMER_BAR, borderWidth: 1, borderStyle: 'solid', borderRadius: 10, padding: '0.75rem 0.9rem', whiteSpace: 'pre-wrap', fontSize: '1rem', margin: 0 }
export const destBtn: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: '0.1rem 0.6rem',
  width: '100%',
  minHeight: 56,
  textAlign: 'left',
  padding: '0.6rem 0.8rem',
  marginBottom: '0.4rem',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
}
export const destPicked: CSSProperties = { border: '1px solid #16a34a', background: 'var(--bg-green-tint)' }
export const field: CSSProperties = { width: '100%', minHeight: 48, fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid var(--border-strong)', boxSizing: 'border-box' }
export const stepBtn: CSSProperties = { minHeight: 48, minWidth: 48, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '1.25rem', fontWeight: 700, cursor: 'pointer' }
export const actRow: CSSProperties = { display: 'grid', gridTemplateColumns: '1.4rem 1fr', gap: '0.5rem', alignItems: 'start', fontSize: '0.9375rem', color: 'var(--text-strong)', margin: '0 0 0.4rem' }
export const warn: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', borderRadius: 8, padding: '0.45rem 0.6rem', margin: '0.5rem 0 0' }
export const footerRow: CSSProperties = { display: 'flex', gap: '0.5rem', justifyContent: 'space-between', width: '100%' }
export const primaryBtn: CSSProperties = { minHeight: 48, padding: '0 1rem', borderRadius: 10, border: 'none', background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }
export const hereBtn: CSSProperties = { ...primaryBtn, background: '#1d4ed8' }
export const secondaryBtn: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, cursor: 'pointer' }
export const disabled: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }
export const quietLink: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem 0.4rem' }
export const quietMuted: CSSProperties = { ...quietLink, color: 'var(--text-muted)', fontWeight: 500 }
