import { useCallback, useEffect, useState } from 'react'
import {
  jobModeStorageKey,
  readJobModeEnabled,
  writeJobModeEnabled,
} from '../lib/jobModeToggle'

/**
 * Reads the per-user Job Mode flag from localStorage and stays in sync
 * across tabs via the storage event.
 */
export function useJobModeEnabled(
  userId: string | null | undefined,
): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readJobModeEnabled(userId))

  useEffect(() => {
    setEnabled(readJobModeEnabled(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const key = jobModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(e.newValue === '1')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writeJobModeEnabled(userId, next)
      setEnabled(next)
    },
    [userId],
  )

  return [enabled, set]
}
