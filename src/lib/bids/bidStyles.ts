/**
 * Tab style helpers and constants for the Bids page navigation, extracted from `src/pages/Bids.tsx`.
 */
import type { CSSProperties } from 'react'
import { pageTabStyle } from '../pageTabStyle'

export const HIGHLIGHTED_TABS = ['counts', 'pricing', 'cover-letter'] as const
export const SAFETY_ORANGE = '#FF6600' // ANSI/OSHA safety orange
export const SAFETY_ORANGE_BORDER = '#CC5200'
/**
 * The words on a safety orange fill (v2.6063): near-black in both themes, the pair the Clock In
 * bar took in v2.5981 (`CLOCK_IN_ACCENT_TEXT` in lib/clock/clockColors). White on the orange read
 * 2.94:1 (What everyone sees, punch list #198); this reads 6.04:1. The open Counts, Pricing and
 * Cover Letter tab, the orange buttons and the Bid Board's pending count all read it, so a new
 * orange press cannot drift.
 */
export const TEXT_ON_SAFETY_ORANGE = 'var(--text-on-bright-solid)'
/**
 * Safety orange as words on a light ground (v2.6063): the closed highlighted tab and a form's
 * orange hint. `#FF6600` read 2.62:1 on the page; the token is `#c2410c` in light (4.62:1 on the
 * page, 5.18:1 on the surface) and `#fdba74` in dark (10.5:1). The fill stays `SAFETY_ORANGE`.
 */
export const SAFETY_ORANGE_TEXT = 'var(--text-orange-700)'

export const tabStyle = (active: boolean) => ({
  ...pageTabStyle(active),
  padding: '0.5rem 0.6rem',
  fontSize: '0.9375rem',
})

export function bidsTabStyle(active: boolean, tabId: string) {
  const base = tabStyle(active)
  if (HIGHLIGHTED_TABS.includes(tabId as (typeof HIGHLIGHTED_TABS)[number])) {
    // Highlighted tabs keep safety orange: a filled orange box with near-black words when open,
    // orange words otherwise (the two word tokens above, v2.6063).
    // `backgroundColor`, never the `background` shorthand: the shorthand resets the base's
    // `backgroundClip: 'padding-box'`, so the open orange tab filled its full height instead
    // of the slim pill, and stayed mis-clipped after it closed (see lib/pageTabStyle).
    return active
      ? { ...base, backgroundColor: SAFETY_ORANGE, color: TEXT_ON_SAFETY_ORANGE }
      : { ...base, fontWeight: 600, color: SAFETY_ORANGE_TEXT }
  }
  return base
}

export const bidDetailCloseXStyle: CSSProperties = {
  padding: '0.2rem 0.45rem',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-faint)',
  fontSize: '1.35rem',
  lineHeight: 1,
}

/**
 * The open bid's × on a phone (v2.4451): in the card's top-right corner, inside its right
 * padding. Every bid-detail card is padded `1.5rem 2rem`, so a × no wider than 2rem never covers
 * the title, the Mark buttons or the open step strip. It used to float 0.75rem in, over the first
 * line of whatever came first. `bidStyles.test.ts` holds the nine cards to that padding.
 */
export const BID_DETAIL_CLOSE_FLOAT_WIDTH = '2rem'

export const bidDetailCloseFloatMobileStyle: CSSProperties = {
  ...bidDetailCloseXStyle,
  position: 'absolute',
  top: 0,
  right: 0,
  width: BID_DETAIL_CLOSE_FLOAT_WIDTH,
  height: '2.5rem',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2,
}
