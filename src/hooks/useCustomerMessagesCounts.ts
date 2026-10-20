import { useCallback, useEffect, useState } from 'react'

import type { CustomerMessagesCounts } from '../lib/followUp/customerCounts'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * Residential build, R8 · 14: the Customers line's counts for the Dashboard's Needs you, beside `useGcFollowUpNeeds`
 * and built the same way. The Follow up kernels and reads load on demand, only when the line is on, so the Dashboard's
 * own chunk does not grow. Null while off, loading, or when no customer waits on us. Refetches on window focus like the
 * neighbouring nudges.
 */
export function useCustomerMessagesCounts(enabled: boolean): CustomerMessagesCounts | null {
  const [counts, setCounts] = useState<CustomerMessagesCounts | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setCounts(null)
      return
    }
    try {
      const { loadCustomerMessagesCounts } = await import('../lib/followUp/customerCountsIo')
      setCounts(await loadCustomerMessagesCounts(todayYmdInAppTz()))
    } catch {
      setCounts(null)
    }
  }, [enabled])
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
