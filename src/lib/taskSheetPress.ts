/**
 * Task cards: what a sheet's press came to (punch list #273, v2.6628). The % sheet's Set and the finishing sheet's Done
 * resolve one of these: `ok` closes the sheet; `shotKept` says the shot taken on the sheet waits on the phone for the
 * outbox (the signal was lost), whether or not the rest of the press landed, so the tile reads *Kept on the phone* and
 * the next press sends it no more. A caller with no camera flow may still answer a bare boolean, which is `ok` alone.
 */
export type SheetPressOutcome = { ok: boolean; shotKept?: boolean }

export function sheetOutcome(r: boolean | SheetPressOutcome): SheetPressOutcome {
  return typeof r === 'boolean' ? { ok: r } : r
}
