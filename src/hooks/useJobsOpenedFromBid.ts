/**
 * The jobs opened from one bid (`jobs_ledger.bid_id = bid`), newest first — the read side of the
 * bid ↔ job link for the Edit Bid Job block and the per-GC Won pills (Tier-1 #8). Since v2.5659 it
 * reads `loadJobsOpenedFromBids`, so an estimator, who reads no job row, sees the job their bid opened
 * instead of an offer to open a second one. Fail-soft: nothing read, no link. Refetches when the job
 * form announces a new job from this bid (`JOB_CREATED_FROM_BID_EVENT`). `loaded` is false until this bid's
 * own read answers, and a caller draws no door that starts a job before it does.
 */
import { useEffect, useState } from 'react'
import { loadJobsOpenedFromBids, type JobOpenedFromBid } from '../lib/bids/bidJobsOpenedIo'
import { JOB_CREATED_FROM_BID_EVENT, type JobCreatedFromBidDetail } from '../lib/bids/wonMomentActions'

export type { JobOpenedFromBid }

const EMPTY: JobOpenedFromBid[] = []

export function useJobsOpenedFromBid(bidId: string | null | undefined): { jobs: JobOpenedFromBid[]; loaded: boolean } {
  // The answer keeps the bid it was read for: when the caller moves to another bid, the old bid's answer is not this one's.
  const [answer, setAnswer] = useState<{ bidId: string; jobs: JobOpenedFromBid[] } | null>(null)
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
      setAnswer(null)
      return
    }
    let cancelled = false
    void (async () => {
      let rows: JobOpenedFromBid[] = []
      try {
        rows = await loadJobsOpenedFromBids([bidId])
      } catch {
        rows = []
      }
      // A read that fails still answers, with no job: the doors come back as they did before the lookup was awaited.
      if (!cancelled) setAnswer({ bidId, jobs: rows })
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, gen])

  const mine = answer != null && answer.bidId === bidId ? answer : null
  return { jobs: mine?.jobs ?? EMPTY, loaded: mine != null }
}
