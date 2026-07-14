import { laborJobSubCost, type LaborJobCostInput } from './subLaborCost'

/**
 * Case-insensitive, trimmed match of a sub-labor book's `job_number` to a job's
 * HCP # — same normalization Jobs uses for HCP keys. Blank HCP matches nothing.
 */
export function laborJobMatchesHcp(
  jobNumber: string | null | undefined,
  hcpNumber: string | null | undefined,
): boolean {
  const hcp = (hcpNumber ?? '').trim().toLowerCase()
  if (!hcp) return false
  return (jobNumber ?? '').trim().toLowerCase() === hcp
}

export type JobProfitSummary = {
  /** Sub-labor books total (line items + drive cost) for the job's HCP #. */
  laborCost: number
  /** Tally parts total (price at time × quantity). */
  partsCost: number
  /** Job revenue; null revenue reads as $0 owed. */
  totalBill: number
  profit: number
}

/** Job Detail profit band (masters/devs): revenue minus tally parts minus sub labor. */
export function buildJobProfitSummary(args: {
  revenue: number | null
  tallyPartsTotal: number
  laborJobs: LaborJobCostInput[]
  mileageCost: number
  timePerMile: number
}): JobProfitSummary {
  const laborCost = args.laborJobs.reduce(
    (s, lj) => s + laborJobSubCost(lj, args.mileageCost, args.timePerMile),
    0,
  )
  const totalBill = args.revenue != null ? Number(args.revenue) : 0
  const partsCost = args.tallyPartsTotal
  return { laborCost, partsCost, totalBill, profit: totalBill - partsCost - laborCost }
}
