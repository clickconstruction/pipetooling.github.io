/**
 * Which side of its row a To do row's step card opens on (v2.7425; found on the walk of 2026-11-15 that Taunya
 * asked for: the card always opened under its row, so on a row low on the screen it opened below the fold).
 *
 * Under the row, as it always was, whenever it fits there. Over the row when it does not fit under and there is more
 * room over. Pure: the card's height and the room on each side in, the side out.
 */

/** The gap between the row's mark and its card, in px. */
export const LIEN_STEP_CARD_GAP_PX = 6
/** How far the card keeps from the edge of what shows it, in px. */
export const LIEN_STEP_CARD_EDGE_PX = 8

/** True when the card stands over its row: it does not fit under, and there is more room over. */
export function lienStepCardOver(at: { height: number; under: number; over: number }): boolean {
  if (at.height <= 0) return false
  return at.under < at.height + LIEN_STEP_CARD_GAP_PX + LIEN_STEP_CARD_EDGE_PX && at.over > at.under
}
