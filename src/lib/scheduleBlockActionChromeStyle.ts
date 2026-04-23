import type { CSSProperties } from 'react'

/** White halation for SVG icon controls (linked, block note) on schedule block cards. */
export const scheduleBlockActionIconButtonStyle: Pick<CSSProperties, 'filter'> = {
  filter:
    'drop-shadow(0 0 3px #fff) drop-shadow(0 0 8px #fff) drop-shadow(0 0 16px #fff) drop-shadow(0 0 28px rgba(255,255,255,0.95)) drop-shadow(0 0 40px rgba(255,255,255,0.82))',
}

/**
 * Soft highlight for the **linked** chains icon (no dark stroke; chip provides the shape).
 */
export const scheduleBlockActionLinkedIconButtonStyle: Pick<CSSProperties, 'filter'> = {
  filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.9))',
}

/** White halation for text glyph controls (−, +) on schedule block cards. */
export const scheduleBlockActionTextButtonStyle: Pick<CSSProperties, 'textShadow'> = {
  textShadow:
    '0 0 3px #fff, 0 0 8px #fff, 0 0 16px #fff, 0 0 28px rgba(255,255,255,0.95), 0 0 40px rgba(255,255,255,0.82)',
}

/**
 * Circular “plate” for the **linked** (chains) control only — reads as a distinct badge on the card.
 * Does not change note / remove / copy chrome.
 */
export const scheduleBlockLinkedControlPlateStyle: CSSProperties = {
  width: 16,
  height: 16,
  minWidth: 16,
  minHeight: 16,
  boxSizing: 'border-box',
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.92)',
  border: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: 0,
}
