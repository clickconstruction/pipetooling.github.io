// Punch list #61, PR 2a (v2.5120): the dev's switch for ZZ test jobs. One line in the Pipeline's Hide
// groups… shows or hides them, per device, hidden by default. Every reader of the rule (the jobs
// cache, the Pipeline strip, Quickfill's money, the Dashboard's money) subscribes to this one value,
// so a flip on the Pipeline moves them all at once. Only a dev's flip counts: `hidesZzTestJobs`
// ignores it for every other role.

import { useSyncExternalStore } from 'react'
import { hidesZzTestJobs } from './zzTestJobVisibility'

export const ZZ_TEST_JOBS_SHOWN_STORAGE_KEY = 'jobs-stages-show-zz'
const CHANGE_EVENT = 'pipetooling:zz-test-jobs-shown'

/** Whether this device's dev chose to show ZZ test jobs. Unreadable storage reads as hidden. */
export function readDevShowsZzTestJobs(): boolean {
  try {
    return localStorage.getItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Show or hide ZZ test jobs on this device, and tell every reader in this tab. */
export function setDevShowsZzTestJobs(show: boolean): void {
  try {
    if (show) localStorage.setItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY, '1')
    else localStorage.removeItem(ZZ_TEST_JOBS_SHOWN_STORAGE_KEY)
  } catch {
    /* private mode: the choice lasts until the page reloads */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === ZZ_TEST_JOBS_SHOWN_STORAGE_KEY) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** The dev's choice, live: a flip in this tab or another one re-renders every reader. */
export function useDevShowsZzTestJobs(): boolean {
  return useSyncExternalStore(subscribe, readDevShowsZzTestJobs, () => false)
}

/** Whether ZZ test jobs are hidden for this role on this device: `hidesZzTestJobs` with the live switch. */
export function useZzTestJobsHidden(role: string | null | undefined): boolean {
  return hidesZzTestJobs(role, useDevShowsZzTestJobs())
}
