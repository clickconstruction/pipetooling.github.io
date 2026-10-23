import { useEffect, useMemo } from 'react'
import { useOptionalJobsListCache } from '../contexts/JobsListCacheContext'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'
import { groupCollectionsByPayer } from '../lib/legal/legalPacket'
import type { LegalMapCase, MapAccount } from '../lib/legal/firmMap'
import type { JobWithDetails } from '../types/jobWithDetails'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useLegalMapCases } from './useLegalMapCases'
import { useLegalMatters } from './useLegalMatters'

const EMPTY_JOBS: JobWithDetails[] = []

/**
 * Today's Collections cases for the Settings picker (punch list #144, PR 1b): the desk's own
 * accounts (the billed jobs in Collections, grouped by payer as the Legal desk groups them, plus
 * the ones given up on) and their matters, placed by `useLegalMapCases` (shared with the desk's
 * Map since v2.5784). Reads nothing until `enabled`, and nothing at all where no jobs cache
 * provider is above (the desk's firm window mounts the block too).
 */
export function useLegalFirmMapCases(enabled: boolean, firmNames: ReadonlyMap<string, string>): { cases: LegalMapCase[]; loading: boolean } {
  const cache = useOptionalJobsListCache()
  const on = enabled && cache !== null
  const jobs = cache?.jobs ?? EMPTY_JOBS
  const jobsListLoading = cache?.jobsListLoading ?? false
  const runFetchJobs = cache?.runFetchJobs
  const legal = useLegalMatters(on)

  // The board's own load, as Accounts Receivable does it (a scope fetch alone waits on a board key Settings never sets).
  useEffect(() => {
    if (!on || !runFetchJobs) return
    void runFetchJobs(null)
  }, [on, runFetchJobs])

  const { accounts, givenUp } = useMemo(() => {
    if (!on) return { accounts: [] as MapAccount[], givenUp: [] as MapAccount[] }
    const lists = buildJobsStagesBoardLists(jobs, '')
    const today = todayYmdInAppTz()
    return {
      accounts: groupCollectionsByPayer(lists.collectionsJobs, new Map(), today) as MapAccount[],
      givenUp: groupCollectionsByPayer(lists.uncollectibleJobs, new Map(), today) as MapAccount[],
    }
  }, [on, jobs])

  const { cases, loading } = useLegalMapCases({ accounts, givenUp, byPayerKey: legal.byPayerKey, firmNames }, on && !jobsListLoading)
  return { cases, loading: on && (jobsListLoading || legal.loading || loading) }
}
