import { useCallback, useEffect, useState } from 'react'

import type { CustomerMessagesCounts } from '../lib/followUp/customerCounts'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * Residential build, R8 · 14: the Customers line's counts for the Dashboard's Needs you, beside `useGcFollowUpNeeds`
 * and built the same way. The Follow up kernels and reads load on demand, only when the line is on, so the Dashboard's
 * own chunk does not grow. Null while off, loading, or when no customer waits on us. Refetches on window focus like the
 * neighbouring nudges. `textsElsewhere` is Quickfill's (v2.5823): its Texts station holds the texts, so the line there
 * leaves out a customer whose waiting line is a text.
 */
export function useCustomerMessagesCounts(enabled: boolean, textsElsewhere: boolean = false): CustomerMessagesCounts | null {
  const [counts, setCounts] = useState<CustomerMessagesCounts | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setCounts(null)
      return
    }
    try {
      const { loadCustomerMessagesCounts } = await import('../lib/followUp/customerCountsIo')
      setCounts(await loadCustomerMessagesCounts(todayYmdInAppTz(), undefined, undefined, { textsElsewhere }))
    } catch {
      setCounts(null)
    }
  }, [enabled, textsElsewhere])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return counts
}
