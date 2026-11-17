import type { CSSProperties } from 'react'

/** A box on the notice pane. */
export const lienBoxStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
// A page of the paper cannot narrow past its own letterhead, so in a pane too narrow for it the page slides inside its frame (v2.7446) and never drags the pane.
export const lienPaperStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem', overflowX: 'auto' }
export const lienLinkBtnStyle: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }
/** How far into the pane the gates scroll away and the one-line strip takes over (v2.3522). */
export const LIEN_STRIP_COLLAPSE_PX = 72
