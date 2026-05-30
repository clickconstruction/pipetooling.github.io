/**
 * Shared logic for the Bids -> Pricing tab print views.
 *
 * Both print buttons build identical cost-math, pricing rows, and an HTML document shell:
 * - `Print` button  -> `printPricingPage` in `src/pages/Bids.tsx` (current selected version).
 * - `Review` button -> `printAllPricingPages` in `src/pages/Bids.tsx` (loops every version).
 *
 * `buildPricingPrintRows` owns the cost-math + `computeBidPricingRows` + print-row mapping;
 * `pricingDocShell` owns the surrounding `<!DOCTYPE>` document. Both are pure (no DOM/Supabase);
 * callers own data fetching, per-version filtering, the `<table>`/`<section>` chrome, and the
 * `printHtmlInNewWindow` side effect.
 */

import {
  computeBidPricingRows,
  costEstimateLaborRowHours,
  type BidCountRowCalc,
  type CostEstimateLaborRowCalc,
  type PriceBookEntryCalc,
} from '../bidPricingRowCalculations'
import {
  computeTravelCost,
  costEstimateDrivingRate,
  costEstimateHoursPerTrip,
  costEstimateEstimatorCost,
} from '../bids/bidCostCalc'
import { escapeHtml, printHtmlInNewWindow } from './htmlDoc'
import { buildBidPricingPrintTableHtml, type BidPricingPrintRow } from '../buildBidPricingPrintTableHtml'
import { buildPricingCsv, sanitizeCsvFilenamePart } from '../bids/bidCsvExport'
import { laborRowHours } from '../bids/laborRowHours'
import { bidDisplayName } from '../bids/bidFormatting'
import { supabase } from '../supabase'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type {
  PriceBookVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  CostEstimate,
  CostEstimateLaborRow,
} from '../bids/bidPricingEngineTypes'

type PricingAssignmentInput = {
  count_row_id: string
  price_book_entry_id: string
  is_fixed_price: boolean | null
  unit_price_override: number | null
}

export interface PricingPrintRowsInput {
  // cost-math inputs
  materialTotalRoughIn: number | null
  materialTotalTopOut: number | null
  materialTotalTrimSet: number | null
  laborRate: number | null
  laborRows: CostEstimateLaborRowCalc[]
  distanceFromOffice: string | null
  /** cost_estimates row; `driving_cost_rate`/`hours_per_trip`/`estimator_*` read via casts. */
  costEstimate: unknown
  countRowsLength: number
  // pricing-rows inputs
  countRows: BidCountRowCalc[]
  /** Already filtered to the target price book version. */
  assignments: PricingAssignmentInput[]
  entries: PriceBookEntryCalc[]
  customUnitPriceByCountRowId: Map<string, number>
  materialsFromTakeoffByCountRowId: Record<string, number>
  hiddenSubmissionCountRowIds: ReadonlySet<string>
  taxPercent: number
}

export interface PricingPrintRowsResult {
  printRows: BidPricingPrintRow[]
  totalCost: number
  totalRevenue: number
}

export function buildPricingPrintRows(input: PricingPrintRowsInput): PricingPrintRowsResult {
  const totalMaterials =
    (input.materialTotalRoughIn ?? 0) + (input.materialTotalTopOut ?? 0) + (input.materialTotalTrimSet ?? 0)
  const rate = input.laborRate ?? 0
  const totalLaborHours = input.laborRows.reduce((s, r) => s + costEstimateLaborRowHours(r), 0)
  const laborCost = totalLaborHours * rate
  const distance = parseFloat(input.distanceFromOffice ?? '0') || 0
  const ratePerMile = costEstimateDrivingRate(input.costEstimate)
  const hrsPerTrip = costEstimateHoursPerTrip(input.costEstimate)
  const drivingCost = (totalLaborHours / hrsPerTrip) * ratePerMile * distance
  const estimatorCost = costEstimateEstimatorCost(input.costEstimate, input.countRowsLength)
  const travelCost = computeTravelCost(input.costEstimate)
  const totalCost = totalMaterials + laborCost + drivingCost + estimatorCost + travelCost

  const pricing = computeBidPricingRows({
    countRows: input.countRows,
    assignments: input.assignments.map((a) => ({
      count_row_id: a.count_row_id,
      price_book_entry_id: a.price_book_entry_id,
      is_fixed_price: a.is_fixed_price ?? false,
      unit_price_override: a.unit_price_override,
    })),
    entries: input.entries,
    customUnitPriceByCountRowId: input.customUnitPriceByCountRowId,
    laborRows: input.laborRows,
    totalMaterials,
    laborRate: rate,
    taxPercent: input.taxPercent,
    materialsFromTakeoffByCountRowId: input.materialsFromTakeoffByCountRowId,
    hiddenSubmissionCountRowIds: input.hiddenSubmissionCountRowIds,
  })

  const printRows: BidPricingPrintRow[] = pricing.rows.map((pr) => {
    const assignment = input.assignments.find((a) => a.count_row_id === pr.countRow.id)
    return {
      fixture: pr.countRow.fixture ?? null,
      count: pr.count,
      priceBookEntryName: pr.entry?.fixture_types?.name ?? null,
      unitPrice: pr.unitPrice,
      isFixedPrice: assignment?.is_fixed_price === true,
      cost: pr.cost,
      revenue: pr.revenue,
      marginPct: pr.marginPct,
      pctOfGrandTotal: pr.pctOfGrandTotal,
    }
  })

  return { printRows, totalCost, totalRevenue: pricing.totalRevenue }
}

/**
 * Full `<!DOCTYPE>` document for the Pricing print views.
 * `title` is escaped once (callers pass raw). `extraStyle` is inserted verbatim immediately
 * before the `@media print` rule (e.g. the `.price-book-page` rule for the all-versions view).
 */
export function pricingDocShell(title: string, body: string, extraStyle = ''): string {
  const safeTitle = escapeHtml(title)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.25rem; margin-bottom: 1rem; }
  h2 { font-size: 1rem; margin: 1rem 0 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  th { background: #f5f5f5; }
${extraStyle}  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${safeTitle}</h1>
  ${body}
</body></html>`
}

/**
 * Raw Pricing-tab state needed by the print/CSV orchestrators below. The caller
 * (BidsPricingTab) assembles this once and the orchestrators own the per-version
 * filtering, cost-math, HTML/CSV assembly, supabase reads, and side effects.
 */
export type PricingPrintContext = {
  bid: BidWithBuilder
  priceBookVersions: PriceBookVersion[]
  priceBookEntries: PriceBookEntryWithFixture[]
  selectedPricingVersionId: string | null
  countRows: BidCountRow[]
  costEstimate: CostEstimate | null
  laborRows: CostEstimateLaborRow[]
  materialTotalRoughIn: number | null
  materialTotalTopOut: number | null
  materialTotalTrimSet: number | null
  laborRate: number | null
  fixtureMaterialsFromTakeoff: Record<string, number>
  viewModel: 'cost' | 'price'
  assignments: BidPricingAssignment[]
  customPrices: BidCountRowCustomPrice[]
  submissionHides: BidCountRowSubmissionHide[]
  taxPercent: number
}

/** Local copy of the page-level helper (kept in Bids.tsx for the submission-followup print code). */
function submissionHiddenIdsForVersion(
  hides: readonly BidCountRowSubmissionHide[],
  versionId: string,
): Set<string> {
  const s = new Set<string>()
  for (const h of hides) {
    if (h.price_book_version_id === versionId) s.add(h.count_row_id)
  }
  return s
}

/** Print the Pricing page for the currently selected price book version. */
export function printPricingPage(ctx: PricingPrintContext) {
  const { bid, priceBookVersions, selectedPricingVersionId, countRows, costEstimate } = ctx
  const title = (bidDisplayName(bid) || 'Bid') + ' — Pricing'
  const versionName = escapeHtml(priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? '—')

  let bodyContent: string
  if (selectedPricingVersionId && countRows.length > 0 && costEstimate) {
    const assignmentsForVersionPrint = ctx.assignments.filter(
      (a) => a.price_book_version_id === selectedPricingVersionId,
    )
    const customMapPrint = new Map<string, number>()
    for (const cp of ctx.customPrices) {
      if (cp.price_book_version_id === selectedPricingVersionId) {
        customMapPrint.set(cp.count_row_id, Number(cp.unit_price))
      }
    }
    const hiddenPrint = submissionHiddenIdsForVersion(ctx.submissionHides, selectedPricingVersionId)
    const { printRows, totalCost, totalRevenue } = buildPricingPrintRows({
      materialTotalRoughIn: ctx.materialTotalRoughIn,
      materialTotalTopOut: ctx.materialTotalTopOut,
      materialTotalTrimSet: ctx.materialTotalTrimSet,
      laborRate: ctx.laborRate,
      laborRows: ctx.laborRows,
      distanceFromOffice: bid.distance_from_office ?? null,
      costEstimate,
      countRowsLength: countRows.length,
      countRows,
      assignments: assignmentsForVersionPrint,
      entries: ctx.priceBookEntries,
      customUnitPriceByCountRowId: customMapPrint,
      materialsFromTakeoffByCountRowId: ctx.fixtureMaterialsFromTakeoff,
      hiddenSubmissionCountRowIds: hiddenPrint,
      taxPercent: ctx.taxPercent,
    })
    const tableInnerHtml = buildBidPricingPrintTableHtml({
      rows: printRows,
      totalCost,
      totalRevenue,
      viewModel: ctx.viewModel,
    })
    bodyContent = `<h2>Price book</h2>
  <p>${versionName}</p>
  <table>${tableInnerHtml}</table>`
  } else {
    bodyContent = '<p style="color:#6b7280">Select a price book version and ensure Counts and Labor are set up.</p>'
  }

  printHtmlInNewWindow(pricingDocShell(title, bodyContent))
}

/**
 * Print every price book version on its own page. Loads entries/assignments/custom
 * prices/submission hides for all versions itself. Returns an error message string on
 * a fetch failure (caller surfaces it via setError) or null on success.
 */
export async function printAllPricingPages(ctx: PricingPrintContext): Promise<string | null> {
  const { bid, priceBookVersions, countRows, costEstimate } = ctx
  const title = (bidDisplayName(bid) || 'Bid') + ' — Pricing (All price books)'

  let bodyContent: string
  if (priceBookVersions.length === 0) {
    bodyContent = '<p style="color:#6b7280">No price book versions.</p>'
  } else if (!costEstimate || countRows.length === 0) {
    bodyContent = '<p style="color:#6b7280">Select a price book version and ensure Counts and Labor are set up.</p>'
  } else {
    const versionIds = priceBookVersions.map((v) => v.id)
    const [entriesResult, assignmentsResult, customPricesResult, submissionHidesResult] = await Promise.all([
      supabase.from('price_book_entries').select('*, fixture_types(name)').in('version_id', versionIds),
      supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bid.id),
      supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
      supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
    ])
    const { data: allEntries, error: entriesErr } = entriesResult
    if (entriesErr) return `Failed to load price book entries: ${entriesErr.message}`
    const allCustomPrices = (customPricesResult.data as BidCountRowCustomPrice[]) ?? []
    if (customPricesResult.error) return `Failed to load custom prices: ${customPricesResult.error.message}`
    const allSubmissionHides = (submissionHidesResult.data as BidCountRowSubmissionHide[]) ?? []
    if (submissionHidesResult.error) return `Failed to load submission hides: ${submissionHidesResult.error.message}`
    const allAssignments = (assignmentsResult.data as BidPricingAssignment[]) ?? []
    const entriesByVersion = new Map<string, PriceBookEntryWithFixture[]>()
    for (const e of (allEntries as PriceBookEntryWithFixture[]) ?? []) {
      const list = entriesByVersion.get(e.version_id) ?? []
      list.push(e)
      entriesByVersion.set(e.version_id, list)
    }
    for (const list of entriesByVersion.values()) {
      list.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
    }
    const taxPctAll = ctx.taxPercent
    const sections: string[] = []
    for (let i = 0; i < priceBookVersions.length; i++) {
      const version = priceBookVersions[i]!
      const entries = entriesByVersion.get(version.id) ?? []
      const assignsV = allAssignments.filter((a) => a.price_book_version_id === version.id)
      const customMapV = new Map<string, number>()
      for (const cp of allCustomPrices) {
        if (cp.price_book_version_id === version.id) {
          customMapV.set(cp.count_row_id, Number(cp.unit_price))
        }
      }
      const hiddenV = submissionHiddenIdsForVersion(allSubmissionHides, version.id)
      const { printRows, totalCost, totalRevenue } = buildPricingPrintRows({
        materialTotalRoughIn: ctx.materialTotalRoughIn,
        materialTotalTopOut: ctx.materialTotalTopOut,
        materialTotalTrimSet: ctx.materialTotalTrimSet,
        laborRate: ctx.laborRate,
        laborRows: ctx.laborRows,
        distanceFromOffice: bid.distance_from_office ?? null,
        costEstimate,
        countRowsLength: countRows.length,
        countRows,
        assignments: assignsV,
        entries,
        customUnitPriceByCountRowId: customMapV,
        materialsFromTakeoffByCountRowId: ctx.fixtureMaterialsFromTakeoff,
        hiddenSubmissionCountRowIds: hiddenV,
        taxPercent: taxPctAll,
      })
      const tableInnerHtml = buildBidPricingPrintTableHtml({
        rows: printRows,
        totalCost,
        totalRevenue,
        viewModel: ctx.viewModel,
      })
      const pageBreak = i === priceBookVersions.length - 1 ? 'auto' : 'always'
      const versionName = version.name
      sections.push(
        `<section class="price-book-page" style="page-break-after: ${pageBreak}">
  <h2>${escapeHtml(versionName)}</h2>
  <table>${tableInnerHtml}</table>
</section>`
      )
    }
    bodyContent = sections.join('\n')
  }

  printHtmlInNewWindow(pricingDocShell(title, bodyContent, '  .price-book-page { margin-top: 1rem; }\n'))
  return null
}

/**
 * Build the Pricing CSV for the selected version. Returns the CSV text + filename, or
 * null when the version/counts/labor preconditions are not met (caller toasts). The
 * caller owns the Blob/download side effect and `teamLaborCost` lookup.
 */
export function buildPricingCsvForBid(
  ctx: PricingPrintContext,
  teamLaborCost: number,
): { csv: string; filename: string } | null {
  const { bid, priceBookVersions, selectedPricingVersionId, countRows, costEstimate } = ctx
  if (!selectedPricingVersionId || countRows.length === 0 || !costEstimate) return null

  const bidLabel = bidDisplayName(bid) || 'bid'
  const versionName = priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? 'version'

  const totalMaterials = (ctx.materialTotalRoughIn ?? 0) + (ctx.materialTotalTopOut ?? 0) + (ctx.materialTotalTrimSet ?? 0)
  const rate = ctx.laborRate ?? 0
  const totalLaborHours = ctx.laborRows.reduce((s, r) => s + laborRowHours(r), 0)
  const taxPercent = ctx.taxPercent
  const laborCostAll = totalLaborHours * rate
  const distance = parseFloat(bid.distance_from_office ?? '0') || 0
  const ratePerMile = costEstimateDrivingRate(costEstimate)
  const hrsPerTrip = costEstimateHoursPerTrip(costEstimate)
  const numTrips = totalLaborHours / hrsPerTrip
  const drivingCost = numTrips * ratePerMile * distance
  const estimatorCost = costEstimateEstimatorCost(costEstimate, countRows.length)
  const travelCost = computeTravelCost(costEstimate)
  const totalBidCost = totalMaterials + laborCostAll + drivingCost + estimatorCost + teamLaborCost + travelCost

  const assignmentsForVersionCsv = ctx.assignments.filter((a) => a.price_book_version_id === selectedPricingVersionId)
  const customMapCsv = new Map<string, number>()
  for (const cp of ctx.customPrices) {
    if (cp.price_book_version_id === selectedPricingVersionId) {
      customMapCsv.set(cp.count_row_id, Number(cp.unit_price))
    }
  }
  const hiddenCsv = submissionHiddenIdsForVersion(ctx.submissionHides, selectedPricingVersionId)
  const pricingCsv = computeBidPricingRows({
    countRows,
    assignments: assignmentsForVersionCsv.map((a) => ({
      count_row_id: a.count_row_id,
      price_book_entry_id: a.price_book_entry_id,
      is_fixed_price: a.is_fixed_price ?? false,
      unit_price_override: a.unit_price_override,
    })),
    entries: ctx.priceBookEntries,
    customUnitPriceByCountRowId: customMapCsv,
    laborRows: ctx.laborRows,
    totalMaterials,
    laborRate: rate,
    taxPercent,
    materialsFromTakeoffByCountRowId: ctx.fixtureMaterialsFromTakeoff,
    hiddenSubmissionCountRowIds: hiddenCsv,
  })
  const totalRevenue = pricingCsv.totalRevenue
  const rowCalcs = pricingCsv.rows.map((pr) => ({
    fixture: pr.countRow.fixture ?? '',
    count: pr.count,
    priceBookEntry: pr.entry?.fixture_types?.name ?? '',
    fixedPrice: pr.assignment?.is_fixed_price === true,
    unitPrice: pr.unitPrice,
    ourCost: pr.cost,
    revenue: pr.revenue,
    marginPct: pr.marginPct,
    pctOfTotalDisplay: pr.pctOfGrandTotal,
  }))

  const csv = buildPricingCsv(rowCalcs, { totalBidCost, totalRevenue })
  const filename = `pricing_${sanitizeCsvFilenamePart(bidLabel)}_${sanitizeCsvFilenamePart(versionName)}_${new Date().toISOString().slice(0, 10)}.csv`
  return { csv, filename }
}
