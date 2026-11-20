import type { CSSProperties } from 'react'

/**
 * The head of a Dashboard card, on the full page and the Job Mode page: a tinted band across the card's
 * top with the title in it, so a person scrolling a phone can spot where each section starts. It is the
 * Edit Job window's section heading (`jobFormSectionHeaderStyle.ts`: the muted band and the brand-orange
 * left edge) fused to the card, and it reaches the card's own edges so the title's row keeps the width it
 * had. Every card draws its head from here, so a change to how a card's title reads is one edit.
 */

/** The padding and corner of the card a head sits in. `top: null` is a head that is not the card's first line. */
export type DashboardCardBox = { top: string | null; side: string; radius: number }

/** The box most Dashboard cards share: `padding: 0.85rem 1rem 1rem`, an 8px corner. */
export const DASHBOARD_CARD_BOX: DashboardCardBox = { top: '0.85rem', side: '1rem', radius: 8 }

/** The Edit Job heading's accent edge. A saturated brand color, so it stays literal in both themes. */
const ACCENT_EDGE = '4px solid #f97316'

export const DASHBOARD_CARD_TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 700,
  letterSpacing: '0.01em',
  color: 'var(--text-strong)',
}

export type DashboardCardHeadShape = {
  /** The card's box, or `null` for a section with no card around it: the band then stands by itself. */
  card: DashboardCardBox | null
  /** The gap under the band. */
  below: string
  /** A folded card: the band is all there is, so it fills the card to its bottom edge. */
  closed: boolean
}

export function dashboardCardHeadStyle({ card, below, closed }: DashboardCardHeadShape): CSSProperties {
  const band: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    minHeight: '2.75rem',
    boxSizing: 'border-box',
    background: 'var(--bg-muted)',
    // Small grey words on the tint fall under 4.5 to 1 in both themes, so inside the band the muted tone
    // is one step stronger: a count or a note beside the title stays readable.
    ['--text-muted' as string]: 'var(--text-600)',
  }
  if (!card) {
    return {
      ...band,
      border: '1px solid var(--border-strong)',
      borderLeft: ACCENT_EDGE,
      borderRadius: 6,
      padding: '0.3rem 0.75rem',
      marginBottom: below,
    }
  }
  const inner = Math.max(0, card.radius - 1)
  const padding = `0.3rem ${card.side} 0.3rem calc(${card.side} - 4px)`
  if (card.top == null) {
    return {
      ...band,
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      borderLeft: ACCENT_EDGE,
      padding,
      margin: `0 -${card.side} ${below}`,
    }
  }
  if (closed) {
    return { ...band, borderLeft: ACCENT_EDGE, borderRadius: inner, padding, margin: `-${card.top} -${card.side} -${card.top}` }
  }
  return {
    ...band,
    borderBottom: '1px solid var(--border)',
    borderLeft: ACCENT_EDGE,
    borderRadius: `${inner}px ${inner}px 0 0`,
    padding,
    margin: `-${card.top} -${card.side} ${below}`,
  }
}
