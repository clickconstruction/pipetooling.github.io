import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { HR_REPORTS_MIN_AGE_DAYS } from '../lib/ageState'
import { summarizePendingReportAging, type PendingReportAgingSummary } from '../lib/people/hrPendingReports'

/**
 * Pending HR field reports for the Needs You card (journey-map Tier-2 #40,
 * J32-F7) — the `usePendingHoursApprovalsNudge` shape: null until the OLDEST
 * pending report is `HR_REPORTS_MIN_AGE_DAYS` old, refetch on window focus, a
 * failed poll shows nothing this round.
 *
 * Callers gate `enabled` to devs: RLS lets authors read their own pending
 * rows too, but People → HR (where reports are filed) is dev-only, so a
 * master would be nagged toward a tab they cannot open.
 */
export function usePendingHrReportsNudge(enabled: boolean): {
  aged: PendingReportAgingSummary | null
  refresh: () => void
} {
  const [refreshKey, setRefreshKey] = useState(0)
  const [aged, setAged] = useState<PendingReportAgingSummary | null>(null)

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setAged(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () => supabase.from('person_reports').select('created_at').eq('status', 'pending'),
          'count pending hr reports',
        )
        if (cancelled) return
        const list = (rows ?? []) as Array<{ created_at: string | null }>
        setAged(summarizePendingReportAging(list, HR_REPORTS_MIN_AGE_DAYS))
      } catch {
        if (!cancelled) setAged(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => bump()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, bump])

  return { aged, refresh: bump }
}
