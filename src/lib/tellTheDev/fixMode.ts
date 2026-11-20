/**
 * Tell the dev (punch list #380): the gear menu's switch for the wrench. The row reads Tell the dev;
 * it read Fix Mode until v2.8043, and the names here and the stored key keep that word.
 *
 * On, the wrench shows: floating at a desk, in the header on a phone, in a window's title row and
 * on an error line. Off, every wrench is gone from this person's screens on this device. It starts
 * on, so a person meets the wrench without having to find a switch first. The box under a Help
 * guide is not a wrench and stays either way.
 *
 * Kept per person per device in localStorage, as Job Mode is. Pure reads and writes over a
 * storage handed in, so the tests need no browser.
 */

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const FIX_MODE_CHANGED_EVENT = 'pipetooling:fix-mode-changed'

export function fixModeStorageKey(userId: string): string {
  return `pt_fix_mode_${userId}`
}

/** Whether this person has opened the box once, after which the wrench drops its words. */
export function wrenchOpenedStorageKey(userId: string): string {
  return `pt_wrench_opened_${userId}`
}

function safeGet(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: StorageLike | null | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // A phone with storage switched off keeps the default.
  }
}

/** On unless this person switched it off on this device. No person, no wrench. */
export function readFixMode(storage: StorageLike | null | undefined, userId: string | null | undefined): boolean {
  if (!userId) return false
  return safeGet(storage, fixModeStorageKey(userId)) !== 'off'
}

export function writeFixMode(storage: StorageLike | null | undefined, userId: string | null | undefined, on: boolean): void {
  if (!userId) return
  safeSet(storage, fixModeStorageKey(userId), on ? 'on' : 'off')
}

export function readWrenchOpened(storage: StorageLike | null | undefined, userId: string | null | undefined): boolean {
  if (!userId) return false
  return safeGet(storage, wrenchOpenedStorageKey(userId)) === '1'
}

export function writeWrenchOpened(storage: StorageLike | null | undefined, userId: string | null | undefined): void {
  if (!userId) return
  safeSet(storage, wrenchOpenedStorageKey(userId), '1')
}
