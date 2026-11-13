/**
 * Where a task window sits on a phone while the keyboard is up (punch list #331).
 *
 * An iPhone does not shrink the page for the keyboard. It shrinks the part of the page that shows, the visual
 * viewport, and when the field that took the keyboard sits where the keyboard will be it also slides that part
 * down the page. A window pinned to the top of the page is then pushed off the top of the screen, with the field
 * being typed in. So the window follows the part that shows: it starts where that part starts and is no taller.
 */

/** The part of the page that shows: `window.visualViewport`'s height and how far it has slid down the page. */
export type VisualViewportBox = {
  height: number
  offsetTop: number
}

export type TaskWindowPhoneFrame = {
  /** How far down the page the card starts, in px. 0 unless the keyboard slid the page. */
  top: number
  /** The card's tallest, as CSS. */
  maxHeight: string
}

/**
 * Both numbers are CSS px of the page, whatever its zoom: Safari's own page zoom (the aA menu) reports a scale of
 * 1.25 and the same slide, so the scale is not read. A card that stood still under a zoom was pushed off the top.
 */
export function taskWindowPhoneFrame(box: VisualViewportBox | null): TaskWindowPhoneFrame {
  if (!box || !Number.isFinite(box.height) || box.height <= 0) return { top: 0, maxHeight: '100%' }
  return {
    top: Number.isFinite(box.offsetTop) ? Math.max(0, Math.round(box.offsetTop)) : 0,
    maxHeight: `min(100%, calc(${Math.round(box.height)}px - env(safe-area-inset-top, 0px)))`,
  }
}

/**
 * The scroll position that brings a field inside the part of a scrolling box that shows, moving it no further than
 * it must. All four edges are measured from the same origin, as `getBoundingClientRect` gives them.
 */
export function scrollTopToReveal(a: { scrollTop: number; boxTop: number; boxBottom: number; fieldTop: number; fieldBottom: number; margin?: number }): number {
  const margin = a.margin ?? 8
  const room = a.boxBottom - a.boxTop
  const fieldHeight = a.fieldBottom - a.fieldTop
  // A field taller than the room shows from its top, where the typing starts.
  if (fieldHeight + margin * 2 >= room) return Math.max(0, a.scrollTop + (a.fieldTop - a.boxTop) - margin)
  if (a.fieldTop < a.boxTop + margin) return Math.max(0, a.scrollTop - (a.boxTop + margin - a.fieldTop))
  if (a.fieldBottom > a.boxBottom - margin) return a.scrollTop + (a.fieldBottom - (a.boxBottom - margin))
  return a.scrollTop
}
