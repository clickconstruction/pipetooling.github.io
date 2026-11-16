import type { CSSProperties } from 'react'

/**
 * The count a header link wears on the top-right corner of its word: Messages (v2.5762) and, since
 * punch list #363, Jobs. The link's text is wrapped in a relative span for it.
 */
export const NAV_BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '-0.55rem',
  right: '-0.9rem',
  display: 'inline-block',
  minWidth: '1.25rem',
  padding: '0 0.35rem',
  borderRadius: 999,
  border: '2px solid var(--surface)',
  // v2.6151: a red that stays deep in both themes, as the stage bar's badge keeps its amber. The text token
  // `--text-red-700` turns `#f87171` in dark, where the white count read 2.77:1.
  background: '#b91c1c',
  color: 'white',
  fontSize: '0.72rem',
  fontWeight: 700,
  lineHeight: '1.25rem',
  textAlign: 'center',
  pointerEvents: 'none',
}

/** A count as a pill says it: the number, or 99+ past ninety-nine. */
export function navBadgeWords(count: number): string {
  return count > 99 ? '99+' : String(count)
}
