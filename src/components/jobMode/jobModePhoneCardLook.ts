/**
 * The look of a press on the Job Mode card under the new phone layout (`lib/phoneLayout/jobCard.ts`), and the name
 * its presses are recorded under. In a file of its own, apart from the components that draw with it
 * (`JobModePhoneCardParts.tsx`).
 */
import type { CSSProperties } from 'react'
import { TOP_ROW_CONTROL, topRowTarget, type TopRowSquareId } from '../../lib/jobMode/topRow'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { JOB_CARD_ROW_PX } from '../../lib/phoneLayout/jobCard'

/** A press of the card: 44 px, its words whole. The job window's contact press, by the same numbers. */
export const CARD_PRESS: CSSProperties = {
  minHeight: JOB_CARD_ROW_PX,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0 0.5rem',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  fontFamily: 'inherit',
  fontSize: '0.9375rem',
  fontWeight: 700,
  lineHeight: 1.15,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
}

/** The press record's name for a square folded into the card, so its presses are counted where the square's were. */
export function recordCardPress(userId: string | null | undefined, role: string | null, square: TopRowSquareId): void {
  recordNavClick(userId, role, TOP_ROW_CONTROL, topRowTarget(square))
}
