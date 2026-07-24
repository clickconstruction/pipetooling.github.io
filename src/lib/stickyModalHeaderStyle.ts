import type { CSSProperties } from 'react'

/**
 * Styles for modals whose PANEL is the scroller — `maxHeight: <n>vh` +
 * `overflow: auto` — and whose close × lives in the title bar.
 *
 * Without these the × is an ordinary first child of the scroller, so on a phone
 * (where the form is taller than the screen) it scrolls off the top the moment
 * the user starts filling anything in and closing means scrolling all the way
 * back up. Reported from the field on Additional Report (v2.990); the same
 * shape appeared across the report/inspection/trip-charge modals.
 *
 * The one non-obvious rule, encoded here so it can't drift: the panel keeps NO
 * top padding — the inset moves onto the sticky bar. A bar sticking at `top: 0`
 * inside a padded scroller otherwise leaves a strip the height of that padding
 * where content scrolls through *above* the pinned bar.
 */

/** Panel padding. `x` is the horizontal inset the sticky bar has to cancel out. */
export interface StickyModalInset {
  /** Left/right panel padding, e.g. `'1.5rem'`. */
  x: string
  /** Top padding — moves onto the sticky bar. Defaults to `x`. */
  top?: string
  /** Bottom padding. Defaults to `x`. */
  bottom?: string
}

/** Default inset for this repo's modal panels (`padding: '1.5rem'`). */
export const STICKY_MODAL_INSET: StickyModalInset = { x: '1.5rem' }

/**
 * Panel style for a scrolling modal: the sizing that survives a 375px phone
 * plus the padding split the sticky bar depends on.
 *
 * `maxWidth` as a number becomes `width: min(<n>px, 100%)` — a `minWidth: 400`
 * floor is wider than a 375px phone and pushes the panel off-screen sideways.
 * Omit it for panels sized some other way (`maxWidth: '90vw'`, …).
 */
export function stickyModalPanelStyle(
  maxWidth?: number,
  inset: StickyModalInset = STICKY_MODAL_INSET,
): CSSProperties {
  const { x, bottom = x } = inset
  return {
    // No top padding — it lives on the sticky bar (see module comment).
    padding: `0 ${x} ${bottom}`,
    boxSizing: 'border-box',
    ...(maxWidth === undefined ? {} : { width: `min(${maxWidth}px, 100%)`, maxWidth }),
  }
}

/**
 * Title-bar style: pins to the panel's top edge with an opaque background so
 * scrolling content passes behind it. Negative side margins cancel the panel's
 * horizontal padding so the opaque bar spans the full panel width.
 *
 * Call sites add their own `display`/`justifyContent`/`alignItems` — the bars
 * differ (title + ×, title + button row, centered week nav).
 */
export function stickyModalHeaderStyle(
  inset: StickyModalInset = STICKY_MODAL_INSET,
): CSSProperties {
  const { x, top = x } = inset
  return {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    margin: `0 -${x} 1rem`,
    padding: `${top} ${x} 0.75rem`,
  }
}

/** 44×44 minimum: a thumb-sized tap target, not a bare × glyph. */
export const STICKY_MODAL_CLOSE_BUTTON_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.5rem',
  lineHeight: 1,
  color: 'var(--text-muted)',
  flexShrink: 0,
  minWidth: 44,
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Pull the oversized box back to the title's optical edges.
  margin: '-0.5rem -0.5rem 0 0',
}

/**
 * Phone-safe replacement for a `minWidth: <n>` floor on a modal panel that
 * sizes itself to its content (`maxWidth: '90%'`), where switching to a fixed
 * `width` would stop it growing. Pair with `boxSizing: 'border-box'` so the
 * panel's padding counts inside the floor rather than on top of it.
 */
export function phoneSafeMinWidth(px: number): string {
  return `min(${px}px, 100%)`
}
