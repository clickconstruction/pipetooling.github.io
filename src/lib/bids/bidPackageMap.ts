/**
 * Package map (v2.2374): the whole bid at a glance — GC packets → versions →
 * price options, each price with its computed revenue, margin against the
 * bid's shared cost, and who sees it (★ base on the letter / offered
 * alternate / only you). Pure assembly + the shared-cost formula; the modal
 * fetches rows and feeds them in.
 */
import { groupVersionsByGc, type GcVersionLike } from './gcPackets'
import type { LatestSend } from './versionSends'
import {
  computeTravelCost,
  costEstimateDrivingRate,
  costEstimateEstimatorCost,
  costEstimateHoursPerTrip,
  sumEquipmentRows,
} from './bidCostCalc'
import { laborRowHours } from './laborRowHours'
import type { CostEstimateLaborRow } from './bidPricingEngineTypes'

type SegmentRows = Parameters<typeof sumEquipmentRows>[0]

export type SharedBidCostInputs = {
  /** cost_estimates row; null = no estimate yet → cost (and margins) unknown. */
  costEstimate: unknown | null
  laborRows: ReadonlyArray<CostEstimateLaborRow>
  materialTotalRoughIn: number | null
  materialTotalTopOut: number | null
  materialTotalTrimSet: number | null
  laborRate: number | null
  /** bids.distance_from_office (string in the schema). */
  distanceFromOffice: string | null | undefined
  countRowsLen: number
  equipmentRows: SegmentRows
  permitRows: SegmentRows
  subcontractorRows: SegmentRows
  wasteRows: SegmentRows
  otherRows: SegmentRows
  teamLaborCost: number
}

/**
 * The bid's shared cost — the same formula as the Pricing tab's totalCost
 * (materials + labor + driving + estimator + team labor + travel + the five
 * direct-cost segments). Cost is bid-wide: every packet and price shares it.
 */
export function computeSharedBidCost(i: SharedBidCostInputs): number | null {
  if (!i.costEstimate) return null
  const totalMaterials = (i.materialTotalRoughIn ?? 0) + (i.materialTotalTopOut ?? 0) + (i.materialTotalTrimSet ?? 0)
  const totalLaborHours = i.laborRows.reduce((s, r) => s + laborRowHours(r), 0)
  const laborCost = totalLaborHours * (i.laborRate ?? 0)
  const distance = parseFloat(i.distanceFromOffice ?? '0') || 0
  const drivingCost = (totalLaborHours / costEstimateHoursPerTrip(i.costEstimate)) * costEstimateDrivingRate(i.costEstimate) * distance
  return (
    totalMaterials +
    laborCost +
    drivingCost +
    costEstimateEstimatorCost(i.costEstimate, i.countRowsLen) +
    i.teamLaborCost +
    computeTravelCost(i.costEstimate) +
    sumEquipmentRows(i.equipmentRows) +
    sumEquipmentRows(i.permitRows) +
    sumEquipmentRows(i.subcontractorRows) +
    sumEquipmentRows(i.wasteRows) +
    sumEquipmentRows(i.otherRows)
  )
}

export type PackageMapPricingLike = {
  id: string
  name: string
  bid_version_id: string | null
  include_in_submission: boolean
  sort_order: number
}

export type PackageMapPriceStatus = 'base' | 'alternate' | 'private'

export type PackageMapPrice = {
  id: string
  name: string
  /** Computed revenue for this price on its version's counts; null = not computed. */
  revenue: number | null
  /** Against the shared cost; null when cost or revenue is unknown/zero. */
  margin: number | null
  status: PackageMapPriceStatus
  unpriced: boolean
  viewing: boolean
}

export type PackageMapVersionNode = {
  /** null = the unsplit bid's implicit version. */
  id: string | null
  name: string
  viewing: boolean
  prices: PackageMapPrice[]
}

export type PackageMapPacketNode = {
  key: string
  name: string
  sentOn: string | null
  sentValue: number | null
  outcome: string | null
  /** Got the same letter as the bid's GC (bid_gc_recipients) — no versions of its own. */
  sharedLetter: boolean
  versions: PackageMapVersionNode[]
}

export type PackageMap = {
  packets: PackageMapPacketNode[]
  /** Price options no version claims (neither stamped nor starred) — visible on every tray. */
  unattached: PackageMapPrice[]
  gcCount: number
  versionCount: number
  priceCount: number
}

export type BuildPackageMapArgs = {
  versions: ReadonlyArray<GcVersionLike>
  pricings: ReadonlyArray<PackageMapPricingLike>
  bidGcName: string | null
  gcNames: Record<string, string>
  latestSends: Record<string, LatestSend>
  bidDateSent: string | null
  recipients?: ReadonlyArray<{ customerId: string; name: string }>
  /** Revenue for a price computed on a version's counts (null version = the unsplit rows). */
  revenueOf: (pricingId: string, versionId: string | null) => number | null
  sharedCost: number | null
  selectedVersionId: string | null
  selectedPricingId: string | null
  /** bids.selected_price_book_version_id — the ★ for an unsplit bid. */
  bidStarredPricingId: string | null
}

export function buildPackageMap(args: BuildPackageMapArgs): PackageMap {
  const price = (p: PackageMapPricingLike, versionId: string | null, starId: string | null): PackageMapPrice => {
    const revenue = args.revenueOf(p.id, versionId)
    const unpriced = revenue != null && revenue <= 0
    const margin = args.sharedCost != null && revenue != null && revenue > 0 ? (revenue - args.sharedCost) / revenue : null
    return {
      id: p.id,
      name: p.name,
      revenue,
      margin,
      status: p.id === starId ? 'base' : p.include_in_submission ? 'alternate' : 'private',
      unpriced,
      viewing: p.id === args.selectedPricingId,
    }
  }
  const sorted = [...args.pricings].sort((a, b) => a.sort_order - b.sort_order)

  if (args.versions.length === 0) {
    const prices = sorted.map((p) => price(p, null, args.bidStarredPricingId))
    // The ★ leads the list, mirroring the tray.
    prices.sort((a, b) => Number(b.status === 'base') - Number(a.status === 'base'))
    const packets: PackageMapPacketNode[] = [
      {
        key: '',
        name: args.bidGcName ?? 'This bid',
        sentOn: args.bidDateSent,
        sentValue: null,
        outcome: null,
        sharedLetter: false,
        versions: [{ id: null, name: 'Current', viewing: true, prices }],
      },
    ]
    for (const r of args.recipients ?? []) {
      packets.push({ key: r.customerId, name: r.name, sentOn: args.bidDateSent, sentValue: null, outcome: null, sharedLetter: true, versions: [] })
    }
    return { packets, unattached: [], gcCount: packets.length, versionCount: 1, priceCount: prices.length }
  }

  const grouped = groupVersionsByGc(args.versions, {
    bidGcName: args.bidGcName,
    gcNames: args.gcNames,
    latestSends: args.latestSends,
    bidDateSent: args.bidDateSent,
    recipients: args.recipients,
  })

  const claimed = new Set<string>()
  const packets: PackageMapPacketNode[] = grouped.map((g) => ({
    key: g.key,
    name: g.name,
    sentOn: g.sentOn,
    sentValue: g.sentValue,
    outcome: g.outcome,
    sharedLetter: g.sharedLetter === true,
    versions: g.versions.map((v) => {
      const starId = v.starred_price_book_version_id ?? null
      const own = sorted.filter((p) => p.bid_version_id === v.id || p.id === starId)
      for (const p of own) claimed.add(p.id)
      const prices = own.map((p) => price(p, v.id, starId))
      prices.sort((a, b) => Number(b.status === 'base') - Number(a.status === 'base'))
      return { id: v.id, name: v.name, viewing: v.id === args.selectedVersionId, prices }
    }),
  }))

  // A price no version claims still shows on every version's tray — surface it
  // once at the bottom instead of hiding it (legacy pre-G1 pricings).
  const unattached = sorted.filter((p) => !claimed.has(p.id)).map((p) => price(p, args.selectedVersionId, null))

  return {
    packets,
    unattached,
    gcCount: packets.length,
    versionCount: args.versions.length,
    priceCount: sorted.length,
  }
}
