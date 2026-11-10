import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { containerLines } from '../lib/materials/onSite'
import type { OnSiteFindJob } from '../lib/materials/onSiteFind'
import { jobIdsWithData, listContainers, listMovements, listPlaces } from '../lib/materials/onSiteStore'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useOnSiteDesk } from './useOnSiteStore'

export type OnSiteDeskJobRow = { id: string; hcp_number: string | null; job_name: string | null; job_address?: string | null; google_drive_link?: string | null }

/** How a job reads in a row: its number and name, or the start of its id when the viewer cannot read the job itself. */
export function onSiteJobLabel(row: Pick<OnSiteDeskJobRow, 'hcp_number' | 'job_name'> | undefined, id: string): string {
  return [row?.hcp_number, row?.job_name].filter(Boolean).join(' · ') || `job ${id.slice(0, 8)}`
}

/**
 * Every job with a live box, as one list (punch list #304): the on-site store's desk load, with each
 * job's name. Feeds the search across jobs, Print labels' *Which job?* and an empty job's pointer to
 * the others. `known` is a list the caller already holds (the Tally's jobs), so a field role that
 * cannot read `jobs_ledger` still sees its jobs by name.
 */
export function useOnSiteDeskJobs(enabled: boolean, known: ReadonlyArray<OnSiteDeskJobRow> = []): { jobs: OnSiteFindJob[]; rows: OnSiteDeskJobRow[]; loading: boolean; loaded: boolean; error: string | null; raw: unknown; retry: () => void } {
  const desk = useOnSiteDesk(enabled)
  const [fetched, setFetched] = useState<OnSiteDeskJobRow[]>([])
  const askedRef = useRef(new Set<string>())
  const ids = enabled && desk.loaded ? jobIdsWithData() : []
  const idsKey = ids.join('|')
  const knownKey = known.map((k) => k.id).join('|')

  useEffect(() => {
    const missing = idsKey.split('|').filter((id) => id && !known.some((k) => k.id === id) && !askedRef.current.has(id))
    if (missing.length === 0) return
    missing.forEach((id) => askedRef.current.add(id))
    let live = true
    void withSupabaseRetry(
      () => supabase.from('jobs_ledger').select('id, hcp_number, job_name, job_address, google_drive_link').in('id', missing),
      'load on-site job names',
    )
      .then((data) => {
        if (live && data && data.length) setFetched((prev) => [...prev, ...(data as OnSiteDeskJobRow[]).filter((d) => !prev.some((p) => p.id === d.id))])
      })
      .catch(() => {
        // A job the viewer cannot read keeps the start of its id as its name.
      })
    return () => {
      live = false
    }
    // `known` is read through its key, so a new array of the same jobs asks nothing again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, knownKey])

  const rows = useMemo(() => [...known, ...fetched.filter((f) => !known.some((k) => k.id === f.id))], [known, fetched])
  // The store's version (through `useOnSiteDesk`) re-renders this hook on every press, so the lists stay live.
  const jobs: OnSiteFindJob[] = ids.map((id) => ({
    jobId: id,
    label: onSiteJobLabel(rows.find((r) => r.id === id), id),
    containers: listContainers(id),
    lines: containerLines(listMovements(id)),
    places: listPlaces(id),
  }))
  return { jobs, rows, loading: desk.loading, loaded: desk.loaded, error: desk.error, raw: desk.raw, retry: desk.retry }
}
