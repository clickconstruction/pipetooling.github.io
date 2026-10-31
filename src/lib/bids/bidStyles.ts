/**
 * Tab style helpers and constants for the Bids page navigation, extracted from `src/pages/Bids.tsx`.
 */
import type { CSSProperties } from 'react'
import { pageTabStyle } from '../pageTabStyle'
import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from '../orangeUnderWords'

export const HIGHLIGHTED_TABS = ['counts', 'pricing', 'cover-letter'] as const
export const SAFETY_ORANGE = '#FF6600' // ANSI/OSHA safety orange
export const SAFETY_ORANGE_BORDER = '#CC5200'
/**
 * Safety orange under words (v2.6186): the open Counts, Pricing and Cover Letter tab, the orange
 * buttons and the Bid Board's pending count fill with safety orange's deep shade (lib/orangeUnderWords)
 * under white words, 4.59:1. White on `#FF6600` read 2.94:1 (What everyone sees, punch list #198);
 * v2.6063 gave it near-black words instead, but the owner likes white on orange. Lines, borders and
 * icons keep `SAFETY_ORANGE`.
 */
export const SAFETY_ORANGE_UNDER_WORDS = ORANGE_UNDER_WORDS
/** The words on a safety orange fill: white (v2.6186), the Clock In bar's too, so a new orange press cannot drift. */
export const TEXT_ON_SAFETY_ORANGE = WORDS_ON_ORANGE
/**
 * Safety orange as words on a light ground (v2.6063): the closed highlighted tab and a form's
 * orange hint. `#FF6600` read 2.62:1 on the page; the token is `#c2410c` in light (4.62:1 on the
 * page, 5.18:1 on the surface) and `#fdba74` in dark (10.5:1).
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
    // Highlighted tabs keep safety orange: a box in its deep shade with white words when open
    // (v2.6186), orange words otherwise (v2.6063).
    // `backgroundColor`, never the `background` shorthand: the shorthand resets the base's
    // `backgroundClip: 'padding-box'`, so the open orange tab filled its full height instead
    // of the slim pill, and stayed mis-clipped after it closed (see lib/pageTabStyle).
    return active
      ? { ...base, backgroundColor: SAFETY_ORANGE_UNDER_WORDS, color: TEXT_ON_SAFETY_ORANGE }
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
