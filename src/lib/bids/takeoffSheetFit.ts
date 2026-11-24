/**
 * What fits beside what on the Takeoffs tab (v2.8476).
 *
 * The line table cannot be narrower than its six columns. Measured on a harness
 * with made-up rows it needs 726 px, and a longer amount or fixture name adds to
 * that. Until v2.8476 nothing asked whether it fit: the Sheet's rail kept its
 * 320 px at every width, the table overflowed its column, and the rail, pinned
 * and later in the page, painted over Unit price, Qty, Line total and both row
 * presses. Under a 1,184 px window no delete could be pressed.
 *
 * These are the answers, as pure functions of a measured width. `null` is a box
 * nobody has measured yet (the first paint, a test without a layout): it reads
 * as roomy, which is the look the screen had before.
 */

/** The Sheet's rail, *What Pricing sees*. */
export const TAKEOFF_RAIL_PX = 320
/** The gap between the list and what sits beside it. */
export const TAKEOFF_GAP_PX = 16
/** The width the line table is comfortable at: its 726 px floor plus room for a longer amount. */
export const TAKEOFF_LINES_ROOMY_PX = 760
/** Under this the table cannot fit even with its side padding drawn in, so its box scrolls by itself. */
export const TAKEOFF_LINES_SNUG_PX = 620
/** One at a time: its list of fixtures, and the card's own border and padding around the table. */
export const TAKEOFF_FOCUS_LIST_PX = 300
export const TAKEOFF_FOCUS_CARD_CHROME_PX = 38

/** The narrowest Sheet that holds the list and the rail side by side. */
export const TAKEOFF_SHEET_BESIDE_PX = TAKEOFF_LINES_ROOMY_PX + TAKEOFF_GAP_PX + TAKEOFF_RAIL_PX
/** The narrowest One at a time that holds the fixtures list beside the fixture's card. */
export const TAKEOFF_FOCUS_BESIDE_PX = TAKEOFF_FOCUS_LIST_PX + TAKEOFF_GAP_PX + TAKEOFF_FOCUS_CARD_CHROME_PX + TAKEOFF_LINES_ROOMY_PX

/** Does the Sheet's rail fit beside the list? `sheetWidth` is the view's own width, not the window's. */
export function railFitsBeside(sheetWidth: number | null | undefined): boolean {
  return sheetWidth == null || sheetWidth >= TAKEOFF_SHEET_BESIDE_PX
}

/** Does One at a time's fixtures list fit beside the fixture's card? */
export function focusListFitsBeside(viewWidth: number | null | undefined): boolean {
  return viewWidth == null || viewWidth >= TAKEOFF_FOCUS_BESIDE_PX
}

/**
 * How the line table is drawn in its box.
 * - `roomy`: as it always was.
 * - `snug`: the side padding drawn in and the Actions heading dropped, which takes the floor from 726 px to about 600.
 * - `scroll`: narrower than that. The box scrolls sideways by itself, never the page, and the row's two
 *   presses stay pinned at its right edge.
 */
export type TakeoffLinesFit = 'roomy' | 'snug' | 'scroll'

const TIGHTER: Record<TakeoffLinesFit, TakeoffLinesFit> = { roomy: 'snug', snug: 'scroll', scroll: 'scroll' }

export function takeoffLinesFit(boxWidth: number | null | undefined): TakeoffLinesFit {
  if (boxWidth == null || boxWidth >= TAKEOFF_LINES_ROOMY_PX) return 'roomy'
  return boxWidth >= TAKEOFF_LINES_SNUG_PX ? 'snug' : 'scroll'
}

/**
 * The fit to draw, given the width's answer and how many times the table was seen
 * to overflow at this width anyway (a long amount, a fixture named in one unbroken
 * word). Each overflow steps one tighter, and `scroll` is the floor: it holds any table.
 */
export function tightenedLinesFit(base: TakeoffLinesFit, overflowsSeen: number): TakeoffLinesFit {
  let fit = base
  for (let i = 0; i < overflowsSeen; i += 1) fit = TIGHTER[fit]
  return fit
}
