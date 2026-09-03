/**
 * Single-job contract coverage (Contract Desk PR 3): the Job window's fact
 * row and the View bill strip read one job through the same kernel the
 * Pipeline batches. Fail-soft; refreshes on the `job-contract-changed` event.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildJobContractCoverage, type JobContractCoverage, type JobContractRowLike, type SignedEstimateLike } from '../lib/jobs/jobContractCoverage'
import type { JobContractRow } from '../lib/jobs/jobContractLifecycle'

export function useJobContractCoverage(job: { id: string; bid_id: string | null } | null): {
  coverage: JobContractCoverage | null
  rows: JobContractRow[]
  reload: () => Promise<void>
} {
  const [coverage, setCoverage] = useState<JobContractCoverage | null>(null)
  const [rows, setRows] = useState<JobContractRow[]>([])
  const jobId = job?.id ?? null
  const bidId = job?.bid_id ?? null

  const reload = useCallback(async () => {
    if (!jobId) {
      setCoverage(null)
      setRows([])
      return
    }
    try {
      const [contractsRes, estimatesRes] = await Promise.all([
        supabase.from('job_contracts').select('*').eq('job_id', jobId).order('created_at', { ascending: false }),
        bidId
          ? supabase
              .from('estimates')
              .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
              .eq('status', 'customer_accepted')
              .or(`job_ledger_id.eq.${jobId},bid_id.eq.${bidId}`)
          : supabase
              .from('estimates')
              .select('id, job_ledger_id, bid_id, doc_kind, status, acceptor_consented_at, acceptor_printed_name, estimate_number, total_cents')
              .eq('status', 'customer_accepted')
              .eq('job_ledger_id', jobId),
      ])
      const list = (contractsRes.data ?? []) as JobContractRow[]
      setRows(list)
      const cov = buildJobContractCoverage(
        [{ id: jobId, bid_id: bidId }],
        list as unknown as JobContractRowLike[],
        (estimatesRes.data ?? []) as SignedEstimateLike[],
      )
      setCoverage(cov.get(jobId) ?? { kind: 'none' })
    } catch {
      setCoverage(null)
    }
  }, [jobId, bidId])

  useEffect(() => {
    void reload()
  }, [reload])
  useEffect(() => {
    const onChanged = () => void reload()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [reload])

  return { coverage, rows, reload }
}
