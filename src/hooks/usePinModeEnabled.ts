import { useCallback, useEffect, useState } from 'react'
import {
  PIN_MODE_CHANGED_EVENT,
  pinModeStorageKey,
  readPinModeEnabled,
  writePinModeEnabled,
} from '../lib/pinModeToggle'

/**
 * Reads the per-user Pin Mode flag from localStorage and stays in sync
 * across tabs via the storage event. Mirrors `useFarmModeEnabled`.
 */
export function usePinModeEnabled(
  userId: string | null | undefined,
): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readPinModeEnabled(userId))

  useEffect(() => {
    setEnabled(readPinModeEnabled(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const key = pinModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(e.newValue === '1')
    }
    function onLocalChange() {
      setEnabled(readPinModeEnabled(userId))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(PIN_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(PIN_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writePinModeEnabled(userId, next)
      setEnabled(next)
      window.dispatchEvent(new Event(PIN_MODE_CHANGED_EVENT))
    },
    [userId],
  )

  return [enabled, set]
}
