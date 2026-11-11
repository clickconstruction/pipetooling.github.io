/**
 * The Bid Board's Links column, each link in its own place (punch list #306). The column drew an icon only for a
 * link the bid has and centred what it drew, so the folder on one row sat where the plans icon sat on the next, and
 * the photos icon moved with them. Every link kind now has a fixed slot, in one order, so an icon is always found in
 * the same spot down the column: Photos first (the tab draws it), then these four. A kind the bid has none of leaves
 * its slot empty; a second link of a kind (a second CountTooling project) follows the slots.
 */

export type BoardLinkKind = 'folder' | 'plans' | 'count' | 'submission'

/** The slots after Photos, left to right. */
export const BOARD_LINK_ORDER: readonly BoardLinkKind[] = ['folder', 'plans', 'count', 'submission']

/** How many slots the row holds, the photos slot counted when it is drawn. */
export function boardLinkSlotCount(withPhotos: boolean): number {
  return BOARD_LINK_ORDER.length + (withPhotos ? 1 : 0)
}

/**
 * The bid's links laid into the fixed slots: the first link of each kind in its slot (null where the bid has none),
 * and every further link of a kind after them, in the order given.
 */
export function boardLinkSlots<L extends { kind: BoardLinkKind }>(links: readonly L[]): { slots: Array<L | null>; extra: L[] } {
  const slots: Array<L | null> = BOARD_LINK_ORDER.map(() => null)
  const extra: L[] = []
  for (const link of links) {
    const at = BOARD_LINK_ORDER.indexOf(link.kind)
    if (at >= 0 && slots[at] == null) slots[at] = link
    else extra.push(link)
  }
  return { slots, extra }
}
