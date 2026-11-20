import type { CSSProperties, ReactNode } from 'react'
import { DASHBOARD_CARD_BOX, DASHBOARD_CARD_TITLE_STYLE, dashboardCardHeadStyle, type DashboardCardBox } from '../../lib/dashboard/dashboardCardTitleStyle'

/**
 * A Dashboard card's head: the tinted band across the card's top that holds its title and whatever shares
 * the title's line. Every card on the full page and the Job Mode page draws its head with this, so they
 * all read the same and a later change is one edit (`dashboardCardTitleStyle.ts`).
 *
 * `card` is the box the head sits in when it is not the common one, `null` for a section with no card
 * around it. `style` lays out the title's line (the flex row the card had before). `below` is the gap
 * under the band, and `closed` is a folded card, where the band fills the card.
 */
export function DashboardCardHead({
  card = DASHBOARD_CARD_BOX,
  below = '0.75rem',
  closed = false,
  style,
  children,
}: {
  card?: DashboardCardBox | null
  below?: string
  closed?: boolean
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div data-dashboard-card-head="" style={dashboardCardHeadStyle({ card, below, closed })}>
      <div style={{ flex: '1 1 auto', minWidth: 0, ...style }}>{children}</div>
    </div>
  )
}

/**
 * A Dashboard card's title, inside its `DashboardCardHead`. Always an `h2`: the cards are the page's
 * sections, and a heading inside a card is an `h3`. `nowrap` keeps a short title on one line where it
 * shares its row with the card's presses.
 */
export function DashboardCardTitle({ id, nowrap = false, children }: { id?: string; nowrap?: boolean; children: ReactNode }) {
  return (
    <h2 id={id} data-dashboard-card-title="" style={nowrap ? { ...DASHBOARD_CARD_TITLE_STYLE, whiteSpace: 'nowrap' } : DASHBOARD_CARD_TITLE_STYLE}>
      {children}
    </h2>
  )
}
