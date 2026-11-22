/**
 * Where a person's thread window sits on a phone, and what it gives up when little of the page shows (the phone walk
 * of 2026-11-21, punch list #348).
 *
 * The window was pinned to the page, `inset: 0`. An iPhone does not shrink the page for the keyboard: it shrinks the
 * part that shows and slides it down the page to the field being typed in. The reply box came to rest on the keyboard
 * and the window's header, with the way back, the name and ⋯, left the top of the screen. So on a phone the window
 * follows the part that shows (`visibleBand`), as the task windows (v2.7155) and the sheets inside this window
 * (v2.7188) do.
 *
 * Following alone is not enough. The keyboard leaves an iPhone about 375 px. The whole header, the flow strip, the
 * lines' floor and the reply box are taller than that, and the window cut what was over: the foot of the box, the
 * field being typed in. So the window has an order for what gives way, `threadRoom`:
 *
 * 1. The reply box stays whole. It is what the keyboard is up for.
 * 2. The header's first row stays: the way back, the name, call and ⋯.
 * 3. The header's other rows and the flow strip fold away until the room is back. Each wears `THREAD_TIGHT_FOLD_ATTR`
 *    and one rule in `index.css` hides it, unless it holds the field being typed in.
 * 4. The lines keep no floor. They take what is left.
 *
 * Where even that does not fit, the lines and the box scroll as one, so the box's foot can be reached and is never cut.
 *
 * At a desk, and where the browser cannot say what shows, the window is as it was.
 */
import type { VisibleBand } from '../visibleBand'

export type ThreadWindowPlace = { inset: 0 } | { top: number; left: 0; right: 0; height: string }

export function threadWindowPlace(phone: boolean, band: VisibleBand | null): ThreadWindowPlace {
  if (!phone || !band) return { inset: 0 }
  return { top: band.top, left: 0, right: 0, height: `${band.height}px` }
}

/** The lines' floor in the window: a few rows always show, between whatever a cut draws over them and the reply box. */
export const THREAD_LINES_FLOOR = 'max(7rem, 33%)'

/**
 * Under this many px of screen showing, a phone's room is tight. An iPhone 17 in Safari shows about 375 with the
 * keyboard up and 700 without; the smallest iPhone shows about 550 without. So in Safari this is the keyboard, and
 * a small phone on its side. A room of 480 or more that is still too short for every part scrolls (`columnScrolls`).
 */
export const THREAD_TIGHT_BAND_PX = 480

/** The mark on what waits while the room is tight. `index.css` hides it, but never while the focus is inside it. */
export const THREAD_TIGHT_FOLD_ATTR = 'data-thread-tight-fold'

export interface ThreadRoom {
  /** Little of the page shows on a phone: the keyboard is up, or a small phone lies on its side. */
  tight: boolean
  /** The header's rows under its first, and the flow strip under the header, are drawn; else they wear the fold's mark. */
  rest: boolean
  /** The floor under the lines, as CSS. */
  linesFloor: string | 0
  /** The lines and the box scroll as one when they are taller than the room, where they were cut before. */
  columnScrolls: boolean
}

/** What the window draws for the room a phone shows. A desk, and a browser that cannot say, get the whole window. */
export function threadRoom(phone: boolean, band: VisibleBand | null): ThreadRoom {
  if (!phone || !band) return { tight: false, rest: true, linesFloor: THREAD_LINES_FLOOR, columnScrolls: false }
  const tight = band.height < THREAD_TIGHT_BAND_PX
  return { tight, rest: !tight, linesFloor: tight ? 0 : THREAD_LINES_FLOOR, columnScrolls: true }
}

/**
 * A person has pinched the page larger: less of its width shows than it has. The part that shows is then a corner of
 * the page under their fingers, not the room a keyboard left, and a window that followed it would shrink and jump as
 * they read. Safari's own text size (the aA menu) is not a pinch: there the page itself is narrower and all of it shows.
 */
export function isPagePinched(shownWidth: number | null | undefined, pageWidth: number | null | undefined): boolean {
  if (!shownWidth || !pageWidth || !Number.isFinite(shownWidth) || !Number.isFinite(pageWidth)) return false
  return shownWidth < pageWidth - 1
}
