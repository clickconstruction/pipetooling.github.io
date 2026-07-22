import { useCallback, useEffect, useState } from 'react'
import {
  DISPATCH_MODE_CHANGED_EVENT,
  dispatchModeStorageKey,
  readDispatchModeEnabled,
  writeDispatchModeEnabled,
} from '../lib/dispatchModeToggle'

/**
 * Reads the per-user Dispatch Mode flag from localStorage; syncs across tabs
 * via the storage event and within the tab via DISPATCH_MODE_CHANGED_EVENT.
 */
export function useDispatchModeEnabled(
  userId: string | null | undefined,
): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readDispatchModeEnabled(userId))

  useEffect(() => {
    setEnabled(readDispatchModeEnabled(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const key = dispatchModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(e.newValue === '1')
    }
    function onLocalChange() {
      setEnabled(readDispatchModeEnabled(userId))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(DISPATCH_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(DISPATCH_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writeDispatchModeEnabled(userId, next)
      setEnabled(next)
      window.dispatchEvent(new Event(DISPATCH_MODE_CHANGED_EVENT))
    },
    [userId],
  )

  return [enabled, set]
}
