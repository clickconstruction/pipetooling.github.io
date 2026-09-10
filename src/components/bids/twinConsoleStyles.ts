import type { CSSProperties } from 'react'

/**
 * The digital-twins chrome, shared by the operator's Console lens (Bids → 🤖
 * Robots → Console) and the fleet-admin page (Settings → Digital twins) so the
 * two halves of the old console still read as one thing after the split
 * (v2.3224). Violet is the twins' color everywhere in the app (the 🤖 banner,
 * the key pills, the run chips).
 */
export const TWIN_VIOLET = '#8b5cf6'

export const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.9rem', background: 'var(--surface)' }
export const MUTED: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }
export const BTN: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
export const BTN_PRIMARY: CSSProperties = { ...BTN, background: TWIN_VIOLET, color: '#fff', border: 'none' }
export const STEP_REF: CSSProperties = { fontSize: '0.62rem', fontWeight: 800, color: TWIN_VIOLET, letterSpacing: '0.06em', verticalAlign: '2px', marginRight: '0.4rem' }
export const CARD_TITLE: CSSProperties = { margin: '0 0 0.55rem', fontSize: '0.92rem', fontWeight: 700 }
export const COPY_CHIP: CSSProperties = { font: 'inherit', fontSize: '0.66rem', fontWeight: 700, color: TWIN_VIOLET, background: 'var(--bg-violet-100)', border: 'none', borderRadius: 5, padding: '0.1rem 0.45rem', cursor: 'pointer' }
export const CHIP: CSSProperties = { fontSize: '0.62rem', fontWeight: 800, borderRadius: 5, padding: '0.06rem 0.4rem' }
/** A prompt preview: the whole document, scrollable, never wider than the card. */
export const PROMPT_PRE: CSSProperties = { fontSize: '0.7rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', maxHeight: '22rem', overflow: 'auto', marginTop: '0.4rem' }
