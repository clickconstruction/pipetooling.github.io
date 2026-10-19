import { useEffect, useState } from 'react'
import { loadPaidClaims } from '../lib/jobs/paidClaimsIo'
import { myStaleClaims, type PaidClaim } from '../lib/jobs/paidClaims'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * The Dashboard's Needs you line for a paid claim nothing landed behind (v2.5650, punch list #129): the claims the
 * signed-in person heard, a week or more since the day the customer named, with no payment on the job since. The
 * read is `list_paid_claims` (the office reads every claim, the job's people theirs); who heard it is the filter, so
 * the line is the hearer's, not the office's. A read that fails reads as none.
 */
export function useMyStaleClaims(enabled: boolean, userId: string | null | undefined): { stale: PaidClaim[]; loaded: boolean } {
  const [stale, setStale] = useState<PaidClaim[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!enabled || !userId) {
      setStale([])
      setLoaded(enabled)
      return
    }
    let live = true
    void loadPaidClaims().then((claims) => {
      if (!live) return
      setStale(myStaleClaims(claims, userId, todayYmdInAppTz()))
      setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [enabled, userId])
  return { stale, loaded }
}
