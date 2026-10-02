/**
 * Approval PDF builder for the Bids -> Submission & Followup tab.
 *
 * `downloadApprovalPdf` fetches its own data from Supabase, builds a 4-page jsPDF
 * document (Submission + Margins, Pricing, Labor, Cover Letter), and triggers a download.
 * The caller (Bids.tsx) builds the `ApprovalPdfContext` (the selected bid, the service types,
 * and the cover-letter options resolved for the bid) and invokes this; everything else —
 * the bid's versions and price scenarios included — is read here.
 */

import { loadJsPDF } from '../loadJsPDF'
import { loadMaterialsByStageForBid } from '../bids/materialsByStageIo'
import { MATERIALS_BY_STAGE_HEADING, SCHEDULE_OF_VALUES_HEADING, materialsByStageLetterRows } from './scheduleOfValues'
import { PAYMENT_SCHEDULE_HEADING } from './paymentSchedule'
import { loadSovLaborShareDefault, loadSovLines, loadSovSplitInputsForBid } from '../bids/sovLaborMaterialIo'
import { bidBasisClause, currentBidBasisExport, shortSheetLabels, type BidBasisExportRowLike } from '../bids/bidBasis'
import { supabase } from '../supabase'
import { coverLetterTotalsFromPricingRows, type ComputeBidPricingRowsResult } from '../bidPricingRowCalculations'
import { laborRowHours } from '../bids/laborRowHours'
import { computeBidCostBreakdown, type DirectCostRowLike } from '../bids/bidTotalCostBreakdown'
import { materialsLines } from '../bids/bidMaterials'
import { loadBidMaterials } from '../bids/bidMaterialsIo'
import { bidDisplayName, formatCompactCurrency, formatDesignDrawingPlanDate } from '../bids/bidFormatting'
import { formatCurrency } from '../format'
import { extractContactInfo } from '../bids/bidContactInfo'
import { deriveActivePricingId, pickActiveVersion } from '../bids/pickActiveVersion'
import { cardsRowScenarios } from '../bids/pricingCardsRow'
import { loadScenarioInputs, scenarioBidVersionIdOf, type ScenarioInputs } from '../bids/loadScenarioInputs'
import { scenarioCustomPriceMap, scenarioPricingRows } from '../bids/scenarioPricingRows'
import {
  resolveSingleLetterGc,
  versionGcOverrideMap,
  type BidVersionGcRow,
  type GcPacketCustomer,
} from '../bids/coverLetterGcPackets'
import { letterDocument, letterRowsFor, letterSectionPlans, letterTotalsWithoutOffered, priceLetterSections, type LetterSection } from '../bids/coverLetterDocument'
import { COVER_LETTER_ALTS_HEADING_DEFAULT, altSectionKey, buildAlternatesBlock, parseCoverLetterAltTexts, type CoverLetterAltsLayout } from '../bids/coverLetterSamePage'
import { COVER_LETTER_ADD_ALTS_HEADING_DEFAULT, buildAddAlternatesBlock, offeredAddAlternates, splitLetterTotalsByAlternate } from '../bids/coverLetterAddAlternates'
import { sectionLabel, type BundlePricing, type BundleVersion } from '../bids/coverLetterVersionBundle'
import { buildCombinedCoverLetterText, buildCoverLetterText, numberToWords, type CoverLetterAlternatesBlock, type CoverLetterScheduleOfValues } from './coverLetter'
import { COVER_LETTER_ORG_DEFAULT_KEYS, coverLetterOrgDefaultsFrom, letterWording } from './coverLetterWording'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type { CostEstimate, CostEstimateLaborRow } from '../bids/bidPricingEngineTypes'

export type ApprovalPdfContext = {
  bid: BidWithBuilder
  serviceTypes: { id: string; name: string }[]
  coverLetter: {
    useCustomAmount: boolean
    customAmount: string
    inclusions: string
    /** The bid's own entry; undefined when nobody typed in the box (the org default applies, else the built-in wording). */
    exclusions: string | undefined
    /** The bid's own entry; undefined when nobody typed in the box (the org default applies, else the built-in wording). */
    terms: string | undefined
    includeDesignDrawingPlanDate: boolean
    includeFixturesPerPlan: boolean
    includeSignature: boolean
    /** This device's Same page / Separate pages choice in the Cover Letter studio. */
    altsLayout: CoverLetterAltsLayout
  }
}

/** A bid version as the PDF reads it: the active-version pick, the letter's bundle and its GC override. */
type ApprovalVersionRow = BundleVersion & BidVersionGcRow
/** A bid's own price scenario. */
type ApprovalPricingRow = BundlePricing & { name: string }

const byFixtureName = (a: { fixture_types?: { name: string } | null }, b: { fixture_types?: { name: string } | null }) =>
  (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true })

export async function downloadApprovalPdf(ctx: ApprovalPdfContext): Promise<void> {
  const b = ctx.bid
  const bidId = b.id
  // The bid's own versions and price scenarios, read here rather than taken from the Pricing tab,
  // which may hold another bid. The versions also carry the letter's flags and GC overrides.
  const [versionsRes, pricingsRes] = await Promise.all([
    supabase.from('bid_versions').select('id, name, sort_order, include_in_submission, is_alternate, starred_price_book_version_id, customer_id, customers(id, name, address)').eq('bid_id', bidId),
    supabase.from('price_book_versions').select('id, name, bid_version_id, sort_order, created_at, include_in_submission').eq('bid_id', bidId).order('sort_order', { ascending: true }),
  ])
  const versionRows = (versionsRes.data ?? []) as unknown as ApprovalVersionRow[]
  const bidPricings = (pricingsRes.data ?? []) as ApprovalPricingRow[]
  // v2.2132: count rows belong to the bid's active version (null = unsplit bid).
  const countsVersionId = pickActiveVersion({ savedVersionId: b.selected_bid_version_id ?? null, bidVersions: versionRows })
  // v2.4373: the active version's price, picked as the Pricing tab picks it — the version's own ★,
  // else the bid's saved price when it is this version's, else the version's first. The bid's saved
  // price alone belongs to whichever version was active when it was saved: on a split bid it priced
  // these rows with another version's prices and read $0.00.
  const pricingId = deriveActivePricingId({
    activeVersionId: countsVersionId,
    bidPricings,
    legacyFallbackPricingId: b.selected_price_book_version_id ?? null,
    versionStarredPricingId: versionRows.find((v) => v.id === countsVersionId)?.starred_price_book_version_id ?? null,
  })
  // Its name: one of the bid's own, else the shared template an unsplit bid prices on, read by id.
  const pricingName = pricingId == null
    ? null
    : bidPricings.find((p) => p.id === pricingId)?.name ??
      ((await supabase.from('price_book_versions').select('name').eq('id', pricingId).maybeSingle()).data as { name?: string } | null)?.name ??
      null
  const countRowsQuery = () => {
    const base = supabase.from('bids_count_rows').select('*').eq('bid_id', bidId)
    return countsVersionId ? base.eq('bid_version_id', countsVersionId) : base.is('bid_version_id', null)
  }
  // A scenario's entries and overlay rows, read once whichever page asks for them. `countRows` is set
  // when the scenario lives on another version: it prices on that version's rows, as the cards do.
  const inputsById = new Map<string, Promise<ScenarioInputs>>()
  const scenarioInputs = (id: string): Promise<ScenarioInputs> => {
    let inputs = inputsById.get(id)
    if (!inputs) {
      inputs = loadScenarioInputs(supabase, { bidId, pricingId: id, scenarioBidVersionId: scenarioBidVersionIdOf(bidPricings, id), selectedBidVersionId: countsVersionId })
        .then((loaded) => ({ ...loaded, entries: [...loaded.entries].sort(byFixtureName) }))
      inputsById.set(id, inputs)
    }
    return inputs
  }
  const margin = 20
  const lineHeight = 6
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ format: 'a4', unit: 'mm' })
  let pageW = doc.internal.pageSize.getWidth()
  let pageH = doc.internal.pageSize.getHeight()
  let y = margin
  const push = (text: string, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold')
    const maxW = pageW - 2 * margin
    const lines = doc.splitTextToSize(text, maxW)
    for (const line of lines) {
      if (y > pageH - margin) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += lineHeight
    }
    if (bold) doc.setFont('helvetica', 'normal')
  }
  const pushLink = (label: string, url: string | null) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label + ' ', margin, y)
    const labelW = doc.getTextWidth(label + ' ')
    doc.setFont('helvetica', 'normal')
    if (url?.trim()) {
      doc.setTextColor(0, 0, 255)
      const displayUrl = url.length > 70 ? url.slice(0, 67) + '...' : url
      doc.textWithLink(displayUrl, margin + labelW, y, { url })
      doc.setTextColor(0, 0, 0)
    } else {
      doc.text('—', margin + labelW, y)
    }
    y += lineHeight
  }

  const tableLineHeight = 6
  const drawTable = (
    startY: number,
    colWidths: number[],
    headers: string[],
    rows: string[][],
    headerBold = true,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): number => {
    let cy = startY
    const left = margin
    const totalW = colWidths.reduce((a, w) => a + w, 0)
    const clip = (str: string, w: number) => {
      const pad = 2
      if (doc.getTextWidth(str) <= w - pad) return str
      let s = str
      while (s.length && doc.getTextWidth(s + '…') > w - pad) s = s.slice(0, -1)
      return s + '…'
    }
    doc.setDrawColor(0.4, 0.4, 0.4)
    doc.setLineWidth(0.2)
    doc.line(left, startY, left + totalW, startY)
    for (let r = -1; r < rows.length; r++) {
      if (cy > pageH - margin) {
        doc.addPage('a4', orientation)
        const size = doc.internal.pageSize
        pageW = size.getWidth()
        pageH = size.getHeight()
        cy = margin
      }
      const cells: string[] = r === -1 ? headers : rows[r] ?? []
      const cellY = cy + 4
      const rowH = tableLineHeight
      for (let c = 0; c < colWidths.length; c++) {
        const x = left + colWidths.slice(0, c).reduce((a, w) => a + w, 0)
        const w = colWidths[c] ?? 0
        const text = (cells[c] ?? '').toString()
        const clipped = clip(text, w)
        if (headerBold && r === -1) doc.setFont('helvetica', 'bold')
        doc.text(clipped, x + 1, cellY)
        if (headerBold && r === -1) doc.setFont('helvetica', 'normal')
      }
      cy += rowH
      doc.line(left, cy, left + totalW, cy)
    }
    doc.line(left, startY, left, cy)
    let x = left
    for (const w of colWidths) {
      x += w
      doc.line(x, startY, x, cy)
    }
    return cy
  }

  // Fetch Margins data (cost estimate + pricing by version) for page 1
  let reviewGroupCostEstimateAmount: number | null = null
  let reviewGroupHasCostEstimate = false
  const reviewGroupPricingByVersion: Array<{ versionName: string; revenue: number; margin: number | null; complete: boolean }> = []
  const { data: countDataReview } = await countRowsQuery().order('sequence_order', { ascending: true })
  const countRowsReview = (countDataReview as BidCountRow[]) ?? []
  const { data: estForReview } = await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()
  const estForReviewData = estForReview as CostEstimate | null
  // One materials read serves the three pages (v2.4368). The bid's model picks the store, as on Pricing:
  // the stage POs for By Stage, the active version's part lines with the order rounding for Combined.
  const bidMaterials = await loadBidMaterials(supabase, {
    bidId,
    bidVersionId: countsVersionId,
    countRows: countRowsReview,
    costEstimate: estForReviewData,
    fallbackModel: b.materials_model,
  })
  if (estForReviewData) {
    reviewGroupHasCostEstimate = true
    const [laborResR, directR] = await Promise.all([
      supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', estForReviewData.id).order('sequence_order', { ascending: true }),
      supabase.from('cost_estimate_direct_costs').select('kind, rough_in, top_out, trim_set').eq('cost_estimate_id', estForReviewData.id),
    ])
    const laborRowsR = (laborResR.data as CostEstimateLaborRow[]) ?? []
    const rateR = estForReviewData.labor_rate != null ? Number(estForReviewData.labor_rate) : 0
    // One total (v2.3292): the same breakdown the Workbench, the Pricing CSV and the Labor page read — travel and the direct-cost tables included.
    reviewGroupCostEstimateAmount = computeBidCostBreakdown({
      materialTotalRoughIn: bidMaterials.roughIn,
      materialTotalTopOut: bidMaterials.topOut,
      materialTotalTrimSet: bidMaterials.trimSet,
      laborRate: rateR,
      laborRows: laborRowsR,
      distanceFromOffice: b.distance_from_office ?? null,
      costEstimate: estForReviewData,
      countRowsLength: countRowsReview.length,
      directCostRows: (directR.data as DirectCostRowLike[] | null) ?? [],
    }).totalCost
  }
  // The margins list the price cards the Pricing tab draws for the active version, each priced
  // on its own version's count rows (v2.4373: every price book on the bid was priced on these
  // rows, so another version's read $0.00 or Incomplete). Revenue needs no costs.
  for (const v of cardsRowScenarios({ priceBookVersions: bidPricings, selectedBidVersionId: countsVersionId, selectedPricingVersionId: pricingId })) {
    const inputs = await scenarioInputs(v.id)
    const computedR = scenarioPricingRows({
      scenarioId: v.id,
      countRows: inputs.countRows ?? countRowsReview,
      entries: inputs.entries,
      assignments: inputs.assignments,
      customPrices: inputs.customPrices,
      hides: inputs.hides,
    })
    const customMapR = scenarioCustomPriceMap(inputs.customPrices, v.id)
    const totalRevenueR = computedR.totalRevenue
    const completeR = computedR.rows.every(
      (pr) =>
        pr.entry != null ||
        customMapR.has(pr.countRow.id),
    )
    const marginR = completeR && totalRevenueR > 0 && reviewGroupCostEstimateAmount != null
      ? (totalRevenueR - reviewGroupCostEstimateAmount) / totalRevenueR * 100
      : null
    // A shared template on a legacy bid is a card called "Standard prices"; the page names it.
    reviewGroupPricingByVersion.push({ versionName: v.id === pricingId && pricingName ? pricingName : v.name, revenue: totalRevenueR, margin: marginR, complete: completeR })
  }

  // Page 1: Submission and followup (same as downloadSubmissionSummaryPdf)
  doc.setFontSize(16)
  push(`${bidDisplayName(b) || 'Bid'} — Submission and Followup`, true)
  y += lineHeight * 2
  doc.setFontSize(11)
  push(`Bid Size: ${formatCompactCurrency(b.bid_value != null ? Number(b.bid_value) : null)}`)
  push(`Builder Name: ${b.customers?.name ?? b.bids_gc_builders?.name ?? '—'}`)
  push(`Builder Address: ${b.customers?.address ?? b.bids_gc_builders?.address ?? '—'}`)
  push(`Builder Phone Number: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).phone || '—' : (b.bids_gc_builders?.contact_number ?? '—')}`)
  push(`Builder Email: ${b.customers ? extractContactInfo(b.customers.contact_info ?? null).email || '—' : (b.bids_gc_builders?.email ?? '—')}`)
  y += lineHeight
  push(`Project Name: ${b.project_name ?? '—'}`)
  push(`Project Address: ${b.address ?? '—'}`)
  y += lineHeight
  push(`Project Contact Name: ${b.gc_contact_name ?? '—'}`)
  push(`Project Contact Phone: ${b.gc_contact_phone ?? '—'}`)
  push(`Project Contact Email: ${b.gc_contact_email ?? '—'}`)
  y += lineHeight
  pushLink('Project Folder:', b.drive_link?.trim() || null)
  y += lineHeight
  pushLink('Job Plans:', b.plans_link?.trim() || null)
  y += lineHeight
  pushLink('CountTooling Plans:', b.count_tooling_plans_link?.trim() || null)
  y += lineHeight
  pushLink('Bid Submission:', b.bid_submission_link?.trim() || null)

  // Margins (same as UI section)
  y += lineHeight
  push('Margins', true)
  y += lineHeight
  push(`Cost estimate: ${reviewGroupHasCostEstimate ? (reviewGroupCostEstimateAmount != null ? `$${formatCurrency(reviewGroupCostEstimateAmount)}` : '—') : 'Not yet created'}`)
  for (const row of reviewGroupPricingByVersion) {
    push(`Price Book: ${row.versionName} | Revenue: ${row.complete ? `$${formatCurrency(row.revenue)}` : 'Incomplete'} | Margin: ${row.complete && row.margin != null ? `${row.margin.toFixed(1)}%` : 'Incomplete'}`)
  }

  // Page 2: Pricing (landscape)
  doc.addPage('a4', 'landscape')
  {
    const size = doc.internal.pageSize
    pageW = size.getWidth()
    pageH = size.getHeight()
  }
  y = margin
  doc.setFontSize(16)
  push(`${bidDisplayName(b) || 'Bid'} — Pricing`, true)
  y += lineHeight * 2
  doc.setFontSize(11)

  // The active version's price on its count rows (prices only — the page prints no cost); the
  // single letter on page 4 reads the same rows.
  let approvalPricingForCover: ComputeBidPricingRowsResult | null = null
  const { data: countData } = await countRowsQuery().order('sequence_order', { ascending: true })
  const countRows = (countData as BidCountRow[]) ?? []
  const pricingContent = 'No price book selected or no count rows.'
  if (pricingId && countRows.length > 0) {
    const inputs = await scenarioInputs(pricingId)
    approvalPricingForCover = scenarioPricingRows({
      scenarioId: pricingId,
      countRows,
      entries: inputs.entries,
      assignments: inputs.assignments,
      customPrices: inputs.customPrices,
      hides: inputs.hides,
    })
    const totalRevenue = approvalPricingForCover.totalRevenue

    push(`Price book: ${pricingName ?? '—'}`)
    y += lineHeight
    const pricingColWidths = [48, 18, 48, 40, 48]
    const pricingRows: string[][] = []
    for (const pr of approvalPricingForCover.rows) {
      if (pr.omitFromSubmissionDocuments) continue
      const entry = pr.entry
      pricingRows.push([
        pr.countRow.fixture ?? '',
        String(pr.count),
        entry?.fixture_types?.name ?? '—',
        `$${Math.round(pr.unitPrice).toLocaleString('en-US')}`,
        `$${Math.round(pr.revenue).toLocaleString('en-US')}`,
      ])
    }
    y = drawTable(y, pricingColWidths, ['Fixture', 'Count', 'Entry', 'Per Unit', 'Revenue'], pricingRows, true, 'landscape')
    y += lineHeight
    push(`Total Revenue: $${formatCurrency(totalRevenue)}`, true)
  } else {
    push(pricingContent)
  }

  // Page 3: Labor (back to portrait)
  doc.addPage('a4', 'portrait')
  {
    const size = doc.internal.pageSize
    pageW = size.getWidth()
    pageH = size.getHeight()
  }
  y = margin
  doc.setFontSize(16)
  push(`${bidDisplayName(b) || 'Bid'} — Labor`, true)
  y += lineHeight * 2
  doc.setFontSize(11)

  const { data: estData } = await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()
  const est = estData as CostEstimate | null
  if (!est) {
    push('No labor costs created.')
  } else {
    const [laborRes, countRes, directRes] = await Promise.all([
      supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
      countRowsQuery(),
      supabase.from('cost_estimate_direct_costs').select('kind, rough_in, top_out, trim_set').eq('cost_estimate_id', est.id),
    ])
    const laborRows = (laborRes.data as CostEstimateLaborRow[]) ?? []
    const countRowsForEst = (countRes.data as { id: string }[]) ?? []
    const totalMaterials = bidMaterials.total
    const rate = est.labor_rate != null ? Number(est.labor_rate) : 0
    const breakdown = computeBidCostBreakdown({
      materialTotalRoughIn: bidMaterials.roughIn,
      materialTotalTopOut: bidMaterials.topOut,
      materialTotalTrimSet: bidMaterials.trimSet,
      laborRate: rate,
      laborRows,
      distanceFromOffice: b.distance_from_office ?? null,
      costEstimate: est,
      countRowsLength: countRowsForEst.length,
      directCostRows: (directRes.data as DirectCostRowLike[] | null) ?? [],
    })
    const { totalLaborHours: totalHours, laborCost, distance, ratePerMile: drivingRatePerMile, numTrips, drivingCost, travelCost, otherDirectCost, laborCostWithDriving, totalCost: grandTotal } = breakdown

    push('Materials')
    y += lineHeight
    const materialsColWidths = [100, 70]
    // By Stage: the three stage POs and their total. Combined: one line, the parts list with the order rounding.
    y = drawTable(y, materialsColWidths, ['Item', 'Amount'], materialsLines(bidMaterials).map((l) => [l.label, `$${formatCurrency(l.amount)}`]))
    y += lineHeight
    push(`Labor — Rate: $${formatCurrency(rate)}/hr`)
    y += lineHeight
    const laborColWidths = [38, 14, 22, 22, 22, 24]
    const laborTableRows: string[][] = laborRows.map((row) => {
      const rough = Number(row.rough_in_hrs_per_unit)
      const top = Number(row.top_out_hrs_per_unit)
      const trim = Number(row.trim_set_hrs_per_unit)
      const totalHrs = laborRowHours(row)
      return [
        row.fixture ?? '',
        String(row.count),
        rough.toFixed(2),
        top.toFixed(2),
        trim.toFixed(2),
        totalHrs.toFixed(2),
      ]
    })
    y = drawTable(y, laborColWidths, ['Fixture', 'Count', 'Rough In', 'Top Out', 'Trim Set', 'Total hrs'], laborTableRows)
    y += lineHeight
    push(`Labor total: $${formatCurrency(laborCost)}`)
    push(`(${totalHours.toFixed(2)} hrs × $${formatCurrency(rate)}/hr)`)
    y += lineHeight
    if (distance > 0 && totalHours > 0) {
      push(`Driving cost: ${numTrips.toFixed(1)} trips × $${drivingRatePerMile.toFixed(2)}/mi × ${distance.toFixed(0)}mi = $${formatCurrency(drivingCost)}`)
      y += lineHeight
    }
    if (travelCost > 0) {
      push(`Travel cost (meals + hotels): $${formatCurrency(travelCost)}`)
      y += lineHeight
    }
    push('Summary', true)
    const summaryColWidths = [100, 70]
    const summaryRows: [string, string][] = [
      ['Materials Total', `$${formatCurrency(totalMaterials)}`],
      ['Labor', `$${formatCurrency(laborCost)}`],
    ]
    if (distance > 0 && totalHours > 0) {
      summaryRows.push(['Driving', `$${formatCurrency(drivingCost)}`])
    }
    if (travelCost > 0) {
      summaryRows.push(['Travel', `$${formatCurrency(travelCost)}`])
    }
    if (otherDirectCost > 0) {
      summaryRows.push(['Other direct (equipment, permits, subs, waste, other)', `$${formatCurrency(otherDirectCost)}`])
    }
    summaryRows.push(
      ['Labor total', `$${formatCurrency(laborCostWithDriving)}`],
      ['Grand total', `$${formatCurrency(grandTotal)}`]
    )
    y = drawTable(y, summaryColWidths, ['Item', 'Amount'], summaryRows)
  }

  // Page 4: Cover Letter
  doc.addPage()
  y = margin
  doc.setFontSize(16)
  push(`${bidDisplayName(b) || 'Bid'} — Cover Letter`, true)
  y += lineHeight * 2
  doc.setFontSize(11)

  // The letter is the one the Cover Letter tab shows (v2.4373), planned through the same kernel: a
  // split bid's in-letter versions at their ★ (a version-less bid's offered prices), a $0 one left
  // off, the active version's GC packet, and this device's layout — so this page says what Print
  // and Copy say. The tab's flags and wording, the versions' GC overrides (v2.1172) and the schedule
  // flags are all read fresh, so a change made there moments ago shows without threading its state.
  const [schedFlagRes, schedRowsRes, orgWordingRes] = await Promise.all([
    supabase.from('bids').select('include_payment_schedule, include_materials_by_stage, include_schedule_of_values, sov_material_factor, sov_split_labor_material, sov_letter_total_only, sov_shape, cover_letter_alt_texts, alternate_group_tags').eq('id', bidId).maybeSingle(),
    supabase.from('bid_payment_schedule_rows').select('*').eq('bid_id', bidId).order('sort_order').order('created_at'),
    supabase.from('app_settings').select('key, value_text').in('key', [...COVER_LETTER_ORG_DEFAULT_KEYS]),
  ])
  const letterFlags = (schedFlagRes.data ?? null) as { cover_letter_alt_texts?: unknown; alternate_group_tags?: string[] | null } | null
  const altTexts = parseCoverLetterAltTexts(letterFlags?.cover_letter_alt_texts)
  const alternateGroupTags = letterFlags?.alternate_group_tags ?? b.alternate_group_tags ?? []
  const plans = letterSectionPlans(versionRows, bidPricings, b.selected_price_book_version_id ?? null)
  let sections: LetterSection[] = []
  if (plans.length > 0 && countRows.length > 0) {
    const ids = [...new Set(plans.flatMap((p) => (p.pricingId ? [p.pricingId] : [])))]
    // Each section on its version's count rows: the bid's rows, read once on a split bid.
    const readAllRows = async () => ((await supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })).data as BidCountRow[] | null) ?? []
    const [inputs, allRows] = await Promise.all([Promise.all(ids.map(scenarioInputs)), versionRows.length > 0 ? readAllRows() : countRows])
    sections = priceLetterSections({
      plans,
      rowsFor: letterRowsFor(allRows, countRows),
      entries: inputs.flatMap((i) => i.entries),
      assignments: inputs.flatMap((i) => i.assignments),
      customPrices: inputs.flatMap((i) => i.customPrices),
      hides: inputs.flatMap((i) => i.hides),
      alternateGroupTags,
      altTexts,
    })
  }
  const versionGcById = versionGcOverrideMap(versionRows)
  const bidGc: GcPacketCustomer = {
    id: b.customer_id ?? null,
    name: b.customers?.name ?? b.bids_gc_builders?.name ?? '—',
    address: b.customers?.address ?? b.bids_gc_builders?.address ?? '—',
  }
  const letter = letterDocument({ sections, versionGcById, bidGc, activeBidVersionId: countsVersionId, layout: ctx.coverLetter.altsLayout })
  // A packet goes to its GC; the single letter follows the active version's GC override, else the bid's.
  const letterGc = letter.packet ? letter.packet.customer : resolveSingleLetterGc(countsVersionId, versionGcById, bidGc)
  const customerName = letterGc.name
  const customerAddress = letterGc.address
  const projectNameVal = b.project_name ?? '—'
  const projectAddressVal = b.address ?? '—'
  // The single letter reads the active price's rows. An offered with-and-without alternate (v2.4195)
  // leaves the amount and prints as an add-on under it, on the same-page letter too.
  const activeSplit = approvalPricingForCover ? splitLetterTotalsByAlternate(approvalPricingForCover.rows, countRows, alternateGroupTags) : null
  const offeredAdd = offeredAddAlternates(activeSplit, altTexts)
  const singleLetter = approvalPricingForCover
    ? letterTotalsWithoutOffered(coverLetterTotalsFromPricingRows(approvalPricingForCover.rows), activeSplit, altTexts)
    : { revenueSum: 0, fixtureRows: [] }
  const useCustomAmount = ctx.coverLetter.useCustomAmount
  const customAmountStr = ctx.coverLetter.customAmount.replace(/,/g, '').trim()
  const customAmountNum = customAmountStr ? parseFloat(customAmountStr) : NaN
  const effectiveRevenue = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : singleLetter.revenueSum
  const inclusions = ctx.coverLetter.inclusions
  // v2.4375: the wording the tab's letter prints — the bid's own entry, else the org default
  // (Settings → Bid Cover Letter Defaults), else '' for the builder's built-in wording; the
  // org's closing too. The PDF printed the built-in wording over the org's until then.
  const orgWording = coverLetterOrgDefaultsFrom((orgWordingRes.data ?? []) as Array<{ key: string; value_text: string | null }>)
  const exclusions = letterWording(ctx.coverLetter.exclusions, orgWording.exclusions)
  const terms = letterWording(ctx.coverLetter.terms, orgWording.terms)
  const designDrawingPlanDateFormatted = (ctx.coverLetter.includeDesignDrawingPlanDate && b.design_drawing_plan_date) ? formatDesignDrawingPlanDate(b.design_drawing_plan_date) : null
  const effectiveIncludeFixtures = !designDrawingPlanDateFormatted || ctx.coverLetter.includeFixturesPerPlan
  const bidServiceType = ctx.serviceTypes.find((st) => st.id === b.service_type_id)
  const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
  // Each letter spreads its own amount over the payment schedule and the schedule of values.
  const paymentScheduleRowsData = (schedRowsRes.data ?? []) as { timing: string; percent: number }[]
  const paymentScheduleFor = (amountDollars: number) => schedFlagRes.data?.include_payment_schedule === true && paymentScheduleRowsData.length > 0
    ? { rows: paymentScheduleRowsData.map((r) => ({ timing: r.timing, percent: Number(r.percent) })), amountDollars }
    : null
  // Materials by stage (v2.3673): the same fresh read; the figures come through the one door the
  // Takeoffs rail and the printed schedule use, so the PDF says what they say.
  const stageFlags = (schedFlagRes.data ?? null) as { include_materials_by_stage?: boolean | null; include_schedule_of_values?: boolean | null; sov_material_factor?: number | null; sov_split_labor_material?: boolean | null; sov_letter_total_only?: boolean | null; sov_shape?: string | null } | null
  // One read serves both stage sections (the schedule of values, v2.4066, spreads the letter's amount by the same shares).
  const stageDoc = stageFlags?.include_materials_by_stage === true || stageFlags?.include_schedule_of_values === true
    ? await loadMaterialsByStageForBid(supabase, { bidId, bidVersionId: countsVersionId, bidFactorOverride: stageFlags.sov_material_factor ?? null }).catch(() => null)
    : null
  const materialsByStage = stageFlags?.include_materials_by_stage === true && stageDoc ? { rows: materialsByStageLetterRows(stageDoc.summary) } : null
  // The split (v2.4075) reads the Labor tab, the subs, the company rule and the typed figures through the same door as the tab.
  const splitInputs = stageFlags?.include_schedule_of_values === true && stageDoc && stageFlags.sov_split_labor_material === true
    ? await loadSovSplitInputsForBid(supabase, bidId).catch(() => null)
    : null
  // My lines (v2.4070): the estimator's rows replace the stages; the company share is read on its own when the split is off.
  const sovLines = stageFlags?.include_schedule_of_values === true && stageFlags.sov_shape === 'lines'
    ? await Promise.all([loadSovLines(supabase, bidId), splitInputs ? Promise.resolve(splitInputs.ruleLaborPct) : loadSovLaborShareDefault(supabase)]).then(([lines, ruleLaborPct]) => ({ lines, ruleLaborPct })).catch(() => null)
    : null
  const scheduleOfValuesFor = (amountDollars: number): CoverLetterScheduleOfValues | null => stageFlags?.include_schedule_of_values === true && (stageDoc || sovLines)
    ? {
        summary: stageDoc?.summary ?? { byStage: { rough_in: 0, top_out: 0, trim_set: 0 }, assignedRaw: 0 },
        amountDollars,
        split: splitInputs && stageDoc ? { costs: { labor: splitInputs.costs.labor, material: stageDoc.summary.scaled }, ruleLaborPct: splitInputs.ruleLaborPct, overrides: splitInputs.overrides } : null,
        totalOnly: stageFlags.sov_letter_total_only === true,
        lines: sovLines ? { ...sovLines, split: stageFlags.sov_split_labor_material === true } : null,
      }
    : null
  // Bid basis (v2.3226): the same fresh read — the letter flag + the current marked-up
  // plans export — so the Approval PDF says what the letter says.
  const [basisFlagRes, basisRowsRes] = await Promise.all([
    supabase.from('bids').select('bid_to_marked_plans').eq('id', bidId).maybeSingle(),
    supabase.from('bid_plan_basis_exports').select('id, exported_at, filename, save_method, sheet_labels, sheet_count, ct_updated_at, ct_project_name, superseded_at').eq('bid_id', bidId).order('exported_at', { ascending: false }),
  ])
  const basisCurrent = currentBidBasisExport(((basisRowsRes.data ?? []) as BidBasisExportRowLike[]))
  const bidBasis = basisFlagRes.data?.bid_to_marked_plans === true && basisCurrent
    ? { clause: bidBasisClause({ planDateFormatted: designDrawingPlanDateFormatted, sheets: shortSheetLabels(basisCurrent.sheet_labels ?? [], basisCurrent.ct_project_name ?? null) }) }
    : null
  const letterText = (amount: number, fixtureRows: { fixture: string; count: number }[], alternates: CoverLetterAlternatesBlock | null, addAlternates: CoverLetterAlternatesBlock | null) =>
    buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, numberToWords(amount).toUpperCase(), `$${formatCurrency(amount)}`, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, ctx.coverLetter.includeSignature, effectiveIncludeFixtures, paymentScheduleFor(amount), orgWording.closing, alternates, bidBasis, materialsByStage, scheduleOfValuesFor(amount), addAlternates)
  const addAlternatesBlock = (baseRevenue: number) => buildAddAlternatesBlock(offeredAdd, baseRevenue, altTexts, formatCurrency)
  const baseSectionNames = letter.priced.filter((s) => !s.isAlternate).map((s) => s.name)
  const sectionHeading = (s: LetterSection) =>
    sectionLabel({ name: altTexts.sections?.[altSectionKey(s)]?.label?.trim() || s.name, isAlternate: s.isAlternate }, baseSectionNames)
  // No packet: the single letter. Same page: the base bids are the amount and each alternate a line
  // under it. Separate pages: a full letter per section (one section is just its letter).
  const coverLetterText = !letter.packet
    ? letterText(effectiveRevenue, singleLetter.fixtureRows, null, addAlternatesBlock(effectiveRevenue))
    : letter.samePage
      ? letterText(
          letter.samePage.headlineRevenue,
          letter.samePage.fixtureRows,
          buildAlternatesBlock(letter.samePage, altTexts, formatCurrency, false, { gcName: customerName, projectName: projectNameVal }),
          addAlternatesBlock(letter.samePage.headlineRevenue),
        )
      : buildCombinedCoverLetterText(letter.packet.sections.map((s) => ({ label: sectionHeading(s), text: letterText(s.revenueSum, s.fixtureRows, null, null) })))
  const alternatesHeadings = new Set([altTexts.heading?.trim() || COVER_LETTER_ALTS_HEADING_DEFAULT, COVER_LETTER_ADD_ALTS_HEADING_DEFAULT])
  const coverLines = coverLetterText.split('\n')
  let sectionsStarted = 0
  for (const line of coverLines) {
    if (y > pageH - margin) { doc.addPage(); y = margin }

    // Separate pages: each section's letter starts a page under its heading, as the printed document does.
    const sectionStart = /^===== (.+) =====$/.exec(line)
    if (sectionStart) {
      if (sectionsStarted++ > 0) { doc.addPage(); y = margin }
      push(sectionStart[1]!, true)
      continue
    }

    const isInclusionsHeading = line === 'Inclusions:'
    const isExclusionsHeading = line === 'Exclusions and Scope:'
    const isScheduleHeading = line === PAYMENT_SCHEDULE_HEADING || line === MATERIALS_BY_STAGE_HEADING || line === SCHEDULE_OF_VALUES_HEADING
    const makeBold = isInclusionsHeading || isExclusionsHeading || isScheduleHeading || alternatesHeadings.has(line)

    if (makeBold) {
      doc.setFont('helvetica', 'bold')
    }

    const maxW = pageW - 2 * margin
    const wrapped = doc.splitTextToSize(line, maxW)
    for (const w of wrapped) {
      doc.text(w, margin, y)
      y += lineHeight
    }

    if (makeBold) {
      doc.setFont('helvetica', 'normal')
    }
  }

  const filename = `Approval_${(bidDisplayName(b) || 'Bid').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40)}.pdf`
  doc.save(filename)
}
