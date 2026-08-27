import { describe, expect, it } from 'vitest'
import { buildPackageMap, computeSharedBidCost, type PackageMapPricingLike } from './bidPackageMap'
import type { GcVersionLike } from './gcPackets'
import type { CostEstimateLaborRow } from './bidPricingEngineTypes'

const labor = (hours: number): CostEstimateLaborRow =>
  ({ rough_in_hrs_per_unit: hours, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0, count: 1, is_fixed: false, fixture: 'X' }) as unknown as CostEstimateLaborRow

describe('computeSharedBidCost', () => {
  const base = {
    laborRows: [labor(10)],
    materialTotalRoughIn: 1000,
    materialTotalTopOut: 500,
    materialTotalTrimSet: null,
    laborRate: 50,
    distanceFromOffice: '10',
    countRowsLen: 4,
    equipmentRows: [],
    permitRows: [],
    subcontractorRows: [],
    wasteRows: [],
    otherRows: [],
    teamLaborCost: 200,
  }

  it('is null with no cost estimate — margins stay unknown, never fake-100%', () => {
    expect(computeSharedBidCost({ ...base, costEstimate: null })).toBeNull()
  })

  it('sums materials + labor + driving + estimator + team labor + travel', () => {
    // Defaults: hoursPerTrip 2, drivingRate 0.70, estimator $10/count, no travel config.
    const cost = computeSharedBidCost({ ...base, costEstimate: {} })!
    // materials 1500 + labor 500 + driving (10/2)*0.7*10=35 + estimator 40 + team 200
    expect(cost).toBeGreaterThan(1500 + 500 + 200)
    expect(cost).toBeCloseTo(1500 + 500 + 35 + 40 + 200, 0)
  })
})

const pricings: PackageMapPricingLike[] = [
  { id: 'p-sub', name: 'Submittal', bid_version_id: null, include_in_submission: false, sort_order: 0 },
  { id: 'p-ve', name: 'Value Engineered', bid_version_id: 'v-plan', include_in_submission: true, sort_order: 1 },
  { id: 'p-idea', name: 'What-if', bid_version_id: null, include_in_submission: false, sort_order: 2 },
]

const versions: GcVersionLike[] = [
  { id: 'v-plans', name: 'To Plans', customer_id: null, sort_order: 0, starred_price_book_version_id: 'p-sub' },
  { id: 'v-plan', name: 'Value Engineered', customer_id: 'gc-planhub', sort_order: 1, starred_price_book_version_id: 'p-ve' },
]

const revenue: Record<string, number> = { 'p-sub': 50000, 'p-ve': 66931, 'p-idea': 0 }

const baseArgs = {
  versions,
  pricings,
  bidGcName: 'Loberg Contracting',
  gcNames: { 'gc-planhub': 'PlanHub' },
  latestSends: {},
  bidDateSent: '2026-07-31',
  revenueOf: (id: string) => revenue[id] ?? null,
  sharedCost: 10000,
  selectedVersionId: 'v-plan',
  selectedPricingId: 'p-ve',
  bidStarredPricingId: null,
}

describe('buildPackageMap', () => {
  it('groups versions into GC packets with their ★ first and statuses right', () => {
    const map = buildPackageMap(baseArgs)
    expect(map.gcCount).toBe(2)
    expect(map.versionCount).toBe(2)
    expect(map.priceCount).toBe(3)

    const loberg = map.packets.find((p) => p.name === 'Loberg Contracting')!
    const plans = loberg.versions[0]!
    expect(plans.prices[0]).toMatchObject({ id: 'p-sub', status: 'base', revenue: 50000 })
    expect(plans.prices[0]!.margin).toBeCloseTo(0.8, 5)

    const planhub = map.packets.find((p) => p.name === 'PlanHub')!
    expect(planhub.versions[0]!.viewing).toBe(true)
    expect(planhub.versions[0]!.prices[0]).toMatchObject({ id: 'p-ve', status: 'base', viewing: true })
  })

  it('a version-stamped, offered price on another version reads alternate, and the star is never duplicated', () => {
    const map = buildPackageMap({ ...baseArgs, versions: [{ ...versions[0]!, starred_price_book_version_id: 'p-ve' }, versions[1]!] })
    const plans = map.packets[0]!.versions[0]!
    // p-ve is this version's star (base) AND stamped on v-plan — appears once here as base.
    expect(plans.prices.filter((p) => p.id === 'p-ve')).toHaveLength(1)
    expect(plans.prices.find((p) => p.id === 'p-ve')!.status).toBe('base')
    // on its own version it is the star too
    const planhub = map.packets[1]!.versions[0]!
    expect(planhub.prices.find((p) => p.id === 'p-ve')!.status).toBe('base')
  })

  it('unclaimed pricings land in unattached instead of vanishing', () => {
    const map = buildPackageMap(baseArgs)
    expect(map.unattached.map((p) => p.id)).toEqual(['p-idea'])
    expect(map.unattached[0]!.unpriced).toBe(true)
  })

  it('unknown cost → margins null, never fabricated', () => {
    const map = buildPackageMap({ ...baseArgs, sharedCost: null })
    const all = map.packets.flatMap((p) => p.versions.flatMap((v) => v.prices))
    expect(all.every((p) => p.margin === null)).toBe(true)
  })

  it('unsplit bid: one implicit version holding every price, ★ from the bid column', () => {
    const map = buildPackageMap({
      ...baseArgs,
      versions: [],
      pricings: pricings.map((p) => ({ ...p, bid_version_id: null })),
      bidStarredPricingId: 'p-sub',
      recipients: [{ customerId: 'gc-x', name: 'Extra GC' }],
    })
    expect(map.gcCount).toBe(2)
    const main = map.packets[0]!
    expect(main.name).toBe('Loberg Contracting')
    expect(main.versions[0]!.prices).toHaveLength(3)
    expect(main.versions[0]!.prices[0]).toMatchObject({ id: 'p-sub', status: 'base' })
    expect(map.packets[1]).toMatchObject({ name: 'Extra GC', sharedLetter: true })
  })

  it('shared-letter recipients on a split bid come through as packets with no versions', () => {
    const map = buildPackageMap({ ...baseArgs, recipients: [{ customerId: 'gc-y', name: 'CC GC' }] })
    const shared = map.packets.find((p) => p.name === 'CC GC')!
    expect(shared.sharedLetter).toBe(true)
    expect(shared.versions).toHaveLength(0)
  })
})
