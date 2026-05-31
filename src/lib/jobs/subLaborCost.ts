import { laborItemsSubtotal, type PeopleLaborJobItemLike } from '../peopleLaborJobItemLineCost'

export type LaborJobCostInput = {
  labor_rate: number | null
  items?: PeopleLaborJobItemLike[]
  distance_miles?: number | null
}

/** Sub labor book row cost (line totals + drive); matches jobSummaryData / laborCostByHcp aggregation. */
export function laborJobSubCost(lj: LaborJobCostInput, mileageCost: number, timePerMile: number): number {
  const jobRate = lj.labor_rate ?? 0
  const lineTotal = laborItemsSubtotal(lj.items, jobRate)
  const miles = Number(lj.distance_miles) || 0
  const driveCost =
    miles > 0 && jobRate > 0
      ? miles * mileageCost + miles * timePerMile * jobRate
      : miles > 0
        ? miles * mileageCost
        : 0
  return lineTotal + driveCost
}
