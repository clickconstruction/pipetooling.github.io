import { useCallback, useEffect, useState } from 'react'
import { useNarrowViewport640 } from './useNarrowViewport640'
import {
  NEW_PHONE_LAYOUT_CHANGED_EVENT,
  NEW_PHONE_LAYOUT_STORAGE_KEY,
  newPhoneLayoutOn,
  readNewPhoneLayoutStored,
  writeNewPhoneLayoutStored,
} from '../lib/phoneLayout/newPhoneLayout'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export type NewPhoneLayout = {
  /** The one answer a screen reads: the switch is ticked on this device and the screen is a phone's width. */
  on: boolean
  /** Whether this device has the switch ticked, at any width. The gear menu's tick reads this. */
  stored: boolean
  /** Tick or untick the switch on this device. */
  setStored: (next: boolean) => void
}

/**
 * The new phone layout's switch (`lib/phoneLayout/newPhoneLayout.ts`), read by the shell and by every
 * screen in the trial. Kept per device, and in step across tabs (the storage event) and within the
 * tab (`NEW_PHONE_LAYOUT_CHANGED_EVENT`), as the gear menu's other ticks are. The width is the app's
 * own phone rule, `useNarrowViewport640`.
 */
export function useNewPhoneLayout(): NewPhoneLayout {
  const phoneWidth = useNarrowViewport640()
  const [stored, setStoredState] = useState<boolean>(() => readNewPhoneLayoutStored(storage()))

  useEffect(() => {
    const read = () => setStoredState(readNewPhoneLayoutStored(storage()))
    const onStorage = (e: StorageEvent) => {
      // A cleared storage reports no key.
      if (e.key === NEW_PHONE_LAYOUT_STORAGE_KEY || e.key === null) read()
    }
    read()
    window.addEventListener('storage', onStorage)
    window.addEventListener(NEW_PHONE_LAYOUT_CHANGED_EVENT, read)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(NEW_PHONE_LAYOUT_CHANGED_EVENT, read)
    }
  }, [])

  const setStored = useCallback((next: boolean) => {
    writeNewPhoneLayoutStored(storage(), next)
    setStoredState(readNewPhoneLayoutStored(storage()))
    window.dispatchEvent(new Event(NEW_PHONE_LAYOUT_CHANGED_EVENT))
  }, [])

  return { on: newPhoneLayoutOn({ stored, phoneWidth }), stored, setStored }
}
