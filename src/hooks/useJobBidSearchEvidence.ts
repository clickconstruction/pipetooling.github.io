/**
 * Lazy evidence for unified job/bid search rows — the header-search pattern,
 * shared so every picker's rows can carry the standard rail (status chip,
 * money/lines, paid recency, "N this wk", bid outcome/value/date).
 *
 * Debounced 200 ms after results settle; fetches only ids not already cached
 * (accumulating maps, so revisiting a query is instant); caps at the first 20
 * job + 20 bid rows per pass; failures leave rows rendering plain. Dollars are
 * role-gated at the QUERY level via jobSearchEvidenceModeForRole — pass the
 * returned `evidenceMode` straight to UnifiedSearchResultRow.
 */
import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  fetchBidSearchEvidence,
  fetchJobSearchEvidence,
  jobSearchEvidenceModeForRole,
  type BidSearchEvidence,
  type JobSearchEvidence,
  type JobSearchEvidenceMode,
} from '../lib/jobSearchEvidence'
import type { UnifiedSearchResult } from '../utils/unifiedJobBidSearch'

const EVIDENCE_ROW_CAP = 20
const EVIDENCE_DEBOUNCE_MS = 200

export function useJobBidSearchEvidence(
  results: readonly UnifiedSearchResult[],
  opts?: {
    /** Skip fetching entirely (e.g. while the hosting modal is closed). Default true. */
    enabled?: boolean
  },
): {
  jobEvidence: Map<string, JobSearchEvidence>
  bidEvidence: Map<string, BidSearchEvidence>
  evidenceMode: JobSearchEvidenceMode
} {
  const { role } = useAuth()
  const evidenceMode = jobSearchEvidenceModeForRole(role)
  const enabled = opts?.enabled ?? true
  const [jobEvidence, setJobEvidence] = useState<Map<string, JobSearchEvidence>>(() => new Map())
  const [bidEvidence, setBidEvidence] = useState<Map<string, BidSearchEvidence>>(() => new Map())

  useEffect(() => {
    if (!enabled || results.length === 0) return
    const jobIds = results.filter((r) => r.source === 'job').slice(0, EVIDENCE_ROW_CAP).map((r) => r.id)
    const bidIds = results.filter((r) => r.source === 'bid').slice(0, EVIDENCE_ROW_CAP).map((r) => r.id)
    const missingJobs = jobIds.filter((id) => !jobEvidence.has(id))
    const missingBids = bidIds.filter((id) => !bidEvidence.has(id))
    if (missingJobs.length === 0 && missingBids.length === 0) return
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const [jobs, bids] = await Promise.all([
            missingJobs.length > 0
              ? fetchJobSearchEvidence(missingJobs, evidenceMode)
              : Promise.resolve(new Map<string, JobSearchEvidence>()),
            missingBids.length > 0
              ? fetchBidSearchEvidence(missingBids)
              : Promise.resolve(new Map<string, BidSearchEvidence>()),
          ])
          if (cancelled) return
          if (jobs.size > 0)
            setJobEvidence((prev) => {
              const next = new Map(prev)
              for (const [k, v] of jobs) next.set(k, v)
              return next
            })
          if (bids.size > 0)
            setBidEvidence((prev) => {
              const next = new Map(prev)
              for (const [k, v] of bids) next.set(k, v)
              return next
            })
        } catch {
          // Rows render without the evidence spans.
        }
      })()
    }, EVIDENCE_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [enabled, results, jobEvidence, bidEvidence, evidenceMode])

  return { jobEvidence, bidEvidence, evidenceMode }
}
