import type { CSSProperties } from 'react'
import type { LienDeskSeverity } from '../../lib/jobs/lienDesk'

/** A row's deadline chip by how close its day is: red, amber, or quiet. Shared by the Lien desk's lists (out of `LienDesk.tsx`). */
export function lienSeverityColors(sev: LienDeskSeverity): { bg: string; fg: string } {
  if (sev === 'red') return { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' }
  if (sev === 'amber') return { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
  return { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' }
}

/** The small chip a list row and a pane head carry, in the two colours handed to it. */
export const lienRowChipStyle = (bg: string, fg: string): CSSProperties => ({
  display: 'inline-block',
  padding: '0 6px',
  borderRadius: 5,
  fontSize: '0.68rem',
  fontWeight: 600,
  lineHeight: '18px',
  whiteSpace: 'nowrap',
  background: bg,
  color: fg,
  verticalAlign: 'middle',
})

/** The small capitals over a box or a menu on the desk. */
export const lienBoxHeadStyle: CSSProperties = { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }

/** A press inside a pile's title on a phone: taller and in a size a thumb reads (punch list #352, PR 5). */
export const LIEN_PHONE_PILE_PRESS: CSSProperties = { minHeight: 30, padding: '0 10px', fontSize: '0.8125rem' }
