import { useCallback, useEffect, useState } from 'react'
import {
  FARM_MODE_CHANGED_EVENT,
  farmModeStorageKey,
  readFarmModeEnabled,
  writeFarmModeEnabled,
} from '../lib/farmModeToggle'

/**
 * Reads the per-user Farm Mode flag from localStorage and stays in sync
 * across tabs via the storage event. Mirrors `useJobModeEnabled`.
 */
export function useFarmModeEnabled(
  userId: string | null | undefined,
): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readFarmModeEnabled(userId))

  useEffect(() => {
    setEnabled(readFarmModeEnabled(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const key = farmModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(e.newValue === '1')
    }
    function onLocalChange() {
      setEnabled(readFarmModeEnabled(userId))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(FARM_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(FARM_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writeFarmModeEnabled(userId, next)
      setEnabled(next)
      window.dispatchEvent(new Event(FARM_MODE_CHANGED_EVENT))
    },
    [userId],
  )

  return [enabled, set]
}
