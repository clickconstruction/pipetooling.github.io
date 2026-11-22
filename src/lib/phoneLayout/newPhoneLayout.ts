/**
 * The new phone layout's switch: one tick in the gear menu's Show group, reading **New phone layout**.
 *
 * It is a trial. Off, every screen is drawn as it was before the switch existed. On, and only on a
 * screen of a phone's width, the shell and the screens that read `useNewPhoneLayout` draw their
 * phone layout a second way. One rule (`newPhoneLayoutOn`), so every screen in the trial turns
 * with the same tick and none can be on while another is off.
 *
 * Kept per DEVICE, not per person: the stored key carries no user id. A dev who ticks it and then
 * uses View as keeps the layout while looking at another role, and the choice is this phone's.
 *
 * Who is offered the tick is `NEW_PHONE_LAYOUT_TICK_ROLES`, the one list to widen. A device that
 * already has the layout on draws the tick for whoever is signed in, so nobody is left on a layout
 * they have no press to leave.
 *
 * Pure reads and writes over a storage handed in, so the tests need no browser.
 */
import type { UserRole } from '../../hooks/useAuth'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The stored key. No user id in it: the switch is the device's. */
export const NEW_PHONE_LAYOUT_STORAGE_KEY = 'pt_new_phone_layout'

/** Same-tab change signal: a `storage` event only fires in other tabs. */
export const NEW_PHONE_LAYOUT_CHANGED_EVENT = 'pipetooling:new-phone-layout-changed'

/** The row's name in the gear menu and in the phone dock's More sheet. */
export const NEW_PHONE_LAYOUT_SWITCH_LABEL = 'New phone layout'

/** The switch's name for a screen reader, read with its pressed state. */
export const NEW_PHONE_LAYOUT_SWITCH_ARIA = 'Use the new phone layout'

/** The roles offered the tick while it is a trial. Widen this list to offer it to more people. */
export const NEW_PHONE_LAYOUT_TICK_ROLES: readonly UserRole[] = ['dev', 'master_technician']

function safeGet(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Whether this device has the switch ticked. Off when nothing is stored, or storage cannot be read. */
export function readNewPhoneLayoutStored(storage: StorageLike | null | undefined): boolean {
  return safeGet(storage, NEW_PHONE_LAYOUT_STORAGE_KEY) === '1'
}

/** Tick or untick the switch on this device. Unticked stores nothing, so a device is as it was before the switch. */
export function writeNewPhoneLayoutStored(storage: StorageLike | null | undefined, on: boolean): void {
  try {
    if (on) storage?.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
    else storage?.removeItem(NEW_PHONE_LAYOUT_STORAGE_KEY)
  } catch {
    // A phone with storage switched off keeps the layout it has: the old one.
  }
}

/**
 * The one rule every screen in the trial reads: the switch is ticked on this device AND the screen
 * is a phone's width by the app's own rule (`useNarrowViewport640`). Off, or at a desk, nothing
 * changes for anyone.
 */
export function newPhoneLayoutOn(input: { stored: boolean; phoneWidth: boolean }): boolean {
  return input.stored && input.phoneWidth
}

/**
 * Whether the gear menu draws the tick. Only on a screen of a phone's width, where the tick does
 * something: at a desk the menu is the menu it was. There, for the roles in the trial, and for anyone
 * on a device that already has it ticked, so the way off is always on the screen drawn the new way.
 */
export function newPhoneLayoutTickShown(input: { role: UserRole | string | null | undefined; stored: boolean; phoneWidth: boolean }): boolean {
  if (!input.phoneWidth) return false
  if (input.stored) return true
  return input.role != null && (NEW_PHONE_LAYOUT_TICK_ROLES as readonly string[]).includes(input.role)
}

/** What a press will do, said as the act: the row is ticked while the new layout is in use. */
export function newPhoneLayoutSwitchTip(on: boolean): string {
  return on ? 'Go back to the phone layout you had before' : 'Try the new phone layout on this phone. It is a trial.'
}
