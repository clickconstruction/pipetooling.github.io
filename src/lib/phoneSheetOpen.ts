/**
 * Whether a phone sheet is on the screen (punch list #410, v2.8507). A sheet rises from the bottom of a phone and
 * keeps its last press there: **Send write-up to HR**, **Read it back**. The app's *A new version is ready* pill is
 * fixed to the bottom of the screen on a higher layer, so it sat over that press until it was answered. The pill
 * reads this store and moves to the top of the screen while a sheet is open, into the band the sheet leaves free.
 *
 * `PhoneSheet` marks itself here for as long as it is drawn as a sheet. Pure module state with a subscribe, the
 * shape of `modalStack.ts`; `useSyncExternalStore` is the React glue.
 */

let open = 0
const listeners = new Set<() => void>()

function tell(): void {
  for (const cb of listeners) cb()
}

/** A sheet is on the screen from this call until the returned function is called. Calling it twice counts once. */
export function markPhoneSheetOpen(): () => void {
  open += 1
  tell()
  let closed = false
  return () => {
    if (closed) return
    closed = true
    open = Math.max(0, open - 1)
    tell()
  }
}

export function isPhoneSheetOpen(): boolean {
  return open > 0
}

export function subscribePhoneSheetOpen(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** The room a sheet leaves at the top of a phone: it is never taller than 85% of the screen. */
export const UPDATE_PILL_TOP = 'calc(var(--app-top-chrome, 0px) + 0.5rem)'
export const UPDATE_PILL_BOTTOM = '1rem'

/**
 * Pure: where the *A new version is ready* pill is pinned. At the bottom of the screen, as it always was. At the top
 * while a phone sheet is open, so the sheet's bottom press stays free.
 */
export function updatePillPlace(sheetOpen: boolean): { top: string } | { bottom: string } {
  return sheetOpen ? { top: UPDATE_PILL_TOP } : { bottom: UPDATE_PILL_BOTTOM }
}

/** Test seam: the store is module state. */
export function resetPhoneSheetOpenForTests(): void {
  open = 0
  listeners.clear()
}
