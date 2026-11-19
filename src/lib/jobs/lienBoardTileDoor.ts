/**
 * The words for a Board tile's door (the owner's pick of 2026-11-18, the last pieces of punch list #383's drawing).
 *
 * The second tile, *waiting on the leader*, and the third, *to print and mail*, are presses since v2.7448 and v2.7367,
 * and nothing on them said so: a tile read as a figure. Each now carries its door's words at its top right, in the
 * link colour: *Show them ›* narrows the list under the Board to the papers that wait on the leader, and
 * *Open the run ›* opens the print and mail run. While the list is narrowed to the leader's papers the second tile's
 * press puts the list back, so its words say that, as the line under the bins does.
 *
 * Words only: the doors are the tiles' own (`LienBoardTile.destination`), and a tile with no press gets none. The
 * first tile's red line is a press of its own and carries its own words. Pure.
 */
import type { LienBoardPick, LienBoardTile, LienBoardTileDestination } from './lienBoard'

/** The door's words, with no arrow: the view adds *›*. */
export const LIEN_BOARD_TILE_DOOR = {
  leader: 'Show them',
  /** The same words as the press on the line under the bins (`lienBoardPickWords`). */
  leaderPicked: 'Show every row',
  run: 'Open the run',
} as const

/**
 * Whether the list under the Board is narrowed to this tile's papers. The leader's pick is named as the tile is,
 * *waiting on Sam*, and a pressed bin is named for its bin, so the name alone tells them apart.
 */
export function lienBoardTilePicked(tile: Pick<LienBoardTile, 'label' | 'destination'>, pick: Pick<LienBoardPick, 'label'> | null | undefined): boolean {
  return Boolean(pick && tile.destination?.kind === 'leader' && pick.label === tile.label)
}

/** What a tile's press says it does, or null for a tile that only reads and for a door that is a line's own. */
export function lienBoardTileDoorWords(destination: LienBoardTileDestination | null | undefined, picked = false): string | null {
  if (!destination) return null
  if (destination.kind === 'leader') return picked ? LIEN_BOARD_TILE_DOOR.leaderPicked : LIEN_BOARD_TILE_DOOR.leader
  if (destination.kind === 'run') return LIEN_BOARD_TILE_DOOR.run
  return null
}
