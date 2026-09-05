import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import {
  JOB_MODE_CHANGED_EVENT,
  jobModeStorageKey,
  readJobModeEnabled,
  writeJobModeEnabled,
  type JobModeSource,
} from '../lib/jobModeToggle'

/**
 * Reads the per-user Job Mode flag from localStorage — resolved through the
 * role default (`isJobModeEnabled`: absent key ⇒ ON for sub-like roles, OFF
 * otherwise; ineligible roles always OFF) — and stays in sync across tabs via
 * the storage event and within the tab via `JOB_MODE_CHANGED_EVENT`.
 */
export function useJobModeEnabled(
  userId: string | null | undefined,
  role: UserRole | string | null | undefined,
): [boolean, (next: boolean, source?: Exclude<JobModeSource, 'default'>) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readJobModeEnabled(userId, role))

  useEffect(() => {
    setEnabled(readJobModeEnabled(userId, role))
  }, [userId, role])

  useEffect(() => {
    if (!userId) return
    const key = jobModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(readJobModeEnabled(userId, role))
    }
    function onLocalChange() {
      setEnabled(readJobModeEnabled(userId, role))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(JOB_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(JOB_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId, role])

  const set = useCallback(
    (next: boolean, source: Exclude<JobModeSource, 'default'> = 'gear') => {
      writeJobModeEnabled(userId, next, source)
      setEnabled(readJobModeEnabled(userId, role))
      window.dispatchEvent(new Event(JOB_MODE_CHANGED_EVENT))
    },
    [userId, role],
  )

  return [enabled, set]
}
