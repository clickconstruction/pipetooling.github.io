import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import type { JobHours } from '../lib/bridge/jobHours'
import { buildPctFacts, streetAndCity, type PctFactsRead, type PctJobFacts } from '../lib/bridge/pctFacts'

/**
 * The facts a percent is judged from, for the jobs on the Bridge's list *Set a percent on the jobs without one*
 * (v2.7221; `pctFacts.ts`). One batched read for the jobs listed, made only while the list or its percent window is on
 * screen, and again after the page refreshes. A read that fails leaves the lines as they were and hands back its reason.
 */
export function useBridgePctFacts(input: {
  /** The listed jobs, with the total the page already holds for each. */
  jobs: ReadonlyArray<{ id: string; revenueUsd: number | null }>
  /** The hours the page has already read for them (`jobHours.ts`). */
  hours: ReadonlyMap<string, JobHours> | null
  todayYmd: string | null
  /** Jobs whose address alone is wanted: the ones on *Price the jobs with no price* (v2.7243). */
  addressJobIds?: ReadonlyArray<string>
  /** False while neither list is on screen: nothing is read. */
  enabled: boolean
  refreshKey: number
}): { facts: ReadonlyMap<string, PctJobFacts> | null; /** Street and city by job, for every job read that has an address. */ addresses: ReadonlyMap<string, string>; error: string | null } {
  const { jobs, hours, todayYmd, enabled, refreshKey, addressJobIds } = input
  const jobsKey = useMemo(() => jobs.map((j) => j.id).sort().join(','), [jobs])
  const addressKey = useMemo(() => [...(addressJobIds ?? [])].sort().join(','), [addressJobIds])
  const key = `${jobsKey}|${addressKey}`
  const [read, setRead] = useState<{ key: string; rows: PctFactsRead } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled || key === '|') return
    let cancelled = false
    setError(null)
    void (async () => {
      try {
        const { loadPctFacts } = await import('../lib/bridge/pctFactsIo')
        const list = (k: string): string[] => (k ? k.split(',') : [])
        const rows = await loadPctFacts(supabase, list(jobsKey), calendarYmdInAppTzFromIso, list(addressKey))
        if (!cancelled) setRead({ key, rows })
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e, 'The read did not finish'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, key, jobsKey, addressKey, refreshKey])
  const facts = useMemo(() => (read && read.key === key && todayYmd ? buildPctFacts({ jobs, hours, read: read.rows, todayYmd }) : null), [read, key, jobs, hours, todayYmd])
  const addresses = useMemo(() => {
    const out = new Map<string, string>()
    if (read && read.key === key) for (const a of read.rows.addresses) if (streetAndCity(a.address)) out.set(a.jobId, streetAndCity(a.address))
    return out
  }, [read, key])
  return { facts, addresses, error }
}
