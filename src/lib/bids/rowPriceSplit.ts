/**
 * A row's price, split line by line (punch list #128, the owner's calls of 2026-10-19): a
 * fixture's row carries its own Material · Tax · Labor, adding to the row's price. Equipment
 * is not a part of a fixture: it is its own item — a row whose kind is Equipment (a lift, a
 * trencher, shoring), the price all equipment — the group the Labor tab's Equipment & Tool
 * Rental direct costs stand behind.
 *
 *   material   typed, else the row's takeoff material × (1 + the markup): the row's own when it
 *              has one, else the bid's; 0 on an Equipment row
 *   tax        the bid's rate on material while the row is taxable (typed, else: taxable when
 *              it has material)
 *   equipment  the whole price on an Equipment row, else 0 — never typed on a fixture
 *   labor      what is left of the price — never typed, so a row always adds up; below zero it
 *              reads red and the card says so
 *
 * The bid's card is the sum of the rows. Pure.
 */
import { formatCurrency } from '../format'
import type { RowKind } from './rowKinds'

export type RowSplitTyped = {
  /** Dollars for the row (not per unit). null = the default. */
  material?: number | null
  /** The row's own markup, 0.60 for 60%; null = the bid's. */
  markup?: number | null
  taxable?: boolean | null
}

export type RowSplitInput = {
  price: number
  /** The row's takeoff material before tax and markup, for the whole row. */
  materialCost: number
  /** 0.40 for 40%. */
  markup: number
  /** 8.25 for 8.25%. */
  taxPercent: number
  kind: RowKind
  typed?: RowSplitTyped | null
}

export type RowSplit = {
  material: number
  tax: number
  equipment: number
  labor: number
  taxable: boolean
  materialSource: 'typed' | 'takeoff' | 'none'
  equipmentSource: 'kind' | 'none'
  /** The markup the material was sold at (the row's own or the bid's), 0.60 for 60%. */
  markup: number
  markupSource: 'row' | 'bid'
}

const n0 = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function rowPriceSplit(input: RowSplitInput): RowSplit {
  const price = n0(input.price)
  const typed = input.typed ?? {}
  const bidMarkup = Number.isFinite(input.markup) && input.markup >= 0 ? input.markup : 0
  const rowMarkup = typed.markup != null && Number.isFinite(typed.markup) && typed.markup >= 0 ? typed.markup : null
  const markup = rowMarkup ?? bidMarkup
  let material: number
  let materialSource: RowSplit['materialSource']
  if (typed.material != null && Number.isFinite(typed.material) && typed.material >= 0) {
    material = typed.material
    materialSource = 'typed'
  } else if (input.kind === 'equipment') {
    material = 0
    materialSource = 'none'
  } else {
    material = n0(input.materialCost) * (1 + markup)
    materialSource = material > 0 ? 'takeoff' : 'none'
  }
  const taxable = typed.taxable ?? material > 0
  const taxPct = Number.isFinite(input.taxPercent) && input.taxPercent >= 0 ? input.taxPercent : 0
  const tax = taxable ? material * (taxPct / 100) : 0
  const equipment = input.kind === 'equipment' ? Math.max(price - material - tax, 0) : 0
  const equipmentSource: RowSplit['equipmentSource'] = input.kind === 'equipment' ? 'kind' : 'none'
  const labor = price - material - tax - equipment
  return { material, tax, equipment, labor, taxable, materialSource, equipmentSource, markup, markupSource: rowMarkup != null ? 'row' : 'bid' }
}

export type RowSplitSum = { material: number; tax: number; equipment: number; labor: number; rowsUnderWater: number; rowsTyped: number }

export function sumRowSplits(splits: ReadonlyArray<Pick<RowSplit, 'material' | 'tax' | 'equipment' | 'labor' | 'materialSource' | 'equipmentSource'>>): RowSplitSum {
  const out: RowSplitSum = { material: 0, tax: 0, equipment: 0, labor: 0, rowsUnderWater: 0, rowsTyped: 0 }
  for (const s of splits) {
    out.material += s.material
    out.tax += s.tax
    out.equipment += s.equipment
    out.labor += s.labor
    if (s.labor < -0.005) out.rowsUnderWater++
    if (s.materialSource === 'typed') out.rowsTyped++
  }
  return out
}

/** A figure as the screen shows it, in whole cents: the rounding `formatCurrency` does, and no other. */
function shownCents(v: number): number {
  if (!Number.isFinite(v)) return 0
  const cents = Math.round(Number(formatCurrency(Math.abs(v)).replace(/,/g, '')) * 100)
  return v < 0 ? -cents : cents
}

/**
 * The labor line as the screen shows it (finding 346): what is left of the row's figure once the other lines are
 * shown. Labor is already what is left of the price, so a row always adds up. Each line is rounded to the cent by
 * itself for the screen, though, and three rounded lines need not add to the rounded row: at 2,584.87 a unit plus
 * 50%, material is a third of a cent off, and the three lines read a cent over or under. So the labor line reads
 * the row's own figure as the screen rounds it, less the other lines as the screen rounds them. The three then add
 * to the row to the cent, and no line a person can type changes.
 *
 * It is for the screen alone. The split itself, the three cards' sums and every saved number stay as they were.
 */
export function laborLeftToTheCent(rowFigure: number, otherLines: ReadonlyArray<number>): number {
  return (shownCents(rowFigure) - otherLines.reduce((sum, line) => sum + shownCents(line), 0)) / 100
}

/** Under a row with no price, in place of its split's lines. It is a note on the row, not an empty list. */
export const SPLIT_NO_PRICE_WORDS = 'No price on this row yet, so nothing to split.'

/** "$1,234.56" → 1234.56; blank or garbage → null (the default). */
export function parseSplitDollars(raw: string): number | null {
  const s = (raw ?? '').replace(/[$,\s]/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}
