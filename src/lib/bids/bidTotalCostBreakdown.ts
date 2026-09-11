/**
 * One total for a bid's cost (the Labor refresh PR 3).
 *
 * Before this kernel the same arithmetic lived in four places — the Pricing
 * tab's workbench, the Pricing print/CSV builders, the Labor page print and
 * the approval PDF — and they disagreed: the workbench counted the five
 * direct-cost tables and the bid's clocked team labor, the documents did not.
 * Every reader now calls `computeBidCostBreakdown` and prints the parts it
 * wants; the total is the same number everywhere.
 *
 *   materials     PO / takeoff totals by stage
 *   labor         Σ row hours × the labor rate
 *   driving       (hours ÷ hours per trip) × $/mile × distance to office
 *   travel        people × nights × (meals + hotel)
 *   other direct  equipment · permits · subs · waste · other (stage amounts)
 *
 * Reported but NOT in the total (v2.3293, "estimator time retired"): the old
 * estimator-time box (flat, or $/count × count rows) and the team labor
 * clocked on the bid itself. Bid labor is a recorded fact that already sits in
 * the overhead pool — the job's Burn treats overhead the same way — so the
 * direct cost stops carrying an invented number for it.
 *
 * Pure. Row hours go through `costEstimateLaborRowHours` → `laborRowHours`, so
 * task, sub and per-100-ft rows read the same as on the Labor tab.
 */
import { computeTravelCost, costEstimateDrivingRate, costEstimateEstimatorCost, costEstimateHoursPerTrip } from './bidCostCalc'
import { isDirectCostKind, type DirectCostKind } from './costEstimateDirectCosts'
import { costEstimateLaborRowHours, type CostEstimateLaborRowCalc } from '../bidPricingRowCalculations'

/** Any labor row shape a reader holds — the DB row, the print calc row, a test literal. */
type LaborRowLike = Omit<CostEstimateLaborRowCalc, 'fixture'> & { fixture?: string | null }

export type StageAmountRow = { rough_in?: unknown; top_out?: unknown; trim_set?: unknown }
/** A direct-cost row with its kind — the `cost_estimate_direct_costs` view row, or a table row tagged by `directCostRowsFromTables`. */
export type DirectCostRowLike = StageAmountRow & { kind: string | null }

/** Tag the five amber tables' rows with their kind so the kernel can read them as one list. */
export function directCostRowsFromTables(tables: Partial<Record<DirectCostKind, ReadonlyArray<StageAmountRow> | null | undefined>>): DirectCostRowLike[] {
  const out: DirectCostRowLike[] = []
  for (const kind of ['equipment', 'permit', 'sub', 'waste', 'other'] as const) {
    for (const r of tables[kind] ?? []) out.push({ kind, rough_in: r.rough_in, top_out: r.top_out, trim_set: r.trim_set })
  }
  return out
}

const amount = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export type BidCostBreakdownInput = {
  materialTotalRoughIn: number | null | undefined
  materialTotalTopOut: number | null | undefined
  materialTotalTrimSet: number | null | undefined
  laborRate: number | null | undefined
  laborRows: ReadonlyArray<LaborRowLike>
  /** `bids.distance_from_office` (text) or a number of miles. */
  distanceFromOffice: string | number | null | undefined
  /** The `cost_estimates` row (driving rate, hours per trip, estimator, travel are read off it with the lib defaults). */
  costEstimate: unknown
  countRowsLength: number
  /** The five direct-cost tables as one list (view rows, or `directCostRowsFromTables`). Omit = none. */
  directCostRows?: ReadonlyArray<DirectCostRowLike> | null
  /** Team labor clocked on the bid, when the reader has it. */
  teamLaborCost?: number | null
  /** Overrides for callers whose inputs are still strings (the Labor print reads the tab's boxes). */
  ratePerMileOverride?: number | null
  hoursPerTripOverride?: number | null
}

export type BidCostBreakdown = {
  totalMaterials: number
  rate: number
  totalLaborHours: number
  laborCost: number
  distance: number
  ratePerMile: number
  hrsPerTrip: number
  numTrips: number
  drivingCost: number
  estimatorCost: number
  travelCost: number
  teamLaborCost: number
  equipmentRentalCost: number
  permitCost: number
  subcontractorCost: number
  wasteCost: number
  otherCost: number
  /** equipment + permits + subs + waste + other. */
  otherDirectCost: number
  /** labor + driving + travel — the Labor page's "Labor total". Estimator time and team labor are reported above, not added (v2.3293). */
  laborCostWithDriving: number
  /** Everything but materials: laborCostWithDriving + otherDirectCost. */
  directCost: number
  totalCost: number
}

export function computeBidCostBreakdown(i: BidCostBreakdownInput): BidCostBreakdown {
  const totalMaterials = (i.materialTotalRoughIn ?? 0) + (i.materialTotalTopOut ?? 0) + (i.materialTotalTrimSet ?? 0)
  const rate = i.laborRate != null && Number.isFinite(Number(i.laborRate)) ? Number(i.laborRate) : 0
  const totalLaborHours = i.laborRows.reduce((s, r) => s + costEstimateLaborRowHours({ fixture: null, ...r }), 0)
  const laborCost = totalLaborHours * rate
  const distance = typeof i.distanceFromOffice === 'number' ? i.distanceFromOffice : parseFloat(i.distanceFromOffice ?? '0') || 0
  const ratePerMile = i.ratePerMileOverride != null ? i.ratePerMileOverride : costEstimateDrivingRate(i.costEstimate)
  const hrsPerTrip = i.hoursPerTripOverride != null && i.hoursPerTripOverride > 0 ? i.hoursPerTripOverride : costEstimateHoursPerTrip(i.costEstimate)
  const numTrips = hrsPerTrip > 0 ? totalLaborHours / hrsPerTrip : 0
  const drivingCost = numTrips * ratePerMile * distance
  const estimatorCost = costEstimateEstimatorCost(i.costEstimate, i.countRowsLength)
  const travelCost = computeTravelCost(i.costEstimate)
  const teamLaborCost = i.teamLaborCost != null && Number.isFinite(i.teamLaborCost) ? i.teamLaborCost : 0
  const byKind: Record<DirectCostKind, number> = { equipment: 0, permit: 0, sub: 0, waste: 0, other: 0 }
  for (const r of i.directCostRows ?? []) {
    if (!isDirectCostKind(r.kind)) continue
    byKind[r.kind] += amount(r.rough_in) + amount(r.top_out) + amount(r.trim_set)
  }
  const otherDirectCost = byKind.equipment + byKind.permit + byKind.sub + byKind.waste + byKind.other
  const laborCostWithDriving = laborCost + drivingCost + travelCost
  const directCost = laborCostWithDriving + otherDirectCost
  return {
    totalMaterials,
    rate,
    totalLaborHours,
    laborCost,
    distance,
    ratePerMile,
    hrsPerTrip,
    numTrips,
    drivingCost,
    estimatorCost,
    travelCost,
    teamLaborCost,
    equipmentRentalCost: byKind.equipment,
    permitCost: byKind.permit,
    subcontractorCost: byKind.sub,
    wasteCost: byKind.waste,
    otherCost: byKind.other,
    otherDirectCost,
    laborCostWithDriving,
    directCost,
    totalCost: totalMaterials + directCost,
  }
}
