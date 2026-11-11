/**
 * One of the four link icons of the Bid Board's Links column (punch list #306), for the bid's Files window. The paths
 * are `lib/bids/bidLinkIconPaths.ts`, the ones the board's column draws. Filled with the current colour.
 */
import type { BoardLinkKind } from '../../lib/bids/bidBoardLinkSlots'
import { BID_LINK_ICON_PATHS } from '../../lib/bids/bidLinkIconPaths'

/** One link's icon, in the colour of the text around it. */
export function BidLinkGlyph({ kind, size = 20 }: { kind: BoardLinkKind; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={BID_LINK_ICON_PATHS[kind]} />
    </svg>
  )
}
