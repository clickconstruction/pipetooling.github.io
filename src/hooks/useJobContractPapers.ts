/**
 * The signed papers on file for a customer's jobs (v2.4301): what the bill strip needs to say
 * "Covers jobs 251, 825 and 843" and to offer a job with nothing on file the paper its sibling
 * jobs share. Fail-soft (an error reads as "no papers"); refreshes on `job-contract-changed`.
 */
import { useCallback, useEffect, useState } from 'react'
import { jobNumberLabel, type CoversPaper } from '../lib/jobs/jobContractCovers'
import { loadContractRowsForJobs, loadPartyJobs, papersFromRows } from '../lib/jobs/jobContractCoversWrite'

export function useJobContractPapers(partyIds: ReadonlyArray<string | null | undefined>, enabled: boolean): {
  papers: CoversPaper[]
  /** Job id → the number the app shows. */
  numById: Map<string, string>
  reload: () => Promise<void>
} {
  const ids = partyIds.filter((x): x is string => Boolean(x))
  const key = [...new Set(ids)].sort().join(',')
  const [papers, setPapers] = useState<CoversPaper[]>([])
  const [numById, setNumById] = useState<Map<string, string>>(new Map())

  const reload = useCallback(async () => {
    if (!enabled || !key) {
      setPapers([])
      setNumById(new Map())
      return
    }
    try {
      const jobs = await loadPartyJobs(key.split(','))
      const rows = await loadContractRowsForJobs(jobs.map((j) => j.id))
      setNumById(new Map(jobs.map((j) => [j.id, jobNumberLabel(j)])))
      setPapers(papersFromRows(rows))
    } catch {
      setPapers([])
    }
  }, [enabled, key])

  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(() => {
    const onChanged = () => void reload()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [reload])

  return { papers, numById, reload }
}
