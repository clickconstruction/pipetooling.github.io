/**
 * The door on the Board's Retainage line (the owner's pick of 2026-11-18, the last pieces of punch list #383's drawing).
 *
 * Under the notices' column the Board says retainage in one line, *Retainage · 1 to send for approval · 6 look held,
 * not on the job* (`lienBoardRetainageLine`). It was words alone: retainage has no bin and no chip, so the line was
 * the Board's only mention of it and led nowhere. It now ends in *Open ›*, the door to By paper's Retainage list,
 * whole and with nothing typed in the find box, where every count on the line has its rows: the piles, and above
 * them the jobs whose retainage looks held and is not on the job.
 *
 * Here: the door's words, and whether the line carries one. Pure.
 */

/** The door's words, with no arrow: the view adds *›*. */
export const LIEN_BOARD_RETAINAGE_DOOR = 'Open'

/** What the door opens, for the press's hover and a screen reader. */
export const LIEN_BOARD_RETAINAGE_DOOR_HINT = 'Open the Retainage list on By paper'

/**
 * The Retainage line as the Board draws it: its words, and the door's words when the desk hands a door. Null when
 * the Board has no line, so a door never stands alone.
 */
export function lienBoardRetainageDoor(line: string | null | undefined, hasDoor: boolean): { words: string; door: string | null } | null {
  const words = line?.trim()
  if (!words) return null
  return { words, door: hasDoor ? LIEN_BOARD_RETAINAGE_DOOR : null }
}
