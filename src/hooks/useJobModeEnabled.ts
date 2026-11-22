import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import { useNewPhoneLayout } from './useNewPhoneLayout'
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
 *
 * Under the new phone layout (`useNewPhoneLayout`) an absent key is ON for a
 * master technician and a superintendent too. The hook hands the rule that one
 * answer and reads again when the tick or the width turns, so the shell and the
 * Dashboard, which both read the mode through `usePageMode`, turn together.
 */
export function useJobModeEnabled(
  userId: string | null | undefined,
  role: UserRole | string | null | undefined,
): [boolean, (next: boolean, source?: Exclude<JobModeSource, 'default'>) => void] {
  const newPhoneLayout = useNewPhoneLayout().on
  const [enabled, setEnabled] = useState<boolean>(() => readJobModeEnabled(userId, role, { newPhoneLayout }))

  useEffect(() => {
    setEnabled(readJobModeEnabled(userId, role, { newPhoneLayout }))
  }, [userId, role, newPhoneLayout])

  useEffect(() => {
    if (!userId) return
    const key = jobModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(readJobModeEnabled(userId, role, { newPhoneLayout }))
    }
    function onLocalChange() {
      setEnabled(readJobModeEnabled(userId, role, { newPhoneLayout }))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(JOB_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(JOB_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId, role, newPhoneLayout])

  const set = useCallback(
    (next: boolean, source: Exclude<JobModeSource, 'default'> = 'gear') => {
      writeJobModeEnabled(userId, next, source)
      setEnabled(readJobModeEnabled(userId, role, { newPhoneLayout }))
      window.dispatchEvent(new Event(JOB_MODE_CHANGED_EVENT))
    },
    [userId, role, newPhoneLayout],
  )

  return [enabled, set]
}
