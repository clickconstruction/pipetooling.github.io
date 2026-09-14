/**
 * Order rounding (v2.3407): what the sticks cost on this bid. A takeoff line
 * stores its quantity per fixture and the bid multiplies by the fixture's
 * count, so a part's real footage is a sum across every fixture that uses it.
 * That sum is what a supply house rounds: 105 ft of 3/4" copper at 20 ft
 * sticks is 120 ft, and the bid pays for the 15 ft it will not use.
 *
 * One rule, once per part per bid, read by every surface that multiplies
 * price and quantity — the strip, the pricing engine, the version compare,
 * the row's chip — so the strip can never disagree with Pricing (the takeoff
 * plan's decision 9). The extra is spread back over the fixtures that use the
 * part by their share of its footage, so Pricing's per-fixture rows still add
 * up to the bid. Pure.
 */
import { roughCountMultiplier, sumRoughLinesPreTaxWithCount } from './bidTakeoffHelpers'
import { parseOrderIncrement, roundUpToIncrement, packsFor, type OrderIncrementUnitKey } from '../materials/orderIncrement'

export type RoundingCountRow = { id: string; count: number | string | null | undefined }

export type RoundingLine = {
  countRowId: string
  partId: string | null
  quantity: number
  unitPrice: number
  /** The snapshot the line carries (PR 1); absent / null = the line never rounds. */
  orderIncrement?: number | string | null
  orderIncrementUnit?: string | null
}

export type PartOrderRounding = {
  partId: string
  increment: number
  unit: OrderIncrementUnitKey
  /** Σ quantity × fixture count over the part's lines. */
  needed: number
  ordered: number
  packs: number
  extra: number
  /** The footage-weighted unit price over the part's lines — what the extra is priced at. */
  unitPrice: number
  extraCost: number
  /** Each fixture's slice of `extraCost`, by its share of the part's footage. */
  extraByCountRow: Map<string, number>
}

export type TakeoffOrderRounding = {
  /** Parts with a rule, in first-seen line order; parts with no extra still listed (their rows read 0). */
  parts: PartOrderRounding[]
  byPartId: Map<string, PartOrderRounding>
  /** Parts that actually gained footage. */
  partsRounded: number
  extraCost: number
  extraByCountRow: Map<string, number>
}

const EMPTY: TakeoffOrderRounding = { parts: [], byPartId: new Map(), partsRounded: 0, extraCost: 0, extraByCountRow: new Map() }

export function emptyOrderRounding(): TakeoffOrderRounding {
  return EMPTY
}

/**
 * Group the part lines that carry a rule by part; two lines of one part with
 * different snapshots use the larger increment (the safer buy).
 */
export function summarizeOrderRounding(countRows: ReadonlyArray<RoundingCountRow>, lines: ReadonlyArray<RoundingLine>): TakeoffOrderRounding {
  const countByRowId = new Map<string, number | string | null | undefined>(countRows.map((r) => [r.id, r.count]))
  type Acc = { partId: string; increment: number; unit: OrderIncrementUnitKey; needed: number; cost: number; byRow: Map<string, number> }
  const acc = new Map<string, Acc>()
  for (const l of lines) {
    if (!l.partId) continue
    const rule = parseOrderIncrement({ order_increment: l.orderIncrement, order_increment_unit: l.orderIncrementUnit })
    if (!rule) continue
    const footage = Number(l.quantity) * roughCountMultiplier(countByRowId.get(l.countRowId))
    if (!(footage > 0)) continue
    const a = acc.get(l.partId) ?? { partId: l.partId, increment: rule.increment, unit: rule.unit, needed: 0, cost: 0, byRow: new Map() }
    if (rule.increment > a.increment) {
      a.increment = rule.increment
      a.unit = rule.unit
    }
    a.needed += footage
    a.cost += footage * Number(l.unitPrice)
    a.byRow.set(l.countRowId, (a.byRow.get(l.countRowId) ?? 0) + footage)
    acc.set(l.partId, a)
  }
  if (acc.size === 0) return EMPTY
  const parts: PartOrderRounding[] = []
  const byPartId = new Map<string, PartOrderRounding>()
  const extraByCountRow = new Map<string, number>()
  let extraCost = 0
  let partsRounded = 0
  for (const a of acc.values()) {
    const ordered = roundUpToIncrement(a.needed, a.increment)
    const extra = Math.max(0, ordered - a.needed)
    const unitPrice = a.needed > 0 ? a.cost / a.needed : 0
    const partExtraCost = extra * unitPrice
    const perRow = new Map<string, number>()
    for (const [rowId, footage] of a.byRow) {
      const slice = a.needed > 0 ? (partExtraCost * footage) / a.needed : 0
      perRow.set(rowId, slice)
      if (slice > 0) extraByCountRow.set(rowId, (extraByCountRow.get(rowId) ?? 0) + slice)
    }
    const p: PartOrderRounding = { partId: a.partId, increment: a.increment, unit: a.unit, needed: a.needed, ordered, packs: packsFor(ordered, a.increment), extra, unitPrice, extraCost: partExtraCost, extraByCountRow: perRow }
    parts.push(p)
    byPartId.set(a.partId, p)
    extraCost += partExtraCost
    if (extra > 0) partsRounded += 1
  }
  return { parts, byPartId, partsRounded, extraCost, extraByCountRow }
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/** `105 ft needed on this bid → 120 ft (6 × 20 ft sticks)` — the chip's hover. */
export function orderRoundingHover(p: PartOrderRounding): string {
  const unit = p.unit === 'ft_stick' || p.unit === 'ft_coil' ? 'ft' : ''
  const packWord = p.unit === 'ft_stick' ? 'sticks' : p.unit === 'ft_coil' ? 'coils' : p.unit === 'box' ? 'boxes' : 'bundles'
  const of = (n: number) => `${num(n)}${unit ? ` ${unit}` : ''}`
  if (p.extra <= 0) return `${of(p.needed)} needed on this bid — an exact ${num(p.packs)} × ${of(p.increment)}, nothing extra`
  return `${of(p.needed)} needed on this bid → ${of(p.ordered)} (${num(p.packs)} × ${of(p.increment)} ${packWord}) · +${of(p.extra)} extra`
}

/** The strip tile's hover: `9 parts sold in sticks · $318 extra, included in Materials`. */
export function orderRoundingTitle(r: TakeoffOrderRounding): string {
  if (r.parts.length === 0) return 'No part on this bid carries a Sold in rule'
  const rounded = r.partsRounded
  return `${r.parts.length} part${r.parts.length === 1 ? '' : 's'} sold in packs · ${rounded} round${rounded === 1 ? 's' : ''} up · the extra is included in Materials and spread over the fixtures that use the part`
}

/** A rough line as the table returns it — the four DB-side readers (engine ×2, the Pricing compare) hand these in. */
export type RoughLineDbRow = {
  count_row_id: string | null
  part_id?: string | null
  quantity: number
  unit_price: number
  order_increment?: number | string | null
  order_increment_unit?: string | null
}

/** The rounding over DB-shaped rows; a row with no count row is skipped (it also sums at ×1 in the base total). */
export function summarizeOrderRoundingFromDbRows(rows: ReadonlyArray<RoughLineDbRow>, countByRowId: ReadonlyMap<string, number | string | null | undefined>): TakeoffOrderRounding {
  const countRows: RoundingCountRow[] = [...countByRowId].map(([id, count]) => ({ id, count }))
  const lines: RoundingLine[] = []
  for (const r of rows) {
    if (!r.count_row_id) continue
    lines.push({ countRowId: r.count_row_id, partId: r.part_id ?? null, quantity: Number(r.quantity), unitPrice: Number(r.unit_price), orderIncrement: r.order_increment ?? null, orderIncrementUnit: r.order_increment_unit ?? null })
  }
  return summarizeOrderRounding(countRows, lines)
}

/** The bid's pre-tax materials total WITH the sticks: `sumRoughLinesPreTaxWithCount` plus the rounding's extra. The one number Pricing, the Labor tab and the strip show. */
export function roughMaterialsTotalWithRounding(rows: ReadonlyArray<RoughLineDbRow>, countByRowId: ReadonlyMap<string, number | string | null | undefined>): { base: number; extra: number; total: number; rounding: TakeoffOrderRounding } {
  const base = sumRoughLinesPreTaxWithCount([...rows], countByRowId)
  const rounding = summarizeOrderRoundingFromDbRows(rows, countByRowId)
  return { base, extra: rounding.extraCost, total: base + rounding.extraCost, rounding }
}

export type OrderListRow = { partId: string; name: string; part: PartOrderRounding }

/** The Materials-to-order rows: most expensive rounding first, then the most footage, capped. */
export function orderListRows(r: TakeoffOrderRounding, partNameById: ReadonlyMap<string, string>, cap = 8): { rows: OrderListRow[]; more: number; totalExtra: number } {
  const all = r.parts
    .map((p) => ({ partId: p.partId, name: partNameById.get(p.partId) ?? 'Part', part: p }))
    .sort((a, b) => b.part.extraCost - a.part.extraCost || b.part.needed - a.part.needed || a.name.localeCompare(b.name))
  return { rows: all.slice(0, cap), more: Math.max(0, all.length - cap), totalExtra: r.extraCost }
}
