import { useEffect, useState } from 'react'
import { denverCalendarDayKey } from '../utils/dateUtils'
import { loadOverheadPoolSnapshot, loadOverheadPoolSnapshotInputs } from '../lib/overheadPoolSnapshot'
import { dashboardOverheadCacheIsFresh, dashboardOverheadCacheKey } from '../lib/dashboardOverheadCard'
import type { OverheadLensDetail } from '../components/people/OverheadLensModal'

/** The JSON-safe slice of the 90-day snapshot the Dashboard card and its lens modal need. */
export type DashboardOverheadPayload = {
  windowStart: string
  windowEnd: string
  avg90DailyUsd: number
  rates: { methodA: number | null; methodB: number | null; methodC: number | null }
  poolTotals: { officeLaborUsd: number; bidLaborUsd: number; officePartsUsd: number; totalUsd: number }
  trend: { direction: 'up' | 'down' | 'flat'; deltaPct: number | null; compareDays: number }
  lensDetail: OverheadLensDetail
}

type CacheEntry = { cachedAtMs: number; windowEnd: string; payload: DashboardOverheadPayload }

/**
 * Dashboard Overhead card data (v2.2676): the SAME 90-day scan People →
 * Overhead runs (`loadOverheadPoolSnapshot`), behind a one-hour per-user,
 * per-company-day sessionStorage cache so a glance card never costs a
 * company-wide scan on every Dashboard visit. `enabled` is the caller's
 * gate (role + pay access + in-view); fails soft to null.
 */
export function useDashboardOverheadSnapshot(enabled: boolean, userId: string | null | undefined): {
  payload: DashboardOverheadPayload | null
  loading: boolean
  failed: boolean
} {
  const [payload, setPayload] = useState<DashboardOverheadPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    const todayYmd = denverCalendarDayKey(Date.now())
    const key = dashboardOverheadCacheKey(userId, todayYmd)
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) {
        const entry = JSON.parse(raw) as CacheEntry
        if (dashboardOverheadCacheIsFresh(entry, Date.now(), todayYmd)) {
          setPayload(entry.payload)
          return
        }
      }
    } catch {
      /* storage unavailable or corrupt — fall through to a live load */
    }
    setLoading(true)
    setFailed(false)
    void (async () => {
      try {
        const inputs = await loadOverheadPoolSnapshotInputs()
        const snap = await loadOverheadPoolSnapshot(inputs, { isCancelled: () => cancelled })
        if (cancelled || !snap) return
        const next: DashboardOverheadPayload = {
          windowStart: snap.windowStart,
          windowEnd: snap.windowEnd,
          avg90DailyUsd: snap.avg.avg90,
          rates: snap.rates,
          poolTotals: snap.poolTrend.totals,
          trend: { direction: snap.poolTrend.direction, deltaPct: snap.poolTrend.deltaPct, compareDays: snap.poolTrend.compareDays },
          lensDetail: snap.lensDetail,
        }
        setPayload(next)
        try {
          const entry: CacheEntry = { cachedAtMs: Date.now(), windowEnd: snap.windowEnd, payload: next }
          sessionStorage.setItem(key, JSON.stringify(entry))
        } catch {
          /* per-session nicety only */
        }
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, userId])

  return { payload, loading, failed }
}
