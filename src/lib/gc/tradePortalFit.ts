/**
 * The trade portal's pages fit their shell (finding 334, the simulator's look of 2026-11-27 at 375 by 667).
 *
 * Every page of the portal is a stack of grids that name no column. Such a grid has one column as wide as its widest
 * child wants to be. So one child that cannot shrink widens every card on the page at once, and the shell, which
 * hides what runs past it, cut each card's right side where no swipe could reach it. This is the fault Messages had
 * (`lib/messages/pageFit.ts`), on a page with over a hundred such grids.
 *
 * One rule names the column for all of them: a grid inside the shell that names no column of its own gets the one
 * column that takes the room it is given and no more. It reads a grid by its own drawn style, so a grid added later
 * is held too. A grid that names its columns, or flows its children sideways, is left as it is.
 *
 * The child that could not shrink is the browser's own file picker. Safari on an iPhone draws it wider than its
 * card, and a desk Chrome does not, which is why a desk measure read clean. The second rule holds the picker to the
 * card it stands in. Pure: the words of the rule, for the shell's own `<style>`.
 */

/** The column a grid takes when it names none: as wide as the grid, never as wide as its widest child wants. */
export const PORTAL_ONE_COLUMN = 'minmax(0, 1fr)'

/** A grid as React draws its style, that names no column, row or area and does not flow sideways. */
export const PORTAL_UNNAMED_GRID = '[style*="display: grid"]:not([style*="grid-template"]):not([style*="grid-auto"])'

/** The rule for a shell: `shell` is the selector of the element that wraps the page. */
export function portalFitCss(shell: string): string {
  return `${shell} ${PORTAL_UNNAMED_GRID} { grid-template-columns: ${PORTAL_ONE_COLUMN}; } ${shell} input[type="file"] { max-width: 100%; }`
}
