/**
 * The small shared pieces of the course page (punch list #111): inline bold from the lessons' `**…**`, the
 * button shapes and the verdict tones. No component lives here (`Chip.tsx` holds the chip), so fast refresh
 * keeps working. Imported only by the lazy course page and its parts.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { TrainingColour } from '../../lib/training/trainingState'

/** `A trench is **15 feet** wide` → the words with the number in bold. No markup other than the bold passes through. */
export function inlineBold(text: string): ReactNode[] {
  const parts = text.split('**')
  return parts.map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
}

export const BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.45rem 0.9rem',
  minHeight: 36,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  font: 'inherit',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
}

/** The one blue press on a screen. Saturated action colours stay literal (CLAUDE.md → theme tokens). */
export const BTN_PRIMARY: CSSProperties = { ...BTN, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }

export const BTN_QUIET: CSSProperties = { ...BTN, border: '1px solid transparent', background: 'none', color: 'var(--text-link)', padding: '0.45rem 0.4rem' }

export const BTN_DISABLED: CSSProperties = { opacity: 0.45, cursor: 'default' }

export const VERDICT_TONES: Record<TrainingColour, CSSProperties> = {
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' },
}
