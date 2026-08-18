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
  /**
   * All four Parts Cost buckets — supply house invoices + card charges +
   * tally + other job charges — matching the Cost Timeline and the weekly
   * money-movement math (v2.1801; was tally-only before, which overstated
   * profit on any job whose parts came in on an invoice or the card).
   */
  partsCost: number
  /** Job revenue; null revenue reads as $0 owed. */
  totalBill: number
  profit: number
}

/** Job Detail profit band (masters/devs): revenue minus all parts buckets minus sub labor. */
export function buildJobProfitSummary(args: {
  revenue: number | null
  supplyInvoiceTotal: number
  cardChargesTotal: number
  tallyPartsTotal: number
  otherChargesTotal: number
  laborJobs: LaborJobCostInput[]
  mileageCost: number
  timePerMile: number
}): JobProfitSummary {
  const laborCost = args.laborJobs.reduce(
    (s, lj) => s + laborJobSubCost(lj, args.mileageCost, args.timePerMile),
    0,
  )
  const totalBill = args.revenue != null ? Number(args.revenue) : 0
  const partsCost = args.supplyInvoiceTotal + args.cardChargesTotal + args.tallyPartsTotal + args.otherChargesTotal
  return { laborCost, partsCost, totalBill, profit: totalBill - partsCost - laborCost }
}
