/** Shared looks for the in-kind card and its windows (punch list #301). Theme tokens only; the action blue is the app's literal. */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'

export const PRESS_BLUE = '#2563eb'

export const bluePress = (dead = false): CSSProperties => ({
  minHeight: 36,
  padding: '6px 14px',
  borderRadius: 8,
  border: 'none',
  background: dead ? DEAD_PRESS_FILL : PRESS_BLUE,
  color: dead ? DEAD_PRESS_TEXT : '#fff',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: dead ? 'default' : 'pointer',
})

export const linePress: CSSProperties = {
  minHeight: 32,
  padding: '4px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}

export const quietPress: CSSProperties = {
  padding: '4px 6px',
  border: 'none',
  background: 'none',
  color: 'var(--text-link)',
  font: 'inherit',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
}

export const cardBox: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  padding: '12px 14px',
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

export const statBox: CSSProperties = {
  flex: '1 1 150px',
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  padding: '8px 11px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg-subtle)',
  minWidth: 0,
}
export const statKey: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
export const statValue: CSSProperties = { fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }
export const statSub: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

export const noteStrip: CSSProperties = {
  borderRadius: 8,
  padding: '8px 11px',
  fontSize: '0.8125rem',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  color: 'var(--text-700)',
}
export const amberStrip: CSSProperties = {
  borderRadius: 8,
  padding: '8px 11px',
  fontSize: '0.8125rem',
  background: 'var(--bg-amber-tint)',
  border: '1px solid var(--border-amber)',
  color: 'var(--text-amber-800)',
}
export const redText: CSSProperties = { color: 'var(--text-red-700)', fontSize: '0.8125rem' }

export const pill = (kind: 'grey' | 'blue' | 'green' | 'amber'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 9px',
  borderRadius: 9999,
  fontSize: '0.72rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  background: kind === 'blue' ? 'var(--bg-blue-tint)' : kind === 'green' ? 'var(--bg-green-tint)' : kind === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-muted)',
  color: kind === 'blue' ? 'var(--text-blue-800)' : kind === 'green' ? 'var(--text-green-700)' : kind === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)',
})

export const fieldLabel: CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }
export const fieldBox: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 38,
  padding: '7px 10px',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontSize: '0.9rem',
}

export const choiceBox = (on: boolean): CSSProperties => ({
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  padding: on ? '8px 10px' : '9px 11px',
  border: on ? `2px solid ${PRESS_BLUE}` : '1px solid var(--border)',
  borderRadius: 8,
  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  width: '100%',
})

/** The green bar of what is paid, over the grey of what is left. */
export function meterParts(paid: number, total: number): { paidPct: number } {
  if (!(total > 0)) return { paidPct: 0 }
  return { paidPct: Math.max(0, Math.min(100, (paid / total) * 100)) }
}
