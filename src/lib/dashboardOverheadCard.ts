/**
 * Dashboard Overhead card kernel (v2.2676): the glance strings and the
 * per-session cache rule. The card itself is a thin view over the shared
 * 90-day snapshot; this file keeps the parts worth unit-testing pure.
 */

export type DashboardOverheadCardModel = {
  /** "$437/day" — the 90-day calendar-day burn. */
  headline: string
  /** "A $14.39/hr · B 11.8% · C $0.50/$1" */
  lensesLine: string
  /** Trend pill text + tone, or null when there is no prior span to compare. */
  trend: { text: string; tone: 'up' | 'down' | 'flat' } | null
  /** Composition bar segments (share of the pool), fixed order office → bid → parts. */
  segments: Array<{ key: 'office' | 'bid' | 'parts'; pct: number }>
  /** "$39.4k pool · 52% office labor · 12% bid · 36% parts" */
  compositionLine: string
}

const money2 = (v: number) => `$${v.toFixed(2)}`
const shortK = (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`)

export function buildDashboardOverheadCardModel(input: {
  avg90DailyUsd: number
  rates: { methodA: number | null; methodB: number | null; methodC: number | null }
  poolTotals: { officeLaborUsd: number; bidLaborUsd: number; officePartsUsd: number; totalUsd: number }
  trend: { direction: 'up' | 'down' | 'flat'; deltaPct: number | null; compareDays: number }
}): DashboardOverheadCardModel {
  const { avg90DailyUsd, rates, poolTotals, trend } = input
  const a = rates.methodA == null ? '—' : `${money2(rates.methodA)}/hr`
  const b = rates.methodB == null ? '—' : `${(rates.methodB * 100).toFixed(1)}%`
  const c = rates.methodC == null ? '—' : `${money2(rates.methodC)}/$1`
  const pct = (v: number) => (poolTotals.totalUsd > 0 ? Math.round((v / poolTotals.totalUsd) * 100) : 0)
  const allSegments: DashboardOverheadCardModel['segments'] = [
    { key: 'office', pct: pct(poolTotals.officeLaborUsd) },
    { key: 'bid', pct: pct(poolTotals.bidLaborUsd) },
    { key: 'parts', pct: pct(poolTotals.officePartsUsd) },
  ]
  const segments = allSegments.filter((s) => s.pct > 0)
  const delta = trend.deltaPct == null ? null : Math.round(Math.abs(trend.deltaPct) * 100)
  const trendModel: DashboardOverheadCardModel['trend'] =
    trend.deltaPct == null
      ? null
      : trend.direction === 'up'
        ? { text: `↑ ${delta}% vs prior ${trend.compareDays}d`, tone: 'up' }
        : trend.direction === 'down'
          ? { text: `↓ ${delta}% vs prior ${trend.compareDays}d`, tone: 'down' }
          : { text: `→ flat vs prior ${trend.compareDays}d`, tone: 'flat' }
  return {
    headline: `$${Math.round(avg90DailyUsd).toLocaleString('en-US')}/day`,
    lensesLine: `A ${a} · B ${b} · C ${c}`,
    trend: trendModel,
    segments,
    compositionLine: `${shortK(poolTotals.totalUsd)} pool · ${pct(poolTotals.officeLaborUsd)}% office labor · ${pct(poolTotals.bidLaborUsd)}% bid · ${pct(poolTotals.officePartsUsd)}% parts`,
  }
}

/** sessionStorage key for the cached snapshot — per user and per company calendar day. */
export function dashboardOverheadCacheKey(userId: string, todayYmd: string): string {
  return `pipetooling_dashboard_overhead_${userId}_${todayYmd}`
}

export const DASHBOARD_OVERHEAD_CACHE_TTL_MS = 60 * 60 * 1000

/** A cached entry is usable when it is under the TTL and was cut on the same company day. */
export function dashboardOverheadCacheIsFresh(entry: { cachedAtMs: number; windowEnd: string }, nowMs: number, todayYmd: string): boolean {
  return entry.windowEnd === todayYmd && nowMs - entry.cachedAtMs >= 0 && nowMs - entry.cachedAtMs < DASHBOARD_OVERHEAD_CACHE_TTL_MS
}
