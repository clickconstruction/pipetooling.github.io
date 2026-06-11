import { supabase } from '../supabase'
import { printHtmlInNewWindow } from './htmlDoc'
import { buildCostEstimatePOHtml, type CostEstimatePOModalItem } from './costEstimatePO'
import { buildRoughLaborPageHtml, buildExactLaborPageHtml } from './laborPage'
import { buildLaborSubSheetHtml, buildAllLaborSubSheetsHtml } from './laborSubSheet'
import { laborRowHours, laborRowRough, laborRowTop, laborRowTrim } from '../bids/laborRowHours'
import { normalizeMaterialsModel, sumRoughLinesPreTaxWithCount } from '../bids/bidTakeoffHelpers'
import { computeTravelCost, costEstimateEstimatorCost } from '../bids/bidCostCalc'
import { bidDisplayName } from '../bids/bidFormatting'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type { CostEstimate, CostEstimateLaborRow, CostEstimatePO } from '../bids/bidPricingEngineTypes'

export type CostEstimatePrintContext = {
  bid: BidWithBuilder
  /** Active bid Version whose takeoff materials this doc reflects (null = unsplit Base). */
  bidVersionId: string | null
  costEstimate: CostEstimate | null
  laborRows: CostEstimateLaborRow[]
  countRows: BidCountRow[]
  purchaseOrders: CostEstimatePO[]
  materialTotalRoughIn: number | null
  materialTotalTopOut: number | null
  materialTotalTrimSet: number | null
  laborRateInput: string
  drivingCostRate: string
  hoursPerTrip: string
  taxPercent: number
}

export function printCostEstimatePOForReview(poName: string, items: CostEstimatePOModalItem[], taxPercent: number) {
  printHtmlInNewWindow(buildCostEstimatePOHtml({ variant: 'review', poName, items, taxPercent }))
}

export function printCostEstimatePOForSupplyHouse(poName: string, items: CostEstimatePOModalItem[], taxPercent: number) {
  printHtmlInNewWindow(buildCostEstimatePOHtml({ variant: 'supplyHouse', poName, items, taxPercent }))
}

export async function printCostEstimatePage(ctx: CostEstimatePrintContext) {
  const { bid, costEstimate, laborRows: estimateLaborRows, countRows, purchaseOrders } = ctx
  const title = (bidDisplayName(bid) || 'Bid') + ' — Labor'
  const laborRows = estimateLaborRows.map((row) => ({
    fixture: row.fixture ?? null,
    count: Number(row.count),
    roughPerUnit: Number(row.rough_in_hrs_per_unit),
    topPerUnit: Number(row.top_out_hrs_per_unit),
    trimPerUnit: Number(row.trim_set_hrs_per_unit),
    totalHrs: laborRowHours(row),
  }))
  const laborTotals =
    estimateLaborRows.length > 0
      ? {
          rough: estimateLaborRows.reduce((s, r) => s + laborRowRough(r), 0),
          top: estimateLaborRows.reduce((s, r) => s + laborRowTop(r), 0),
          trim: estimateLaborRows.reduce((s, r) => s + laborRowTrim(r), 0),
        }
      : null
  if (normalizeMaterialsModel(bid.materials_model) === 'rough') {
    const bidId = bid.id
    const roughQuery = supabase
      .from('bids_takeoff_rough_part_lines')
      .select('count_row_id, quantity, unit_price, part_id, source_template_id, sequence_order')
      .eq('bid_id', bidId)
    const { data: roughLines } = await (ctx.bidVersionId == null
      ? roughQuery.is('bid_version_id', null)
      : roughQuery.eq('bid_version_id', ctx.bidVersionId))
    const lines = [...(roughLines ?? [])].sort((a, b) => {
      const ca = String(a.count_row_id).localeCompare(String(b.count_row_id))
      if (ca !== 0) return ca
      return Number(a.sequence_order) - Number(b.sequence_order)
    }) as Array<{ count_row_id: string; quantity: number; unit_price: number; part_id: string | null; source_template_id: string | null; sequence_order: number }>
    const partIds = Array.from(new Set(lines.map((l) => l.part_id).filter((x): x is string => !!x)))
    const { data: partsData } = partIds.length
      ? await supabase.from('material_parts').select('id, name').in('id', partIds)
      : { data: [] as { id: string; name: string }[] }
    const nameById = new Map((partsData ?? []).map((p) => [p.id, p.name ?? '']))
    // Bundle lines (no part) show the assembly name.
    const templateIds = Array.from(
      new Set(lines.filter((l) => !l.part_id && l.source_template_id).map((l) => l.source_template_id as string)),
    )
    const templateNameById = new Map<string, string>()
    if (templateIds.length) {
      const { data: tplData } = await supabase.from('material_templates').select('id, name').in('id', templateIds)
      for (const t of (tplData ?? []) as { id: string; name: string | null }[]) templateNameById.set(t.id, t.name ?? '')
    }
    const taxPercent = ctx.taxPercent
    const countByRowId = new Map(countRows.map((cr) => [cr.id, cr.count]))
    const totalMaterials = ctx.materialTotalRoughIn ?? sumRoughLinesPreTaxWithCount(lines, countByRowId)
    const materials = countRows.map((cr) => ({
      fixture: cr.fixture ?? null,
      count: Number(cr.count),
      lines: lines
        .filter((l) => l.count_row_id === cr.id)
        .map((l) => ({
          partName: l.part_id
            ? (nameById.get(l.part_id) ?? l.part_id.slice(0, 8))
            : `${templateNameById.get(l.source_template_id ?? '') ?? 'Assembly'} (bundle)`,
          unitPrice: Number(l.unit_price),
          quantity: Number(l.quantity),
        })),
    }))
    const rate = ctx.laborRateInput.trim() === '' ? 0 : parseFloat(ctx.laborRateInput) || 0
    const totalHours = estimateLaborRows.reduce((s, r) => s + laborRowHours(r), 0)
    const laborCost = totalHours * rate
    const distance = parseFloat(bid.distance_from_office ?? '0') || 0
    const ratePerMile = parseFloat(ctx.drivingCostRate) || 0.7
    const hrsPerTrip = parseFloat(ctx.hoursPerTrip) || 2.0
    const numTrips = totalHours / hrsPerTrip
    const drivingCost = numTrips * ratePerMile * distance
    const estimatorCost = costEstimateEstimatorCost(costEstimate, countRows.length)
    const travelCost = computeTravelCost(costEstimate)
    const laborCostWithDriving = laborCost + drivingCost + estimatorCost + travelCost
    const grandTotal = totalMaterials + laborCostWithDriving
    printHtmlInNewWindow(
      buildRoughLaborPageHtml({
        title,
        rows: laborRows,
        totals: laborTotals,
        costs: { totalMaterials, taxPercent, rate, totalHours, laborCost, distance, ratePerMile, numTrips, drivingCost, estimatorCost, travelCost, laborCostWithDriving, grandTotal },
        materials,
      }),
    )
    return
  }
  const poRoughName = purchaseOrders.find((p) => p.id === costEstimate?.purchase_order_id_rough_in)?.name ?? '—'
  const poTopName = purchaseOrders.find((p) => p.id === costEstimate?.purchase_order_id_top_out)?.name ?? '—'
  const poTrimName = purchaseOrders.find((p) => p.id === costEstimate?.purchase_order_id_trim_set)?.name ?? '—'
  const matRough = ctx.materialTotalRoughIn ?? 0
  const matTop = ctx.materialTotalTopOut ?? 0
  const matTrim = ctx.materialTotalTrimSet ?? 0
  const totalMaterials = matRough + matTop + matTrim

  // Load PO items for each stage
  const loadPOItems = async (poId: string | null | undefined) => {
    if (!poId) return []
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('quantity, price_at_time, material_parts(name), source_template:material_templates!source_template_id(id, name)')
      .eq('purchase_order_id', poId)
      .order('sequence_order', { ascending: true })
    if (error) return []
    const rows = (data ?? []) as unknown as Array<{ quantity: number; price_at_time: number; material_parts: { name: string } | null; source_template: { id: string; name: string } | null }>
    return rows.map(row => ({
      part_name: row.material_parts?.name ?? '—',
      quantity: row.quantity,
      price_at_time: row.price_at_time,
      template_name: row.source_template?.name ?? null
    }))
  }

  const [roughItems, topItems, trimItems] = await Promise.all([
    loadPOItems(costEstimate?.purchase_order_id_rough_in),
    loadPOItems(costEstimate?.purchase_order_id_top_out),
    loadPOItems(costEstimate?.purchase_order_id_trim_set)
  ])

  const taxPercent = ctx.taxPercent
  const rate = ctx.laborRateInput.trim() === '' ? 0 : parseFloat(ctx.laborRateInput) || 0
  const totalHours = estimateLaborRows.reduce((s, r) => s + laborRowHours(r),
    0
  )
  const laborCost = totalHours * rate
  const distance = parseFloat(bid.distance_from_office ?? '0') || 0
  const ratePerMile = parseFloat(ctx.drivingCostRate) || 0.70
  const hrsPerTrip = parseFloat(ctx.hoursPerTrip) || 2.0
  const numTrips = totalHours / hrsPerTrip
  const drivingCost = numTrips * ratePerMile * distance
  const estimatorCost = costEstimateEstimatorCost(costEstimate, countRows.length)
  const travelCost = computeTravelCost(costEstimate)
  const laborCostWithDriving = laborCost + drivingCost + estimatorCost + travelCost
  const grandTotal = totalMaterials + laborCostWithDriving
  printHtmlInNewWindow(
    buildExactLaborPageHtml({
      title,
      rows: laborRows,
      totals: laborTotals,
      costs: { totalMaterials, taxPercent, rate, totalHours, laborCost, distance, ratePerMile, numTrips, drivingCost, estimatorCost, travelCost, laborCostWithDriving, grandTotal },
      pos: [
        { stageLabel: 'Rough In', poName: poRoughName, stageMaterialTotal: matRough, items: roughItems },
        { stageLabel: 'Top Out', poName: poTopName, stageMaterialTotal: matTop, items: topItems },
        { stageLabel: 'Trim Set', poName: poTrimName, stageMaterialTotal: matTrim, items: trimItems },
      ],
    }),
  )
}

export function printRoughInSubSheet(ctx: CostEstimatePrintContext) {
  const rate = ctx.laborRateInput.trim() === '' ? 0 : parseFloat(ctx.laborRateInput) || 0
  printHtmlInNewWindow(
    buildLaborSubSheetHtml({
      bidName: bidDisplayName(ctx.bid),
      stageLabel: 'Rough In',
      stage: 'rough_in',
      rows: ctx.laborRows,
      rate,
    })
  )
}

export function printTopOutSubSheet(ctx: CostEstimatePrintContext) {
  const rate = ctx.laborRateInput.trim() === '' ? 0 : parseFloat(ctx.laborRateInput) || 0
  printHtmlInNewWindow(
    buildLaborSubSheetHtml({
      bidName: bidDisplayName(ctx.bid),
      stageLabel: 'Top Out',
      stage: 'top_out',
      rows: ctx.laborRows,
      rate,
    })
  )
}

export function printTrimSetSubSheet(ctx: CostEstimatePrintContext) {
  const rate = ctx.laborRateInput.trim() === '' ? 0 : parseFloat(ctx.laborRateInput) || 0
  printHtmlInNewWindow(
    buildLaborSubSheetHtml({
      bidName: bidDisplayName(ctx.bid),
      stageLabel: 'Trim Set',
      stage: 'trim_set',
      rows: ctx.laborRows,
      rate,
    })
  )
}

export function printAllSubSheets(ctx: CostEstimatePrintContext) {
  const rate = ctx.laborRateInput.trim() === '' ? 0 : parseFloat(ctx.laborRateInput) || 0
  printHtmlInNewWindow(
    buildAllLaborSubSheetsHtml({
      bidName: bidDisplayName(ctx.bid),
      rows: ctx.laborRows,
      rate,
    })
  )
}
