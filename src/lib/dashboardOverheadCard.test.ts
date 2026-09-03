import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_OVERHEAD_CACHE_TTL_MS,
  buildDashboardOverheadCardModel,
  dashboardOverheadCacheIsFresh,
  dashboardOverheadCacheKey,
} from './dashboardOverheadCard'

describe('buildDashboardOverheadCardModel', () => {
  const base = {
    avg90DailyUsd: 437.4,
    rates: { methodA: 14.392, methodB: 0.118, methodC: 0.503 },
    poolTotals: { officeLaborUsd: 20573, bidLaborUsd: 4663, officePartsUsd: 14138, totalUsd: 39374 },
    trend: { direction: 'down' as const, deltaPct: -0.144, compareDays: 30 },
  }

  it('formats the glance lines from the snapshot numbers', () => {
    const m = buildDashboardOverheadCardModel(base)
    expect(m.headline).toBe('$437/day')
    expect(m.lensesLine).toBe('A $14.39/hr · B 11.8% · C $0.50/$1')
    expect(m.trend).toEqual({ text: '↓ 14% vs prior 30d', tone: 'down' })
    expect(m.segments).toEqual([
      { key: 'office', pct: 52 },
      { key: 'bid', pct: 12 },
      { key: 'parts', pct: 36 },
    ])
    expect(m.compositionLine).toBe('$39.4k pool · 52% office labor · 12% bid · 36% parts')
  })

  it('handles missing rates, a flat trend, and no prior span', () => {
    const m = buildDashboardOverheadCardModel({
      ...base,
      rates: { methodA: null, methodB: null, methodC: null },
      trend: { direction: 'flat', deltaPct: 0.02, compareDays: 30 },
    })
    expect(m.lensesLine).toBe('A — · B — · C —')
    expect(m.trend).toEqual({ text: '→ flat vs prior 30d', tone: 'flat' })
    expect(buildDashboardOverheadCardModel({ ...base, trend: { direction: 'flat', deltaPct: null, compareDays: 30 } }).trend).toBeNull()
  })

  it('drops empty composition segments', () => {
    const m = buildDashboardOverheadCardModel({ ...base, poolTotals: { officeLaborUsd: 100, bidLaborUsd: 0, officePartsUsd: 0, totalUsd: 100 } })
    expect(m.segments).toEqual([{ key: 'office', pct: 100 }])
  })
})

describe('cache rule', () => {
  it('keys per user and company day', () => {
    expect(dashboardOverheadCacheKey('u1', '2026-09-03')).toBe('pipetooling_dashboard_overhead_u1_2026-09-03')
  })

  it('is fresh only under the TTL and on the same company day', () => {
    const now = 1_000_000_000
    expect(dashboardOverheadCacheIsFresh({ cachedAtMs: now - 1000, windowEnd: '2026-09-03' }, now, '2026-09-03')).toBe(true)
    expect(dashboardOverheadCacheIsFresh({ cachedAtMs: now - DASHBOARD_OVERHEAD_CACHE_TTL_MS, windowEnd: '2026-09-03' }, now, '2026-09-03')).toBe(false)
    expect(dashboardOverheadCacheIsFresh({ cachedAtMs: now - 1000, windowEnd: '2026-09-02' }, now, '2026-09-03')).toBe(false)
    expect(dashboardOverheadCacheIsFresh({ cachedAtMs: now + 5000, windowEnd: '2026-09-03' }, now, '2026-09-03')).toBe(false)
  })
})
