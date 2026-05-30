/**
 * Approval PDF builder for the Bids -> Submission & Followup tab.
 *
 * `downloadApprovalPdf` fetches its own data from Supabase, builds a 4-page jsPDF
 * document (Submission + Margins, Pricing, Labor, Cover Letter), and triggers a download.
 * The caller (Bids.tsx) builds the `ApprovalPdfContext` (the selected bid, the price-book
 * versions and service types from the pricing engine, and the cover-letter options resolved
 * for the bid) and invokes this; everything else is self-contained here.
 */

import { loadJsPDF } from '../loadJsPDF'
import { supabase } from '../supabase'
import {
  computeBidPricingRows,
  coverLetterTotalsFromPricingRows,
  type ComputeBidPricingRowsResult,
} from '../bidPricingRowCalculations'
import { submissionHiddenIdsForVersion } from '../bids/submissionHides'
import { laborRowHours } from '../bids/laborRowHours'
import {
  computeTravelCost,
  costEstimateDrivingRate,
  costEstimateHoursPerTrip,
  costEstimateEstimatorCost,
} from '../bids/bidCostCalc'
import { bidDisplayName, formatCompactCurrency, formatDesignDrawingPlanDate } from '../bids/bidFormatting'
import { formatCurrency } from '../format'
import { extractContactInfo } from '../bids/bidContactInfo'
import { buildCoverLetterText, numberToWords } from './coverLetter'
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

export type ApprovalPdfContext = {
  bid: BidWithBuilder
  priceBookVersions: PriceBookVersion[]
  serviceTypes: { id: string; name: string }[]
  coverLetter: {
    useCustomAmount: boolean
    customAmount: string
    inclusions: string
    exclusions: string
    terms: string
    includeDesignDrawingPlanDate: boolean
    includeFixturesPerPlan: boolean
    includeSignature: boolean
  }
}

/** Sum of `price_at_time * quantity` for a purchase order's items. */
async function loadPOTotal(poId: string): Promise<number> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('price_at_time, quantity')
    .eq('purchase_order_id', poId)
  if (error) return 0
  const items = (data as { price_at_time: number; quantity: number }[]) ?? []
  return items.reduce((sum, i) => sum + Number(i.price_at_time) * Number(i.quantity), 0)
}

export async function downloadApprovalPdf(ctx: ApprovalPdfContext): Promise<void> {
  const b = ctx.bid
  const priceBookVersions = ctx.priceBookVersions
  const bidId = b.id
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
      let cellY = cy + 4
      let rowH = tableLineHeight
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
  let reviewPdfLaborRows: CostEstimateLaborRow[] = []
  let reviewPdfTotalMaterials = 0
  let reviewPdfLaborRate = 0
  const { data: countDataReview } = await supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
  const countRowsReview = (countDataReview as BidCountRow[]) ?? []
  const { data: estForReview } = await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()
  const estForReviewData = estForReview as CostEstimate | null
  if (estForReviewData) {
    reviewGroupHasCostEstimate = true
    const [laborResR, roughR, topR, trimR] = await Promise.all([
      supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', estForReviewData.id).order('sequence_order', { ascending: true }),
      estForReviewData.purchase_order_id_rough_in ? loadPOTotal(estForReviewData.purchase_order_id_rough_in) : Promise.resolve(0),
      estForReviewData.purchase_order_id_top_out ? loadPOTotal(estForReviewData.purchase_order_id_top_out) : Promise.resolve(0),
      estForReviewData.purchase_order_id_trim_set ? loadPOTotal(estForReviewData.purchase_order_id_trim_set) : Promise.resolve(0),
    ])
    const laborRowsR = (laborResR.data as CostEstimateLaborRow[]) ?? []
    const totalMaterialsR = (roughR ?? 0) + (topR ?? 0) + (trimR ?? 0)
    const rateR = estForReviewData.labor_rate != null ? Number(estForReviewData.labor_rate) : 0
    reviewPdfLaborRows = laborRowsR
    reviewPdfTotalMaterials = totalMaterialsR
    reviewPdfLaborRate = rateR
    const totalHoursR = laborRowsR.reduce(
      (s, r) => s + laborRowHours(r),
      0
    )
    const distanceR = parseFloat(b.distance_from_office ?? '0') || 0
    const drivingRateR = costEstimateDrivingRate(estForReviewData)
    const hrsPerTripR = costEstimateHoursPerTrip(estForReviewData)
    const numTripsR = totalHoursR / hrsPerTripR
    const drivingCostR = numTripsR * drivingRateR * distanceR
    const estimatorCostR = costEstimateEstimatorCost(estForReviewData, countRowsReview.length)
    reviewGroupCostEstimateAmount = totalMaterialsR + (totalHoursR * rateR) + drivingCostR + estimatorCostR
  }
  const [customPdfRes, hidesPdfRes] = await Promise.all([
    supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bidId),
    supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bidId),
  ])
  const allBidCustomPricesPdf = (customPdfRes.data as BidCountRowCustomPrice[]) ?? []
  const allBidSubmissionHidesPdf = (hidesPdfRes.data as BidCountRowSubmissionHide[]) ?? []
  for (const v of priceBookVersions) {
    const [entriesResR, assignResR] = await Promise.all([
      supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', v.id),
      supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', v.id),
    ])
    const entriesR = (entriesResR.data as PriceBookEntryWithFixture[]) ?? []
    entriesR.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
    const assignmentsR = (assignResR.data as BidPricingAssignment[]) ?? []
    const customMapR = new Map(
      (allBidCustomPricesPdf ?? [])
        .filter((c) => c.price_book_version_id === v.id)
        .map((c) => [c.count_row_id, Number(c.unit_price)]),
    )
    const hiddenR = submissionHiddenIdsForVersion(allBidSubmissionHidesPdf, v.id)
    const computedR = computeBidPricingRows({
      countRows: countRowsReview,
      assignments: assignmentsR.map((a) => ({
        count_row_id: a.count_row_id,
        price_book_entry_id: a.price_book_entry_id,
        is_fixed_price: a.is_fixed_price ?? false,
        unit_price_override: a.unit_price_override,
      })),
      entries: entriesR,
      customUnitPriceByCountRowId: customMapR,
      laborRows: reviewPdfLaborRows,
      totalMaterials: reviewPdfTotalMaterials,
      laborRate: reviewPdfLaborRate,
      taxPercent: 8.25,
      materialsFromTakeoffByCountRowId: {},
      hiddenSubmissionCountRowIds: hiddenR,
    })
    const totalRevenueR = computedR.totalRevenue
    const completeR = computedR.rows.every(
      (pr) =>
        pr.entry != null ||
        customMapR.has(pr.countRow.id),
    )
    const marginR = completeR && totalRevenueR > 0 && reviewGroupCostEstimateAmount != null
      ? (totalRevenueR - reviewGroupCostEstimateAmount) / totalRevenueR * 100
      : null
    reviewGroupPricingByVersion.push({ versionName: v.name, revenue: totalRevenueR, margin: marginR, complete: completeR })
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
  pushLink('Marked Up Plans or Cover Page:', b.count_tooling_link?.trim() || null)
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

  let approvalPricingForCover: ComputeBidPricingRowsResult | null = null
  const versionId = b.selected_price_book_version_id ?? null
  const { data: countData } = await supabase.from('bids_count_rows').select('*').eq('bid_id', bidId).order('sequence_order', { ascending: true })
  const countRows = (countData as BidCountRow[]) ?? []
  let pricingContent = 'No price book selected or no count rows.'
  if (versionId && countRows.length > 0) {
    const [entriesRes, assignRes, customRes, hidesRes] = await Promise.all([
      supabase.from('price_book_entries').select('*, fixture_types(name)').eq('version_id', versionId),
      supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bidId).eq('price_book_version_id', versionId),
      supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bidId).eq('price_book_version_id', versionId),
      supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bidId).eq('price_book_version_id', versionId),
    ])
    const entries = (entriesRes.data as PriceBookEntryWithFixture[]) ?? []
    entries.sort((a, b) => (a.fixture_types?.name ?? '').localeCompare(b.fixture_types?.name ?? '', undefined, { numeric: true }))
    const assignments = (assignRes.data as BidPricingAssignment[]) ?? []
    const customPricesP2 = (customRes.data as BidCountRowCustomPrice[]) ?? []
    const submissionHidesP2 = (hidesRes.data as BidCountRowSubmissionHide[]) ?? []
    const hiddenP2 = submissionHiddenIdsForVersion(submissionHidesP2, versionId)
    const customMapP2 = new Map(customPricesP2.map((c) => [c.count_row_id, Number(c.unit_price)]))

    let laborRowsP2: CostEstimateLaborRow[] = []
    let totalMatP2 = 0
    let rateP2 = 0
    const estQuickData = ((await supabase.from('cost_estimates').select('*').eq('bid_id', bidId).maybeSingle()).data) as CostEstimate | null
    if (estQuickData) {
      const [lrP2, r0, t0, tr0] = await Promise.all([
        supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', estQuickData.id).order('sequence_order', { ascending: true }),
        estQuickData.purchase_order_id_rough_in ? loadPOTotal(estQuickData.purchase_order_id_rough_in) : Promise.resolve(0),
        estQuickData.purchase_order_id_top_out ? loadPOTotal(estQuickData.purchase_order_id_top_out) : Promise.resolve(0),
        estQuickData.purchase_order_id_trim_set ? loadPOTotal(estQuickData.purchase_order_id_trim_set) : Promise.resolve(0),
      ])
      laborRowsP2 = (lrP2.data as CostEstimateLaborRow[]) ?? []
      totalMatP2 = (r0 ?? 0) + (t0 ?? 0) + (tr0 ?? 0)
      rateP2 = estQuickData.labor_rate != null ? Number(estQuickData.labor_rate) : 0
    }

    approvalPricingForCover = computeBidPricingRows({
      countRows,
      assignments: assignments.map((a) => ({
        count_row_id: a.count_row_id,
        price_book_entry_id: a.price_book_entry_id,
        is_fixed_price: a.is_fixed_price ?? false,
        unit_price_override: a.unit_price_override,
      })),
      entries,
      customUnitPriceByCountRowId: customMapP2,
      laborRows: laborRowsP2,
      totalMaterials: totalMatP2,
      laborRate: rateP2,
      taxPercent: 8.25,
      materialsFromTakeoffByCountRowId: {},
      hiddenSubmissionCountRowIds: hiddenP2,
    })
    const totalRevenue = approvalPricingForCover.totalRevenue

    const versionName = priceBookVersions.find((v) => v.id === versionId)?.name ?? '—'
    push(`Price book: ${versionName}`)
    y += lineHeight
    const pricingColWidths = [48, 18, 48, 40, 48]
    const pricingRows: string[][] = []
    for (const pr of approvalPricingForCover.rows) {
      if (pr.omitFromSubmissionDocuments) continue
      const entry = pr.entry as PriceBookEntryWithFixture | undefined
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
    push('No cost estimate created.')
  } else {
    const [laborRes, roughTotal, topTotal, trimTotal, countRes] = await Promise.all([
      supabase.from('cost_estimate_labor_rows').select('*').eq('cost_estimate_id', est.id).order('sequence_order', { ascending: true }),
      est.purchase_order_id_rough_in ? loadPOTotal(est.purchase_order_id_rough_in) : Promise.resolve(0),
      est.purchase_order_id_top_out ? loadPOTotal(est.purchase_order_id_top_out) : Promise.resolve(0),
      est.purchase_order_id_trim_set ? loadPOTotal(est.purchase_order_id_trim_set) : Promise.resolve(0),
      supabase.from('bids_count_rows').select('id').eq('bid_id', bidId),
    ])
    const laborRows = (laborRes.data as CostEstimateLaborRow[]) ?? []
    const countRowsForEst = (countRes.data as { id: string }[]) ?? []
    const totalMaterials = (roughTotal ?? 0) + (topTotal ?? 0) + (trimTotal ?? 0)
    const rate = est.labor_rate != null ? Number(est.labor_rate) : 0
    const totalHours = laborRows.reduce(
      (s, r) => s + laborRowHours(r),
      0
    )
    const laborCost = totalHours * rate
    const distance = parseFloat(b.distance_from_office ?? '0') || 0
    const drivingRatePerMile = costEstimateDrivingRate(est)
    const hrsPerTrip = costEstimateHoursPerTrip(est)
    const numTrips = totalHours / hrsPerTrip
    const drivingCost = numTrips * drivingRatePerMile * distance
    const estimatorCost = costEstimateEstimatorCost(est, countRowsForEst.length)
    const travelCost = computeTravelCost(est)
    const laborCostWithDriving = laborCost + drivingCost + estimatorCost + travelCost
    const grandTotal = totalMaterials + laborCostWithDriving

    push('Materials')
    y += lineHeight
    const materialsColWidths = [100, 70]
    y = drawTable(y, materialsColWidths, ['Item', 'Amount'], [
      ['PO (Rough In)', `$${formatCurrency(roughTotal ?? 0)}`],
      ['PO (Top Out)', `$${formatCurrency(topTotal ?? 0)}`],
      ['PO (Trim Set)', `$${formatCurrency(trimTotal ?? 0)}`],
      ['Materials Total', `$${formatCurrency(totalMaterials)}`],
    ])
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
    if (estimatorCost > 0) {
      push(`Estimator cost: $${formatCurrency(estimatorCost)}`)
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
    if (estimatorCost > 0) {
      summaryRows.push(['Estimator', `$${formatCurrency(estimatorCost)}`])
    }
    if (travelCost > 0) {
      summaryRows.push(['Travel', `$${formatCurrency(travelCost)}`])
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

  const customerName = b.customers?.name ?? b.bids_gc_builders?.name ?? '—'
  const customerAddress = b.customers?.address ?? b.bids_gc_builders?.address ?? '—'
  const projectNameVal = b.project_name ?? '—'
  const projectAddressVal = b.address ?? '—'
  let coverLetterRevenue = 0
  const fixtureRows: { fixture: string; count: number }[] = []
  if (approvalPricingForCover) {
    const totals = coverLetterTotalsFromPricingRows(approvalPricingForCover.rows)
    coverLetterRevenue = totals.revenueSum
    fixtureRows.push(...totals.fixtureRows)
  }
  const useCustomAmount = ctx.coverLetter.useCustomAmount
  const customAmountStr = ctx.coverLetter.customAmount.replace(/,/g, '').trim()
  const customAmountNum = customAmountStr ? parseFloat(customAmountStr) : NaN
  const effectiveRevenue = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : coverLetterRevenue
  const revenueWords = numberToWords(effectiveRevenue).toUpperCase()
  const revenueNumber = `$${formatCurrency(effectiveRevenue)}`
  const inclusions = ctx.coverLetter.inclusions
  const exclusions = ctx.coverLetter.exclusions
  const terms = ctx.coverLetter.terms
  const designDrawingPlanDateFormatted = (ctx.coverLetter.includeDesignDrawingPlanDate && b.design_drawing_plan_date) ? formatDesignDrawingPlanDate(b.design_drawing_plan_date) : null
  const effectiveIncludeFixtures = !designDrawingPlanDateFormatted || ctx.coverLetter.includeFixturesPerPlan
  const bidServiceType = ctx.serviceTypes.find((st) => st.id === b.service_type_id)
  const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
  const coverLetterText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, ctx.coverLetter.includeSignature, effectiveIncludeFixtures)
  const coverLines = coverLetterText.split('\n')
  for (const line of coverLines) {
    if (y > pageH - margin) { doc.addPage(); y = margin }

    const isInclusionsHeading = line === 'Inclusions:'
    const isExclusionsHeading = line === 'Exclusions and Scope:'
    const makeBold = isInclusionsHeading || isExclusionsHeading

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
