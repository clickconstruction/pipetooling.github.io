import { useCallback, useEffect, useState } from 'react'
import { OVERHEAD_ALLOCATION_LEGACY, type OverheadAllocationSettings } from '../lib/jobs/overheadAllocation'
import { fetchOverheadAllocationSettingFromAppSettings, upsertOverheadAllocationSetting } from '../lib/jobs/overheadAllocationSettings'

/**
 * The app-wide overhead allocation (v2.3259), fetched once per page load and
 * shared by every hook that charges overhead (Job Summary's view, the Burn
 * projection). `save` writes the org default (devs only — RLS enforces it) and
 * updates every subscriber in place.
 */
type Cache = { settings: OverheadAllocationSettings; loaded: boolean; promise: Promise<OverheadAllocationSettings> | null }
const cache: Cache = { settings: { ...OVERHEAD_ALLOCATION_LEGACY }, loaded: false, promise: null }
const listeners = new Set<(s: OverheadAllocationSettings, loaded: boolean) => void>()
const notify = () => {
  for (const l of listeners) l(cache.settings, cache.loaded)
}

function load(): Promise<OverheadAllocationSettings> {
  if (cache.loaded) return Promise.resolve(cache.settings)
  if (cache.promise) return cache.promise
  cache.promise = fetchOverheadAllocationSettingFromAppSettings()
    .then((s) => {
      cache.settings = s
      cache.loaded = true
      notify()
      return s
    })
    .catch(() => {
      // Fail soft to legacy for this page load; the next mount retries.
      cache.promise = null
      return cache.settings
    })
  return cache.promise
}

/** Test seam: forget the cached value. */
export function resetOverheadAllocationSettingsCache(): void {
  cache.settings = { ...OVERHEAD_ALLOCATION_LEGACY }
  cache.loaded = false
  cache.promise = null
}

export function useOverheadAllocationSettings(enabled = true): {
  appDefault: OverheadAllocationSettings
  /** False until the row has been read once this page load (legacy is assumed meanwhile). */
  loaded: boolean
  saving: boolean
  saveAppDefault: (s: OverheadAllocationSettings) => Promise<void>
} {
  const [state, setState] = useState<{ settings: OverheadAllocationSettings; loaded: boolean }>({ settings: cache.settings, loaded: cache.loaded })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const l = (settings: OverheadAllocationSettings, loaded: boolean) => setState({ settings, loaded })
    listeners.add(l)
    if (enabled) void load()
    return () => {
      listeners.delete(l)
    }
  }, [enabled])
  const saveAppDefault = useCallback(async (s: OverheadAllocationSettings) => {
    setSaving(true)
    try {
      const saved = await upsertOverheadAllocationSetting(s)
      cache.settings = saved
      cache.loaded = true
      notify()
    } finally {
      setSaving(false)
    }
  }, [])
  return { appDefault: state.settings, loaded: state.loaded, saving, saveAppDefault }
}
