/**
 * A modal's full-screen toggle (v2.4045): the button in a `ResponsiveModalShell`
 * title bar that jumps the dialog between its centered window and the whole
 * screen, and remembers the choice per modal on this device.
 *
 * Pure: the shell reads and writes through these so the rule has one home.
 * The choice is per modal (`key`), not per user — it is a layout preference
 * for this screen, and a shared office machine keeps it for everyone.
 */

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const PREFIX = 'modal_full_screen'

export function modalFullScreenStorageKey(key: string): string {
  return `${PREFIX}_${key}`
}

/** The button's name and tooltip in each state: it names the other state, the one a press gives you. */
export const MODAL_FULL_SCREEN_ENTER_LABEL = 'Full screen'
export const MODAL_FULL_SCREEN_LEAVE_LABEL = 'Back to a window'

export function modalFullScreenToggleLabel(fullScreen: boolean): string {
  return fullScreen ? MODAL_FULL_SCREEN_LEAVE_LABEL : MODAL_FULL_SCREEN_ENTER_LABEL
}

function storageOrNull(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The remembered choice; false when nothing was kept or the store cannot be read (a private window). */
export function readModalFullScreen(key: string, storage?: StorageLike | null): boolean {
  const s = storageOrNull(storage)
  if (!s) return false
  try {
    return s.getItem(modalFullScreenStorageKey(key)) === '1'
  } catch {
    return false
  }
}

/** Keeps the choice; the window state removes the key so a modal never remembers the default. */
export function writeModalFullScreen(key: string, fullScreen: boolean, storage?: StorageLike | null): void {
  const s = storageOrNull(storage)
  if (!s) return
  try {
    if (fullScreen) s.setItem(modalFullScreenStorageKey(key), '1')
    else s.removeItem(modalFullScreenStorageKey(key))
  } catch {
    // A full store or a blocked one: the toggle still works for this open, it just is not remembered.
  }
}
