/**
 * Materials on site (punch list #209): the on-site store as React state. `useOnSiteStoreVersion`
 * re-renders a reader on every write and load; `useOnSiteJob` loads one job when the screen opens on
 * it and reports how that read stands; `useOnSiteDesk` does the same for every job with a box.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { deskLoadState, getVersion, jobLoadState, loadDesk, loadJob, refreshDesk, refreshJob, subscribe, type LoadState } from '../lib/materials/onSiteStore'
import { ON_SITE_REFRESH_EVERY_MS } from '../lib/materials/onSiteFresh'

export function useOnSiteStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}

/**
 * Reads again by itself (v2.7177, punch list #344 PR 4): when the page comes back to the front, the window takes the
 * focus, the signal returns, and every few minutes while the page stays in front. `refresh` decides whether its last
 * read is old enough; a read made this way is quiet.
 */
function useReadsAgain(key: string | null, refresh: () => void): void {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    if (!key || typeof window === 'undefined') return
    const ask = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refreshRef.current()
    }
    window.addEventListener('focus', ask)
    window.addEventListener('online', ask)
    document.addEventListener('visibilitychange', ask)
    const timer = window.setInterval(ask, ON_SITE_REFRESH_EVERY_MS)
    return () => {
      window.removeEventListener('focus', ask)
      window.removeEventListener('online', ask)
      document.removeEventListener('visibilitychange', ask)
      window.clearInterval(timer)
    }
  }, [key])
}

/** Loads the job once per id (and again after a failure when `retry` is pressed), reads how the load stands, and keeps it fresh. */
export function useOnSiteJob(jobId: string | null): LoadState & { retry: () => void } {
  useOnSiteStoreVersion()
  useEffect(() => {
    if (jobId) void loadJob(jobId)
  }, [jobId])
  useReadsAgain(jobId ? `job:${jobId}` : null, () => { if (jobId) refreshJob(jobId) })
  const state: LoadState = jobId ? jobLoadState(jobId) : { loaded: false, loading: false, error: null, raw: null }
  return { ...state, retry: () => { if (jobId) void loadJob(jobId, { force: true }) } }
}

/** Loads every job with a live container, for the desk, the tools menu's count and the header's box search. */
export function useOnSiteDesk(enabled = true): LoadState & { retry: () => void } {
  useOnSiteStoreVersion()
  useEffect(() => {
    if (enabled) void loadDesk()
  }, [enabled])
  useReadsAgain(enabled ? 'desk' : null, () => refreshDesk())
  return { ...deskLoadState(), retry: () => void loadDesk({ force: true }) }
}
