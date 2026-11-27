/**
 * A thumb's 44 px for a press that has no phone flag to read (the phone walk of 2026-11-21 on Task Mode, punch list
 * #369). A task card's pills, the Task Mode strip and the Tagged notes fold draw from fixed style objects, at the same
 * size on a phone as at a desk: 18 to 38 px. Each would need a hook to know the screen. The screen says it instead:
 * `index.css` sets `--phone-press-min` to 44px at phone width and leaves it unset above, and a style reads it here.
 *
 * Pure: the two CSS values a style takes. `phonePressFloor.test.ts` holds them and the stylesheet's rule together.
 */

/** The custom property `index.css` sets at phone width. */
export const PHONE_PRESS_FLOOR_VAR = '--phone-press-min'
/** What it is set to there: a fingertip. */
export const PHONE_PRESS_FLOOR_PX = 44
/** The widest screen that counts as a phone, the checklist's own breakpoint in `index.css`. */
export const PHONE_PRESS_FLOOR_MAX_WIDTH_PX = 640

/** A `min-height` (or `min-width`): `desk` px at a desk, a fingertip on a phone. A press already taller keeps its size. */
export function phoneTall(desk: number): string {
  return `max(${desk}px, var(${PHONE_PRESS_FLOOR_VAR}, 0px))`
}

/**
 * The margin over and under a press that sits in a line of words or a strip: nothing at a desk, and on a phone half
 * of what `phoneTall(desk)` grew the press by, taken back, so the line stays as tall as it was drawn and nothing under
 * it moves. A press already a fingertip tall gives nothing back.
 */
export function phoneGiveBack(desk: number): string {
  return `min(0px, calc((${desk}px - var(${PHONE_PRESS_FLOOR_VAR}, 0px)) / 2))`
}

/**
 * The trade partner's portal (finding 290 of the walks, v2.8700): the class on its page's `<main>`. `index.css` grows
 * every press inside it to a fingertip at phone width: a `Btn`, a plain button, a link, a tick's label, a fold's line,
 * a pick list and a field. The portal draws the office's own `Btn`, which takes no fact about the screen, so the page
 * says it. The office's GC pages draw the same `Btn` outside this class and keep their desk size.
 */
export const TRADE_PORTAL_PAGE_CLASS = 'tradePortalPage'

/** What stands a fingertip tall inside the portal's page at phone width, as `index.css` selects it. */
export const TRADE_PORTAL_PRESS_SELECTORS = [
  'button',
  'select',
  'summary',
  "input:not([type='checkbox']):not([type='radio'])",
  "label:has(input[type='checkbox'])",
  "label:has(input[type='radio'])",
] as const
