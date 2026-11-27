/**
 * Where **Which site is it for?** sits on a phone, and what it gives up when little of the page shows (finding 337 of
 * the fixing ledger, punch list #439, piece 3).
 *
 * The window's backdrop was pinned to the page, `inset: 0`, with the window centred in it. An iPhone does not shrink
 * the page for the keyboard: it shrinks the part that shows and slides it down the page to the field being typed in.
 * So with the address box in hand on a small phone the window's head, and its ×, sat above the top of the screen. It
 * is the fault the thread window had (`lib/messages/threadWindowFrame.ts`), and the mend is the same: on a phone the
 * backdrop follows the part that shows (`visibleBand`).
 *
 * Following alone would hide the rows instead. A small phone shows about 280 px with the keyboard up, and the head,
 * the lead, the first choice and the box are taller than that. So while the room is tight the window has an order:
 *
 * 1. The head stays, always: the title and the ×. It never scrolls.
 * 2. The address box stays. It is what the keyboard is up for.
 * 3. The lead gives way.
 * 4. **It is not for a site** gives way once something is typed, since the person is then finding an address. An
 *    empty box brings it back.
 * 5. The rows take what is left, and scroll.
 *
 * At a desk, and where the browser cannot say what shows, the window is as it was.
 *
 * Pure: no React, no DOM.
 */
import type { VisibleBand } from '../visibleBand'

/** A phone, as the thread window reads one. */
export const PICKER_PHONE_QUERY = '(max-width: 760px)'

/** Under this many px of screen showing, a phone's room is tight: the keyboard is up, or a small phone lies on its side. */
export const PICKER_TIGHT_BAND_PX = 480

export type PickerPlace = { inset: 0 } | { top: number; left: 0; right: 0; height: string }

export interface PickerRoom {
  /** Where the backdrop sits: the whole page, or the part of it that shows. */
  place: PickerPlace
  /** Little of the page shows on a phone. */
  tight: boolean
  /** The line under the title is drawn. */
  lead: boolean
  /** The first choice, which answers no site, is drawn. */
  none: boolean
}

/** What the window draws for the room a phone shows. A desk, and a browser that cannot say, get the whole window. */
export function pickerRoom(phone: boolean, band: VisibleBand | null, typed: string): PickerRoom {
  if (!phone || !band) return { place: { inset: 0 }, tight: false, lead: true, none: true }
  const tight = band.height < PICKER_TIGHT_BAND_PX
  return {
    place: { top: band.top, left: 0, right: 0, height: `${band.height}px` },
    tight,
    lead: !tight,
    none: !tight || typed.trim() === '',
  }
}
