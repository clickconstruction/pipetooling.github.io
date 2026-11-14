/**
 * The part of the page that shows on a phone, and the band a window pinned to the screen should fill.
 *
 * An iPhone does not shrink the page for the keyboard. It shrinks the visual viewport, and when the field that
 * took the keyboard sits where the keyboard will be it also slides that viewport down the page. A window that is
 * `position: fixed` at the top of the page then leaves the top of the screen. So a window follows the band: it
 * starts where the band starts and is as tall. The task windows were first (v2.7155); the sheets followed
 * (punch list #348).
 */

/** `window.visualViewport`'s height and how far it has slid down the page, both in the page's own px at any zoom. */
export type VisualViewportBox = {
  height: number
  offsetTop: number
}

export type VisibleBand = {
  /** Px down the page where the part that shows starts. 0 unless the keyboard slid the page. */
  top: number
  /** Px of the page that show. */
  height: number
}

/** The band, or null where the browser cannot say what shows (jsdom, very old browsers): the caller keeps its CSS. */
export function visibleBand(box: VisualViewportBox | null): VisibleBand | null {
  if (!box || !Number.isFinite(box.height) || box.height <= 0) return null
  return {
    top: Number.isFinite(box.offsetTop) ? Math.max(0, Math.round(box.offsetTop)) : 0,
    height: Math.round(box.height),
  }
}
