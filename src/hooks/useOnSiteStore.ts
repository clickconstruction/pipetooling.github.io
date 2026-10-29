/**
 * Materials on site (punch list #209): the on-site store as React state. `useOnSiteStoreVersion`
 * re-renders a reader on every write and load; `useOnSiteJob` loads one job when the screen opens on
 * it and reports how that read stands; `useOnSiteDesk` does the same for every job with a box.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { deskLoadState, getVersion, jobLoadState, loadDesk, loadJob, subscribe, type LoadState } from '../lib/materials/onSiteStore'

export function useOnSiteStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}

/** Loads the job once per id (and again after a failure when `retry` is pressed), and reads how the load stands. */
export function useOnSiteJob(jobId: string | null): LoadState & { retry: () => void } {
  useOnSiteStoreVersion()
  useEffect(() => {
    if (jobId) void loadJob(jobId)
  }, [jobId])
  const state: LoadState = jobId ? jobLoadState(jobId) : { loaded: false, loading: false, error: null, raw: null }
  return { ...state, retry: () => { if (jobId) void loadJob(jobId, { force: true }) } }
}

/** Loads every job with a live container, for the desk, the tools menu's count and the header's box search. */
export function useOnSiteDesk(enabled = true): LoadState & { retry: () => void } {
  useOnSiteStoreVersion()
  useEffect(() => {
    if (enabled) void loadDesk()
  }, [enabled])
  return { ...deskLoadState(), retry: () => void loadDesk({ force: true }) }
}
