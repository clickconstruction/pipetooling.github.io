import type { CSSProperties } from 'react'

/** Shared by the sections of the job window's Documents tab, so every list reads as one table. */
export const documentsTh: CSSProperties = {
  textAlign: 'left',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  padding: '0.3rem 0.5rem',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}
export const documentsTd: CSSProperties = { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
export const documentsNum: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
export const documentsHeading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
export const documentsQuietButton: CSSProperties = {
  padding: '0.3rem 0.7rem',
  fontSize: '0.8125rem',
  borderRadius: 4,
  cursor: 'pointer',
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
}
/** A status chip after a row's name; the colours come from the row's own kernel. */
export const documentsChip: CSSProperties = { marginLeft: '0.4rem', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }
/** A row's name as a link: it opens the thing. */
export const documentsLinkButton: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--text-blue-700)',
  textDecoration: 'underline',
}
