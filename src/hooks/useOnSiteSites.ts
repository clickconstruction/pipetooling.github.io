import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type OnSiteSites = {
  /** Each job's site: its development's id, or null for a job on no site. A job not read yet is absent. */
  siteOfJob: ReadonlyMap<string, string | null>
  /** A site's name by its development id. */
  siteNames: ReadonlyMap<string, string>
  loaded: boolean
  /** The read failed (v2.7175): the thrown value for the panel's class, null when it went through. The desk then has one row per job, and says so. */
  failed: unknown
  retry: () => void
}

/**
 * The sites behind the jobs that hold boxes (punch list #330): which development each job belongs
 * to, and the developments' names, so the desk groups a site's jobs under one row and the site's
 * screen knows its jobs. Two small reads over the ids the on-site store already holds, under the
 * viewer's own RLS. A read that fails leaves the desk as it was before sites, one row per job, and is
 * handed back as `failed` so the screen can say so and ask again (v2.7175): a site's screen with no
 * jobs read as an empty site before.
 */
export function useOnSiteSites(jobIds: ReadonlyArray<string>, enabled = true): OnSiteSites {
  const [siteOfJob, setSiteOfJob] = useState<Map<string, string | null>>(new Map())
  const [siteNames, setSiteNames] = useState<Map<string, string>>(new Map())
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState<unknown>(null)
  const [again, setAgain] = useState(0)
  const askedRef = useRef(new Set<string>())
  const idsKey = [...jobIds].sort().join('|')

  useEffect(() => {
    if (!enabled) return
    const missing = idsKey.split('|').filter((id) => id && !askedRef.current.has(id))
    if (missing.length === 0) {
      if (idsKey === '') setLoaded(true)
      return
    }
    missing.forEach((id) => askedRef.current.add(id))
    let live = true
    void (async () => {
      try {
        const jobs = (await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id, development_id').in('id', missing), 'load on-site job sites')) ?? []
        const rows = jobs as Array<{ id: string; development_id: string | null }>
        const siteIds = [...new Set(rows.map((r) => r.development_id).filter((id): id is string => Boolean(id)))]
        const sites = siteIds.length ? ((await withSupabaseRetry(() => supabase.from('developments').select('id, name').in('id', siteIds), 'load on-site site names')) ?? []) : []
        if (!live) return
        setFailed(null)
        setSiteOfJob((prev) => {
          const next = new Map(prev)
          for (const r of rows) next.set(r.id, r.development_id)
          return next
        })
        setSiteNames((prev) => {
          const next = new Map(prev)
          for (const s of sites as Array<{ id: string; name: string }>) next.set(s.id, s.name)
          return next
        })
      } catch (e) {
        // The desk keeps one row per job; Retry, or a later visit, asks again.
        missing.forEach((id) => askedRef.current.delete(id))
        if (live) setFailed(e ?? new Error('The sites did not load.'))
      } finally {
        if (live) setLoaded(true)
      }
    })()
    return () => {
      live = false
    }
  }, [idsKey, enabled, again])

  return useMemo(() => ({ siteOfJob, siteNames, loaded, failed, retry: () => setAgain((n) => n + 1) }), [siteOfJob, siteNames, loaded, failed])
}
