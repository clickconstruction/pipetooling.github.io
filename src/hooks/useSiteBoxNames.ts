import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SiteBox } from '../lib/materials/boxName'
import { withSupabaseRetry } from '../utils/errorHandling'

export type SiteBoxRow = SiteBox & { jobId: string }

export type SiteBoxNames = {
  /** Every box of the job's site the viewer may read, live and retired, with the job each sits under. Empty until read. */
  rows: SiteBoxRow[]
  /** The site's development id, or null for a job on no site or one not read yet. */
  siteId: string | null
  loaded: boolean
}

/**
 * The boxes of a job's whole site, for the name rule (punch list #351): a name is offered and checked against every
 * job of the development, or the one job when the job is on no development. Three small reads under the viewer's own
 * RLS: the job's development, the development's jobs, their containers. A read that fails, or a job the viewer cannot
 * read beside, leaves the job's own boxes as the check, which the store already holds; the screens fold the two with
 * `siteBoxesFor`. Read once per job, and again on `siteId`'s change.
 */
export function useSiteBoxNames(jobId: string | null): SiteBoxNames {
  const [state, setState] = useState<{ forJob: string | null; rows: SiteBoxRow[]; siteId: string | null; loaded: boolean }>({ forJob: null, rows: [], siteId: null, loaded: false })

  useEffect(() => {
    if (!jobId) return
    let live = true
    void (async () => {
      let rows: SiteBoxRow[] = []
      let siteId: string | null = null
      try {
        const job = (await withSupabaseRetry(() => supabase.from('jobs_ledger').select('development_id').eq('id', jobId).maybeSingle(), 'load the box’s site')) as { development_id: string | null } | null
        siteId = job?.development_id ?? null
        let jobIds = [jobId]
        if (siteId) {
          const siblings = ((await withSupabaseRetry(() => supabase.from('jobs_ledger').select('id').eq('development_id', siteId as string), 'load the site’s jobs')) ?? []) as Array<{ id: string }>
          jobIds = [...new Set([jobId, ...siblings.map((s) => s.id)])]
        }
        const boxes = ((await withSupabaseRetry(() => supabase.from('job_containers').select('id, job_id, label, kind, retired_at, created_at').in('job_id', jobIds).range(0, 1999), 'load the site’s box names')) ?? []) as Array<{ id: string; job_id: string; label: string; kind: string; retired_at: string | null; created_at: string }>
        rows = boxes.map((b) => ({ id: b.id, jobId: b.job_id, label: b.label, kind: b.kind, retiredAt: b.retired_at, createdAt: b.created_at }))
      } catch {
        // The job's own boxes stand as the check; the next open asks again.
      }
      if (live) setState({ forJob: jobId, rows, siteId, loaded: true })
    })()
    return () => {
      live = false
    }
  }, [jobId])

  return useMemo(() => (state.forJob === jobId ? { rows: state.rows, siteId: state.siteId, loaded: state.loaded } : { rows: [], siteId: null, loaded: false }), [state, jobId])
}
