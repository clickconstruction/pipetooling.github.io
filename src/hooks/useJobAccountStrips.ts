import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupJobAccountStrip, type JobAccountStripEntry, type JobAccountStripRow } from '../lib/jobs/jobAccountStrip'

const CHUNK = 200

/**
 * The Job accounts strip's read (v2.3424): one `list_job_account_strip` call
 * per chunk of job ids → entries per job (open · requested · none · not
 * needed, with the house's rep). Refetches on window focus (the office marks
 * an account opened while the tech is looking) and on `refreshKey`. An RPC
 * error (a client ahead of the push) reads as "no strip", never an error.
 */
export function useJobAccountStrips(
  jobIds: readonly string[],
  enabled = true,
  refreshKey = 0,
): { byJob: Map<string, JobAccountStripEntry[]>; loaded: boolean; reload: () => void } {
  const idsKey = useMemo(() => [...new Set(jobIds.filter(Boolean))].sort().join(','), [jobIds])
  const [rows, setRows] = useState<JobAccountStripRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled || !idsKey) {
      setRows([])
      setLoaded(enabled)
      return
    }
    const ids = idsKey.split(',')
    let cancelled = false
    void (async () => {
      const all: JobAccountStripRow[] = []
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await supabase.rpc('list_job_account_strip', { p_job_ids: ids.slice(i, i + CHUNK) })
        if (error) {
          if (!cancelled) {
            setRows([])
            setLoaded(true)
          }
          return
        }
        all.push(...((data ?? []) as JobAccountStripRow[]))
      }
      if (cancelled) return
      setRows(all)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, idsKey, refreshKey, tick])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => setTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled])

  const byJob = useMemo(() => groupJobAccountStrip(rows), [rows])
  return { byJob, loaded, reload }
}
