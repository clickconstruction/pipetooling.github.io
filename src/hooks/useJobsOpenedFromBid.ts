/**
 * The jobs opened from one bid (`jobs_ledger.bid_id = bid`), newest first — the read side of the
 * bid ↔ job link for the Edit Bid Job block and the per-GC Won pills (Tier-1 #8). Fail-soft: a role
 * whose RLS cannot read `jobs_ledger` simply sees no link. Refetches when the job form announces a
 * new job from this bid (`JOB_CREATED_FROM_BID_EVENT`).
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BidBoardJobLink } from '../lib/bids/bidBoardJobLinks'
import { JOB_CREATED_FROM_BID_EVENT, type JobCreatedFromBidDetail } from '../lib/bids/wonMomentActions'

export type JobOpenedFromBid = BidBoardJobLink & { jobName: string | null; createdAt: string | null }

export function useJobsOpenedFromBid(bidId: string | null | undefined): { jobs: JobOpenedFromBid[]; loaded: boolean } {
  const [jobs, setJobs] = useState<JobOpenedFromBid[]>([])
  const [loaded, setLoaded] = useState(false)
  const [gen, setGen] = useState(0)

  useEffect(() => {
    const onCreated = (e: Event) => {
      const detail = (e as CustomEvent<JobCreatedFromBidDetail>).detail
      if (!bidId || !detail || detail.bidId === bidId) setGen((n) => n + 1)
    }
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, onCreated)
    return () => window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, onCreated)
  }, [bidId])

  useEffect(() => {
    if (!bidId) {
      setJobs([])
      setLoaded(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, created_at')
          .eq('bid_id', bidId)
          .order('created_at', { ascending: false })
        if (cancelled) return
        const rows = (data ?? []) as Array<{ id: string; hcp_number: string | null; job_name: string | null; created_at: string | null }>
        setJobs(rows.map((r) => ({ jobId: r.id, hcpNumber: r.hcp_number ?? '', jobName: r.job_name ?? null, createdAt: r.created_at ?? null })))
      } catch {
        if (!cancelled) setJobs([])
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, gen])

  return { jobs, loaded }
}
