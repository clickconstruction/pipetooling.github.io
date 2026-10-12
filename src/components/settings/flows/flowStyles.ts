/** Settings → Flows' controls, in the theme's tokens: the Settings tabs' buttons and inputs, smaller where a table needs it. */
import type { CSSProperties } from 'react'
import { clauseButtonStyle, clauseInputStyle, clausePrimaryStyle } from '../../contracts/clauseStyles'

export const flowButton: CSSProperties = { ...clauseButtonStyle }
export const flowPrimary: CSSProperties = { ...clausePrimaryStyle }
export const flowSmall: CSSProperties = { ...clauseButtonStyle, padding: '0.15rem 0.5rem', fontSize: '0.78rem' }
export const flowInput: CSSProperties = { ...clauseInputStyle, padding: '0.25rem 0.4rem', fontSize: '0.85rem' }
export const flowSelect: CSSProperties = { ...clauseInputStyle, width: 'auto', padding: '0.2rem 0.3rem', fontSize: '0.8rem' }
/** A press that reads as a link: "+ a fact", "Put it back". */
export const flowQuiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }
export const flowDanger: CSSProperties = { ...flowQuiet, color: 'var(--text-red-600)' }
export const flowNote: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }
export const flowHead: CSSProperties = { fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }
/** A fact or a paper on a step, with its ×. */
export const flowChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.78rem',
  borderRadius: 999,
  padding: '0.05rem 0.5rem',
  border: '1px solid var(--border)',
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-base)',
}
export const flowPopover: CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  top: 'calc(100% + 4px)',
  left: 0,
  width: 360,
  maxHeight: 380,
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.18)',
  padding: '0.5rem',
  display: 'grid',
  gap: '0.25rem',
}
/** A tab in a row of tabs; the one open is filled. */
export const flowTab = (on: boolean): CSSProperties => ({
  ...clauseButtonStyle,
  padding: '0.3rem 0.75rem',
  fontSize: '0.85rem',
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  borderColor: on ? 'var(--border-blue)' : 'var(--border-strong)',
  fontWeight: on ? 600 : 400,
})
