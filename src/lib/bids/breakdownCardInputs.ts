/**
 * Bids → Pricing, the three breakdown cards (punch list #128): what each card is handed, read off
 * the Workbench's rows on screen, their marks and their splits. It sat inline in the three cards'
 * props in `BidsPricingTab` (decomposition queue row 1): the Traditional card's rows and totals,
 * the Kind card's rows and the Tag card's rows. Pure. The cards do the arithmetic
 * (`buildPriceBreakdown`, `buildPricingComposition`, `buildTagComposition`); this says what they
 * are given.
 */
import { costEstimateLaborRowHours, type CostEstimateLaborRowCalc } from '../bidPricingRowCalculations'
import type { PriceBreakdownInput, PriceBreakdownRowInput } from './priceBreakdown'
import type { CompositionRowInput } from './pricingComposition'
import { rowKindOf, type RowKind, type RowMarksByRowId } from './rowKinds'
import type { RowSplit } from './rowPriceSplit'

/** What the cards read off one Workbench row; every other field rides along untouched. */
export type BreakdownCardRow = {
  countRow: { id: string; fixture?: string | null }
  count: number
  /** The row's cost (material, tax and labor). */
  cost: number
  /** count × the price on screen (the draft, else an unvetoed preview, else the saved price). */
  effRevenue: number
  /** The row's takeoff material before tax and markup. */
  materialsBeforeTax: number
  /** The Labor row of the same fixture, when there is one. */
  laborRow?: CostEstimateLaborRowCalc | null
}

/** The part of a row's split (`rowPriceSplit`) the cards read. */
export type BreakdownCardSplit = Pick<RowSplit, 'material' | 'tax' | 'equipment' | 'labor' | 'materialSource'>

/** The costs the Traditional card's small-costs line adds up, off `computeBidCostBreakdown`. */
export type BreakdownSmallCosts = {
  drivingCost: number
  travelCost: number
  permitCost: number
  subcontractorCost: number
  wasteCost: number
  otherCost: number
}

const nameOf = (r: BreakdownCardRow): string => r.countRow.fixture ?? ''

/** The row's kind as the cards read it: the saved pick, else the guess from its name. */
const kindOf = (r: BreakdownCardRow, marks: RowMarksByRowId): RowKind => rowKindOf(nameOf(r), marks[r.countRow.id]?.kind).kind

/** Driving, travel, permits, subs, waste and other, at cost: the Traditional card's small-costs line. */
export function breakdownSmallCosts(c: BreakdownSmallCosts): number {
  return c.drivingCost + c.travelCost + c.permitCost + c.subcontractorCost + c.wasteCost + c.otherCost
}

/**
 * The Traditional card's rows: each row's price, its takeoff material, its Labor hours (0 with no
 * Labor row), whether its kind is equipment, and the four dollars of its split.
 */
export function priceCardRows<R extends BreakdownCardRow>(rows: ReadonlyArray<R>, marks: RowMarksByRowId, splitOf: (row: R) => BreakdownCardSplit): PriceBreakdownRowInput[] {
  return rows.map((r) => {
    const s = splitOf(r)
    return {
      id: r.countRow.id,
      name: nameOf(r),
      count: r.count,
      revenue: r.effRevenue,
      materialsBeforeTax: r.materialsBeforeTax,
      hours: r.laborRow ? costEstimateLaborRowHours(r.laborRow) : 0,
      isEquipment: kindOf(r, marks) === 'equipment',
      split: { material: s.material, tax: s.tax, equipment: s.equipment, labor: s.labor },
    }
  })
}

/** What the Traditional card's totals come from: the bid's cost breakdown, its markup and the rate it is costed at. */
export type PriceCardTotals = BreakdownSmallCosts & {
  totalMaterials: number
  totalLaborHours: number
  taxPercent: number
  equipmentRentalCost: number
}

/** The Traditional card's whole input: its rows, and the bid's totals as the Workbench prices them. */
export function priceCardInput<R extends BreakdownCardRow>(args: {
  rows: ReadonlyArray<R>
  marks: RowMarksByRowId
  splitOf: (row: R) => BreakdownCardSplit
  totals: PriceCardTotals
  /** 0.40 for 40%: the bid's own markup, else the company's. */
  markup: number
  laborRate: number | null
  laborRateSource: PriceBreakdownInput['laborRateSource']
}): PriceBreakdownInput {
  const { totals } = args
  return {
    rows: priceCardRows(args.rows, args.marks, args.splitOf),
    materialTotal: totals.totalMaterials,
    hoursTotal: totals.totalLaborHours,
    markup: args.markup,
    taxPercent: totals.taxPercent,
    laborRate: args.laborRate,
    laborRateSource: args.laborRateSource,
    equipmentCost: totals.equipmentRentalCost,
    smallCosts: breakdownSmallCosts(totals),
  }
}

/** The Kind card's rows: each row's cost and price under its kind. */
export function kindCardRows(rows: ReadonlyArray<BreakdownCardRow>, marks: RowMarksByRowId): CompositionRowInput[] {
  return rows.map((r) => ({ id: r.countRow.id, name: nameOf(r), count: r.count, cost: r.cost, revenue: r.effRevenue, kind: kindOf(r, marks) }))
}

/**
 * The Tag card's rows: each row's cost and price under its tags, with its material at cost and as
 * sold for the tag's weighted markup. A row whose split has no material adds no material cost.
 */
export function tagCardRows<R extends BreakdownCardRow>(rows: ReadonlyArray<R>, marks: RowMarksByRowId, splitOf: (row: R) => BreakdownCardSplit): CompositionRowInput[] {
  return rows.map((r) => {
    const s = splitOf(r)
    return {
      id: r.countRow.id,
      name: nameOf(r),
      count: r.count,
      cost: r.cost,
      revenue: r.effRevenue,
      tags: marks[r.countRow.id]?.tags ?? [],
      materialCost: s.materialSource === 'none' ? 0 : r.materialsBeforeTax,
      materialPrice: s.material,
    }
  })
}
