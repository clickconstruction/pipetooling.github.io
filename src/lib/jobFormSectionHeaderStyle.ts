import type { CSSProperties } from 'react'

/**
 * Banded header for the Edit/New Job modal's major sections (Billing,
 * Labor and Parts Cost) — bolder and more clearly a section divider than the
 * body labels around it. Brand-orange accent edge; neutrals stay theme tokens.
 */
export const JOB_FORM_SECTION_HEADER_STYLE: CSSProperties = {
  fontWeight: 700,
  fontSize: '1.0625rem',
  color: 'var(--text-strong)',
  background: 'var(--bg-muted)',
  border: '1px solid var(--border-strong)',
  borderLeft: '4px solid #f97316',
  borderRadius: 6,
  padding: '0.5rem 0.75rem',
  letterSpacing: '0.01em',
}
