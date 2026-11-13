import { useCallback, useEffect, useState } from 'react'
import {
  TASK_MODE_CHANGED_EVENT,
  taskModeStorageKey,
  readTaskModeEnabled,
  writeTaskModeEnabled,
} from '../lib/taskModeToggle'

/**
 * Reads the per-user Task Mode flag from localStorage and stays in sync
 * across tabs via the storage event. Mirrors `useJobModeEnabled`.
 */
export function useTaskModeEnabled(
  userId: string | null | undefined,
): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readTaskModeEnabled(userId))

  useEffect(() => {
    setEnabled(readTaskModeEnabled(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const key = taskModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(e.newValue === '1')
    }
    function onLocalChange() {
      setEnabled(readTaskModeEnabled(userId))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(TASK_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(TASK_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writeTaskModeEnabled(userId, next)
      setEnabled(next)
      window.dispatchEvent(new Event(TASK_MODE_CHANGED_EVENT))
    },
    [userId],
  )

  return [enabled, set]
}
