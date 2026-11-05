/**
 * Where the office keeps its Every step choice for the By step board on this device (punch list #109, v2.6540); absent
 * reads as on, the owner's rule of 2026-10-15 that every step keeps its row. Pure but for the window's storage.
 */
export const EVERY_STEP_KEY = 'gcBoardEveryStep'

export function readEveryStep(): boolean {
  try {
    return window.localStorage.getItem(EVERY_STEP_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeEveryStep(on: boolean): void {
  try {
    window.localStorage.setItem(EVERY_STEP_KEY, on ? '1' : '0')
  } catch {
    // A browser with no storage keeps the choice for the page only.
  }
}
