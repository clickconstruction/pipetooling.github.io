import { laborJobSubCost, type LaborJobCostInput } from './subLaborCost'

export type JobProfitSummary = {
  /** Sub-labor sheets total (line items + drive cost) for the sheets linked to the job. */
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
