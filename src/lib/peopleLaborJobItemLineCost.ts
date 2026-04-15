/** Shape shared by DB rows and form rows for Sub Labor line costing. */
export type PeopleLaborJobItemLike = {
  count?: number
  hrs_per_unit?: number
  is_fixed?: boolean
  labor_rate?: number | null
  direct_labor_amount?: number | null
}

/** Line labor $: direct amount when set, else hours × effective rate. */
export function lineLaborCost(item: PeopleLaborJobItemLike, jobLaborRate: number): number {
  const direct = item.direct_labor_amount
  if (direct != null && Number.isFinite(Number(direct))) {
    return Number(direct)
  }
  const hrs = Number(item.hrs_per_unit) || 0
  const laborHrs = item.is_fixed ?? false ? hrs : (Number(item.count) || 0) * hrs
  const rate = item.labor_rate != null ? Number(item.labor_rate) : jobLaborRate
  return laborHrs * rate
}

export function laborItemsSubtotal(items: PeopleLaborJobItemLike[] | undefined, jobLaborRate: number): number {
  return (items ?? []).reduce((s, i) => s + lineLaborCost(i, jobLaborRate), 0)
}
