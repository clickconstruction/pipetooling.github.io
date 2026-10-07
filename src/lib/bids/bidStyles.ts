/**
 * Tab style helpers and constants for the Bids page navigation, extracted from `src/pages/Bids.tsx`.
 */
import type { CSSProperties } from 'react'
import { pageTabStyle } from '../pageTabStyle'

export const HIGHLIGHTED_TABS = ['counts', 'pricing', 'cover-letter'] as const
export const SAFETY_ORANGE = '#FF6600' // ANSI/OSHA safety orange
export const SAFETY_ORANGE_BORDER = '#CC5200'

export const tabStyle = (active: boolean) => ({
  ...pageTabStyle(active),
  padding: '0.5rem 0.6rem',
  fontSize: '0.9375rem',
})

export function bidsTabStyle(active: boolean, tabId: string) {
  const base = tabStyle(active)
  if (HIGHLIGHTED_TABS.includes(tabId as (typeof HIGHLIGHTED_TABS)[number])) {
    // Highlighted tabs keep safety orange: filled orange box when active, orange text otherwise.
    // `backgroundColor`, never the `background` shorthand: the shorthand resets the base's
    // `backgroundClip: 'padding-box'`, so the open orange tab filled its full height instead
    // of the slim pill, and stayed mis-clipped after it closed (see lib/pageTabStyle).
    return active ? { ...base, backgroundColor: SAFETY_ORANGE } : { ...base, fontWeight: 600, color: SAFETY_ORANGE }
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
