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
    return active ? { ...base, background: SAFETY_ORANGE } : { ...base, fontWeight: 600, color: SAFETY_ORANGE }
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

export const bidDetailCloseFloatMobileStyle: CSSProperties = {
  ...bidDetailCloseXStyle,
  position: 'absolute',
  top: '0.75rem',
  right: '0.75rem',
  zIndex: 2,
  background: 'var(--surface)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
}
