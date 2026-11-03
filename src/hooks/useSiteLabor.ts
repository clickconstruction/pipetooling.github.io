import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchSiteLabor } from '../lib/developments/fetchSiteLabor'
import type { SiteLaborRead } from '../lib/developments/siteLabor'

/**
 * The clock's hours, days and labor dollars on a site's jobs, for the Development page's
 * scoreboard (v2.6407): one batched read for every job on the page (`fetchSiteLabor.ts`).
 * `enabled` false (a role with no money, or no jobs) reads nothing and gives `undefined`; while
 * reading, the read says so; a read that fails says so too, never a false zero.
 */
export function useSiteLabor(jobIds: ReadonlyArray<string>, enabled: boolean): SiteLaborRead | undefined {
  const key = useMemo(() => (enabled && jobIds.length ? [...jobIds].sort().join(',') : ''), [jobIds, enabled])
  const [state, setState] = useState<{ key: string; read: SiteLaborRead } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void (async () => {
      try {
        const labor = await fetchSiteLabor(supabase, key.split(','))
        if (!cancelled) setState({ key, read: { state: 'read', labor } })
      } catch {
        if (!cancelled) setState({ key, read: { state: 'failed' } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key) return undefined
  return state && state.key === key ? state.read : { state: 'reading' }
}
