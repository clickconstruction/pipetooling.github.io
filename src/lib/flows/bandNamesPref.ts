/**
 * Where the office keeps the By step board's band heads on this device (punch list #109, v2.6542): the dots folded, or
 * unfolded to the names. Absent reads as dots, the board's first shape. The twin of `everyStepPref.ts`, pure but for
 * the window's storage.
 */
export const BAND_NAMES_KEY = 'gcBoardBandNames'

export function readBandNames(): boolean {
  try {
    return window.localStorage.getItem(BAND_NAMES_KEY) === '1'
  } catch {
    return false
  }
}

export function writeBandNames(on: boolean): void {
  try {
    window.localStorage.setItem(BAND_NAMES_KEY, on ? '1' : '0')
  } catch {
    // A browser with no storage keeps the choice for the page only.
  }
}
