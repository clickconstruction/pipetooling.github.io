import type { CSSProperties } from 'react'

/**
 * Soft 1px white edge highlight for icon controls that already sit on a white plate
 * (linked chains, block-note). Just enough to keep the colored glyph from blending
 * into the plate's edge against vivid card colors.
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
 * Background-only portion of the circular control plate — borderRadius / fill / shadow,
 * no fixed width / height. Apply on top of an existing sizing (e.g. an interactive button
 * that needs its own tap target) so the control reads as the same white badge as the
 * linked chains plate without forcing a 16×16 box.
 */
export const scheduleBlockControlPlateBackgroundStyle: CSSProperties = {
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.92)',
  border: 'none',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
}

/**
 * Circular "plate" for the **linked** (chains) control — reads as a distinct badge on the card.
 * Composes the shared plate background with the 16×16 sizing the chains icon expects.
 */
export const scheduleBlockLinkedControlPlateStyle: CSSProperties = {
  ...scheduleBlockControlPlateBackgroundStyle,
  width: 16,
  height: 16,
  minWidth: 16,
  minHeight: 16,
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: 0,
}
