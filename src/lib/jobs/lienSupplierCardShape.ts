/**
 * Which shape the supply houses card draws its rows in (v2.7446): the five-column table, or the stacked rows a phone
 * has always had. The card's own width decides, not the window's: beside the Notices list the pane is far narrower
 * than the window, and under about 600 px the table's money columns run into each other.
 */

/** Under this many px of card the five columns no longer hold a five-figure amount each. */
export const LIEN_SUPPLIERS_STACK_BELOW_PX = 600

/**
 * `cardWidth` is the card's measured width, 0 before it is measured (and under a test's DOM, which lays nothing out).
 * A phone stacks whatever the measure says. An unmeasured card keeps the table, so nothing flips where nothing was read.
 */
export function lienSuppliersStacked(isMobile: boolean, cardWidth: number): boolean {
  if (isMobile) return true
  return cardWidth > 0 && cardWidth < LIEN_SUPPLIERS_STACK_BELOW_PX
}
