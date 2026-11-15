/**
 * What the find box says once it is pinned over the Lien desk's To do list (v2.7367, punch list #362, step 1).
 *
 * When To do scrolls as one page (`lienDoNowFrame`), the Board leaves the screen as the list comes up. The find
 * box then stands at the top with the Board's own numbers beside it, so the count that matters stays in sight
 * and its press stays in reach: *21 by tomorrow*, *3 waiting on Malachi*, *7 in the run*. The words and the doors
 * are the tiles' (`lienBoard.ts`); nothing is counted again here. The money tile is left out, since it is not a
 * count of work, and so is a tile at zero.
 */
import { lienBoardDots, type LienBoard, type LienBoardTile, type LienBoardTileDestination, type LienBoardTileKey } from './lienBoard'

export type LienDoNowBarPart = {
  key: LienBoardTileKey
  /** The figure and its words, as one label: *21 by tomorrow*. */
  words: string
  tone: LienBoardTile['tone']
  /** The tile's own door, or null for a tile that only reads. */
  destination: LienBoardTileDestination | null
}

/** The way back to the picture, on the pinned bar. */
export const LIEN_DO_NOW_UP_WORDS = '↑ The Board'

export function lienDoNowBarParts(board: Pick<LienBoard, 'tiles' | 'dayWords'>): LienDoNowBarPart[] {
  const dots = lienBoardDots(board)
  return board.tiles
    .map((tile, i) => ({ tile, dot: dots[i]! }))
    .filter(({ tile }) => tile.key !== 'unpaid' && tile.figure !== '0')
    .map(({ tile, dot }) => ({ key: tile.key, words: `${dot.figure} ${dot.words}`, tone: tile.tone, destination: tile.destination }))
}
