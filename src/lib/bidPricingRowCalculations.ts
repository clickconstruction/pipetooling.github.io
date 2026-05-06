/**
 * Shared Pricing tab row math and submission visibility (omit-from-list flag).
 * Matches Bids Pricing table cost allocation (labor hours + materials with optional takeoff tax).
 */

export type BidCountRowCalc = {
  id: string
  fixture: string | null
  count: number | string | null
}

export type BidPricingAssignmentCalc = {
  count_row_id: string
  price_book_entry_id: string
  is_fixed_price: boolean
  unit_price_override: number | null
}

export type PriceBookEntryCalc = {
  id: string
  total_price: number | string | null
  fixture_types?: { name: string } | null
}

export type CostEstimateLaborRowCalc = {
  fixture: string | null
  count: number | string | null
  rough_in_hrs_per_unit: number | string | null
  top_out_hrs_per_unit: number | string | null
  trim_set_hrs_per_unit: number | string | null
  is_fixed: boolean | null
}

export function costEstimateLaborRowHours(r: CostEstimateLaborRowCalc): number {
  const hrs =
    Number(r.rough_in_hrs_per_unit) +
    Number(r.top_out_hrs_per_unit) +
    Number(r.trim_set_hrs_per_unit)
  return r.is_fixed ? hrs : Number(r.count) * hrs
}

export type ComputeBidPricingRowsInput = {
  countRows: BidCountRowCalc[]
  assignments: BidPricingAssignmentCalc[]
  entries: PriceBookEntryCalc[]
  /** count_row_id -> unit price when no assignment match uses custom price row */
  customUnitPriceByCountRowId: Map<string, number>
  laborRows: CostEstimateLaborRowCalc[]
  totalMaterials: number
  laborRate: number
  /** e.g. 8.25 — applied only when materials come from takeoff for that row */
  taxPercent: number
  materialsFromTakeoffByCountRowId: Record<string, number>
  /** Count rows omitted from Cover Letter / Approval fixture lists (revenue unchanged) */
  hiddenSubmissionCountRowIds: ReadonlySet<string>
}

export type ComputedBidPricingRow = {
  countRow: BidCountRowCalc
  count: number
  assignment: BidPricingAssignmentCalc | undefined
  entry: PriceBookEntryCalc | undefined
  unitPrice: number
  isFixedPrice: boolean
  omitFromSubmissionDocuments: boolean
  revenue: number
  cost: number
  laborCost: number
  laborHrs: number
  materialsBeforeTax: number
  materialsWithTax: number
  marginPct: number | null
  pctOfGrandTotal: number | null
}

export type ComputeBidPricingRowsResult = {
  rows: ComputedBidPricingRow[]
  totalRevenue: number
}

function resolveEntryForRow(
  countRow: BidCountRowCalc,
  assignment: BidPricingAssignmentCalc | undefined,
  entries: PriceBookEntryCalc[],
  entriesById: Map<string, PriceBookEntryCalc>,
): PriceBookEntryCalc | undefined {
  if (assignment) return entriesById.get(assignment.price_book_entry_id)
  return entries.find(
    (e) =>
      (e.fixture_types?.name ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase(),
  )
}

function standardUnitRevenue(unitPrice: number, count: number, isFixed: boolean): number {
  return isFixed ? unitPrice : count * unitPrice
}

/** Line cost aligned with Pricing table (Materials / takeoff branch). */
function lineCostForRow(
  laborHrs: number,
  laborRate: number,
  totalLaborHours: number,
  totalMaterials: number,
  taxPercent: number,
  materialsFromTakeoff: number | undefined,
): { laborCost: number; materialsBeforeTax: number; materialsWithTax: number; cost: number } {
  const laborCost = laborHrs * laborRate
  const materialsBeforeTax =
    materialsFromTakeoff != null
      ? materialsFromTakeoff
      : totalLaborHours > 0
        ? totalMaterials * (laborHrs / totalLaborHours)
        : 0
  const materialsWithTax =
    materialsFromTakeoff != null
      ? materialsBeforeTax * (1 + taxPercent / 100)
      : materialsBeforeTax
  const cost = laborCost + materialsWithTax
  return { laborCost, materialsBeforeTax, materialsWithTax, cost }
}

export function computeBidPricingRows(input: ComputeBidPricingRowsInput): ComputeBidPricingRowsResult {
  const entriesById = new Map(input.entries.map((e) => [e.id, e]))
  const assignmentByRow = new Map(
    input.assignments.map((a) => [a.count_row_id, a]),
  )

  const totalLaborHours = input.laborRows.reduce((s, r) => s + costEstimateLaborRowHours(r), 0)

  const rows: ComputedBidPricingRow[] = []
  let totalRevenue = 0

  for (const countRow of input.countRows) {
    const count = Number(countRow.count)
    const assignment = assignmentByRow.get(countRow.id)
    const entry = resolveEntryForRow(countRow, assignment, input.entries, entriesById)
    const customPrice = input.customUnitPriceByCountRowId.get(countRow.id)

    const unitPrice =
      assignment?.unit_price_override ?? (entry ? Number(entry.total_price) : customPrice ?? 0)
    const isFixedPrice = assignment?.is_fixed_price ?? false
    const revenue = standardUnitRevenue(unitPrice, count, isFixedPrice)
    totalRevenue += revenue

    const laborRow =
      input.laborRows.find(
        (l) => (l.fixture ?? '').toLowerCase() === (countRow.fixture ?? '').toLowerCase(),
      )
    const laborHrs = laborRow ? costEstimateLaborRowHours(laborRow) : 0
    const takeoffMat = input.materialsFromTakeoffByCountRowId[countRow.id]
    const { laborCost, materialsBeforeTax, materialsWithTax, cost } = lineCostForRow(
      laborHrs,
      input.laborRate,
      totalLaborHours,
      input.totalMaterials,
      input.taxPercent,
      takeoffMat,
    )

    rows.push({
      countRow,
      count,
      assignment,
      entry,
      unitPrice,
      isFixedPrice,
      omitFromSubmissionDocuments: input.hiddenSubmissionCountRowIds.has(countRow.id),
      revenue,
      cost,
      laborCost,
      laborHrs,
      materialsBeforeTax,
      materialsWithTax,
      marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
      pctOfGrandTotal: null,
    })
  }

  for (const r of rows) {
    r.pctOfGrandTotal = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : null
  }

  return { rows, totalRevenue }
}

export type SubmissionFixtureRow = { fixture: string; count: number }

/** Revenue includes all rows; fixtures list skips omitted rows only. */
export function coverLetterTotalsFromPricingRows(rows: ComputedBidPricingRow[]): {
  revenueSum: number
  fixtureRows: SubmissionFixtureRow[]
} {
  let revenueSum = 0
  const fixtureRows: SubmissionFixtureRow[] = []
  for (const r of rows) {
    revenueSum += r.revenue
    if (!r.omitFromSubmissionDocuments) {
      fixtureRows.push({ fixture: r.countRow.fixture ?? '', count: r.count })
    }
  }
  return { revenueSum, fixtureRows }
}
