import { useCallback, useEffect, useState } from 'react'
import {
  JOB_MODE_CHANGED_EVENT,
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
    function onLocalChange() {
      setEnabled(readJobModeEnabled(userId))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(JOB_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(JOB_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writeJobModeEnabled(userId, next)
      setEnabled(next)
      window.dispatchEvent(new Event(JOB_MODE_CHANGED_EVENT))
    },
    [userId],
  )

  return [enabled, set]
}
