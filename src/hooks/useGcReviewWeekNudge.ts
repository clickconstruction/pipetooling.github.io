import { useEffect, useState } from 'react'
import { gcReviewWeekStartYmd } from '../lib/jobs/gcReviewCertification'
import { fetchGcReviewWeekStatus, type GcReviewWeekStatus } from '../lib/gcReviewCertifications'

/**
 * This week's GC certification status (v2.1984), extracted from
 * DashboardGcReviewWeeklyBanner for the Needs You card (v2.2490). Null while
 * loading, disabled, or on error — the kernel's gcReviewNudgeState decides
 * due/done/hidden from the status.
 */
export function useGcReviewWeekNudge(enabled: boolean): {
  status: GcReviewWeekStatus | null
  /** True once the fetch settled (even on error) — lets callers report 0 instead of loading forever. */
  loaded: boolean
} {
  const [status, setStatus] = useState<GcReviewWeekStatus | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setStatus(null)
      setLoaded(false)
      return
    }
    let cancelled = false
    void fetchGcReviewWeekStatus(gcReviewWeekStartYmd()).then(
      (s) => {
        if (!cancelled) {
          setStatus(s)
          setLoaded(true)
        }
      },
      () => {
        if (!cancelled) {
          setStatus(null)
          setLoaded(true)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { status, loaded }
}
