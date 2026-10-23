import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useOptionalJobsListCache } from '../contexts/JobsListCacheContext'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'
import { groupCollectionsByPayer } from '../lib/legal/legalPacket'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { countyAt } from '../lib/legal/countyAt'
import { shapeMapCases, type LegalMapCase, type MapAccount } from '../lib/legal/firmMap'
import { loadTxCounties } from '../lib/legal/txCountyMapIo'
import type { CountyFeatureCollection } from '../lib/legal/txCountyMap'
import type { JobWithDetails } from '../types/jobWithDetails'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useAddressGeocodeCoords, type AddressToGeocode } from './useAddressGeocodeCoords'
import { useLegalMatters } from './useLegalMatters'

const db = supabase as unknown as SupabaseClient
const EMPTY_JOBS: JobWithDetails[] = []

/**
 * Today's Collections cases for the county map (punch list #144, PR 1b): the desk's own
 * accounts (the billed jobs in Collections, grouped by payer as the Legal desk groups
 * them, plus the ones given up on), their matters, the first job's geocode from the shared
 * cache, and the property record's county when it has one. Pure shaping in
 * `legal/firmMap.ts`; this hook only gathers. Reads nothing until `enabled`, and nothing at
 * all where no jobs cache provider is above (the desk's firm window mounts the block too).
 */
export function useLegalFirmMapCases(enabled: boolean, firmNames: ReadonlyMap<string, string>): { cases: LegalMapCase[]; loading: boolean } {
  const cache = useOptionalJobsListCache()
  const on = enabled && cache !== null
  const jobs = cache?.jobs ?? EMPTY_JOBS
  const jobsListLoading = cache?.jobsListLoading ?? false
  const runFetchJobs = cache?.runFetchJobs
  const legal = useLegalMatters(on)
  const [counties, setCounties] = useState<CountyFeatureCollection | null>(null)
  const [recordCounty, setRecordCounty] = useState<Map<string, string | null>>(() => new Map())

  // The board's own load, as Accounts Receivable does it (a scope fetch alone waits on a board key Settings never sets).
  useEffect(() => {
    if (!on || !runFetchJobs) return
    void runFetchJobs(null)
  }, [on, runFetchJobs])

  useEffect(() => {
    if (!on) return
    let live = true
    loadTxCounties().then(
      (fc) => {
        if (live) setCounties(fc)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [on])

  const { accounts, givenUp } = useMemo(() => {
    if (!on) return { accounts: [] as MapAccount[], givenUp: [] as MapAccount[] }
    const lists = buildJobsStagesBoardLists(jobs, '')
    const today = todayYmdInAppTz()
    return {
      accounts: groupCollectionsByPayer(lists.collectionsJobs, new Map(), today) as MapAccount[],
      givenUp: groupCollectionsByPayer(lists.uncollectibleJobs, new Map(), today) as MapAccount[],
    }
  }, [on, jobs])

  const addresses = useMemo<AddressToGeocode[]>(() => {
    const out: AddressToGeocode[] = []
    for (const acc of [...accounts, ...givenUp]) {
      const display = (acc.jobs[0]?.job_address ?? '').trim()
      if (display) out.push({ key: normalizeAddressForGeocodeKey(display), display })
    }
    return out
  }, [accounts, givenUp])
  const { coords, resolving } = useAddressGeocodeCoords(addresses, on && !jobsListLoading, 'legal firm map address_geocodes')

  const recordIds = useMemo(() => {
    const ids = new Set<string>()
    for (const acc of [...accounts, ...givenUp]) {
      const id = acc.jobs[0]?.customer_address_id
      if (id) ids.add(id)
    }
    return [...ids].sort().join('\n')
  }, [accounts, givenUp])
  useEffect(() => {
    if (!on || !recordIds) return
    let live = true
    void (async () => {
      const { data } = await db.from('customer_addresses').select('id, county').in('id', recordIds.split('\n'))
      if (!live) return
      setRecordCounty(new Map(((data ?? []) as Array<{ id: string; county: string | null }>).map((r) => [r.id, r.county])))
    })()
    return () => {
      live = false
    }
  }, [on, recordIds])

  const cases = useMemo(() => {
    if (!on) return []
    const countyOf = (lng: number, lat: number) => (counties ? countyAt(counties, lng, lat) : null)
    return shapeMapCases({ accounts, givenUp, byPayerKey: legal.byPayerKey, firmNames, coords, recordCounty, countyOf })
  }, [on, accounts, givenUp, legal.byPayerKey, firmNames, coords, recordCounty, counties])

  return { cases, loading: on && (jobsListLoading || legal.loading || resolving || !counties) }
}
