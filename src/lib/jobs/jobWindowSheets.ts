/**
 * A job window's sheets on a phone, and the bar at the window's foot (the owner's phone walk of 2026-11-21).
 *
 * The walk found the bar drawn over the Note sheet with the keyboard up: one line of the note box showed, Save was
 * hidden, and Ready to bill and Arrived sat where a thumb lands. Two rules came out of it, both held here. Pure.
 */
import type { CSSProperties } from 'react'

/** Which of a job window's own sheets are up: Status ▾, the ⋯ sheet, and Note. */
export type JobWindowSheetsOpen = { status?: boolean; more?: boolean; note?: boolean }

/**
 * The bar stands down while any sheet opened from the window is up. It keeps its room, so the body behind does not
 * move, but it is not drawn and takes no press. A sheet is then never under the bar, whatever a browser does with
 * the layers, and a press that writes (Ready to bill, Arrived) is never beside the keyboard.
 */
export function jobWindowBarStandsDown(open: JobWindowSheetsOpen): boolean {
  return Boolean(open.status || open.more || open.note)
}

/**
 * How a job window's body scrolls on a phone. No `-webkit-overflow-scrolling: touch`: an iPhone has scrolled every
 * box that way by itself since iOS 13, and all the property still does there is make the box a layer of its own.
 * A window pinned to the screen from inside such a box (the Note sheet was one) is then cut to the box's edge, which
 * is the bar's top edge. A desktop browser ignores the property, so the cut never showed at a desk.
 */
export const JOB_WINDOW_BODY_SCROLL: CSSProperties = { overflowY: 'auto', overscrollBehavior: 'contain' }
