/**
 * What the price is made of (punch list #128): the ★ price taken apart into material, sales
 * tax, equipment and labor, in three columns — what each costs us, what the price carries for
 * it, and the profit between them. The columns add to the Workbench strip's cost and revenue.
 *
 *   Material      cost = the takeoff's part lines at the catalog's price (equipment rows aside)
 *                 price = cost × (1 + the material markup)        ← the company number, per-bid override
 *   Sales tax     cost = material × the rate; the price carries it through, no profit
 *   Equipment     cost = the Labor tab's Equipment & Tool Rental rows
 *                 price = the rows tagged Equipment at their price; none tagged → the cost
 *   Labor         cost = hours × the rate (null with no hours or no rate — "Labor and margin")
 *                 price = what is left of the price (Wendi's rule)
 *   Small costs   driving, travel, permits, subs, waste, other at cost; the price carries them
 *                 inside labor, so labor's profit is net of them
 *
 * Pure. The strip's profit = Σ line profit, exactly.
 */

export type PriceBreakdownRowInput = {
  id: string
  name: string
  count: number
  /** count × the effective unit price (the strip's revenue for the row). */
  revenue: number
  /** The row's takeoff material before tax. */
  materialsBeforeTax: number
  /** The row's hours on the Labor tab (hours per unit × count); 0 when none. */
  hours: number
  isEquipment: boolean
  /** The row's own split (the owner's call): when every row has one, the Price column is their sum. */
  split?: { material: number; tax: number; equipment: number; labor: number } | null
}

export type PriceBreakdownInput = {
  rows: ReadonlyArray<PriceBreakdownRowInput>
  /** The bid's material total as the Workbench prices it (`computeBidCostBreakdown`'s totalMaterials); the rows' sum when null. */
  materialTotal?: number | null
  /** The bid's labor hours as the Workbench costs them (`computeBidCostBreakdown`'s totalLaborHours, every Labor row once); the rows' sum when null — two count rows matching one labor row would count it twice. */
  hoursTotal?: number | null
  /** 0.40 for 40%. */
  markup: number
  /** 8.25 for 8.25%. */
  taxPercent: number
  /** The rate the bid is costed at; null when none (no typed rate and no crew rate). */
  laborRate: number | null
  laborRateSource: 'override' | 'company' | 'none'
  /** The Labor tab's Equipment & Tool Rental total. */
  equipmentCost: number
  /** Driving + travel + permits + subs + waste + other, at cost. */
  smallCosts: number
}

export type PriceLineKey = 'material' | 'tax' | 'equipment' | 'labor' | 'small'

export type PriceLine = {
  key: PriceLineKey
  name: string
  rule: string
  cost: number | null
  price: number | null
  profit: number | null
  /** profit ÷ price; null where either is missing or the line passes through. */
  margin: number | null
}

export type PriceBreakdown = {
  lines: PriceLine[]
  /** Σ material sold ÷ Σ material cost − 1 over the rows: the markup the bid is really at; null with no material. */
  weightedMarkup: number | null
  price: number
  cost: number
  /** null while labor has no cost (the amber state). */
  profit: number | null
  margin: number | null
  hours: number
  /** Labor's cost is a number only when hours and a rate exist. */
  laborCosted: boolean
  equipmentRows: number
  /** Rows with hours on the Labor tab, for the "the book knows N of these" line. */
  rowsWithHours: number
  rowsTotal: number
}

const n0 = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function buildPriceBreakdown(input: PriceBreakdownInput): PriceBreakdown {
  const rows = input.rows
  const price = rows.reduce((s, r) => s + n0(r.revenue), 0)
  const equipmentRows = rows.filter((r) => r.isEquipment)
  const rowsMaterial = rows.reduce((s, r) => s + (r.isEquipment ? 0 : n0(r.materialsBeforeTax)), 0)
  const equipmentMaterial = equipmentRows.reduce((s, r) => s + n0(r.materialsBeforeTax), 0)
  // The bid-level total is what Pricing sees (unassigned part lines included); the equipment rows' own lines leave it.
  const materialCost = input.materialTotal != null && input.materialTotal > 0 ? Math.max(input.materialTotal - equipmentMaterial, 0) : rowsMaterial
  const markup = Number.isFinite(input.markup) && input.markup >= 0 ? input.markup : 0
  const splits = rows.every((r) => r.split != null) && rows.length > 0 ? rows.map((r) => r.split as NonNullable<PriceBreakdownRowInput['split']>) : null
  const materialPrice = splits ? splits.reduce((s, x) => s + x.material, 0) : materialCost * (1 + markup)
  const taxPct = Number.isFinite(input.taxPercent) && input.taxPercent >= 0 ? input.taxPercent : 0
  // The tax we pay is on what we buy; the tax the price carries is on the material as sold (the rows' Tax cells).
  const taxCost = materialCost * (taxPct / 100)
  const tax = splits ? splits.reduce((s, x) => s + x.tax, 0) : taxCost
  const equipmentCost = n0(input.equipmentCost)
  const equipmentPrice = splits ? splits.reduce((s, x) => s + x.equipment, 0) : equipmentRows.length > 0 ? equipmentRows.reduce((s, r) => s + n0(r.revenue), 0) : equipmentCost
  const hours = input.hoursTotal != null ? n0(input.hoursTotal) : rows.reduce((s, r) => s + n0(r.hours), 0)
  const rate = input.laborRate != null && input.laborRate > 0 ? input.laborRate : null
  const laborCosted = hours > 0 && rate != null
  const laborCost = laborCosted ? hours * (rate as number) : null
  const laborPrice = splits ? splits.reduce((s, x) => s + x.labor, 0) : price - materialPrice - tax - equipmentPrice
  const small = n0(input.smallCosts)
  const cost = materialCost + taxCost + equipmentCost + (laborCost ?? 0) + small
  const profit = laborCosted ? price - cost : null
  const pctWords = (x: number) => `${Math.round(x * 1000) / 10}%`
  const rateWords = rate == null ? '' : `$${rate.toFixed(2)} ${input.laborRateSource === 'company' ? 'crew rate' : 'typed rate'}`
  const lines: PriceLine[] = [
    {
      key: 'material',
      name: 'Material',
      rule: splits ? `the takeoff · the rows' Material cells` : `the takeoff · sold at +${pctWords(markup)}`,
      cost: materialCost,
      price: materialPrice,
      profit: materialPrice - materialCost,
      margin: materialPrice > 0 ? (materialPrice - materialCost) / materialPrice : null,
    },
    { key: 'tax', name: 'Sales tax', rule: splits ? `${taxPct}% · paid on what we buy, carried on the material as sold` : `${taxPct}% on material · passed through`, cost: taxCost, price: tax, profit: tax - taxCost, margin: null },
    {
      key: 'equipment',
      name: 'Equipment',
      rule: splits
        ? `the Labor tab's rentals · ${equipmentRows.length} equipment row${equipmentRows.length === 1 ? '' : 's'}`
        : equipmentRows.length > 0
          ? `the Labor tab's rentals · ${equipmentRows.length} row${equipmentRows.length === 1 ? '' : 's'} tagged Equipment`
          : "the Labor tab's rentals · no row carries them, so the fixtures' prices do",
      cost: equipmentCost,
      price: equipmentPrice,
      profit: equipmentPrice - equipmentCost,
      margin: equipmentPrice > 0 && equipmentRows.length > 0 ? (equipmentPrice - equipmentCost) / equipmentPrice : null,
    },
    {
      key: 'labor',
      name: laborCosted ? 'Labor' : 'Labor and margin',
      rule: laborCosted
        ? `${Math.round(hours).toLocaleString('en-US')} h × ${rateWords} · what is left of each price`
        : hours > 0
          ? 'hours on Labor but no rate, so the two cannot be told apart'
          : 'no hours on Labor, so the two cannot be told apart',
      cost: laborCost,
      price: laborPrice,
      profit: laborCosted ? laborPrice - (laborCost as number) - small : null,
      margin: laborCosted && laborPrice > 0 ? (laborPrice - (laborCost as number) - small) / laborPrice : null,
    },
    { key: 'small', name: 'Driving, travel, permits, subs', rule: 'at cost · inside labor', cost: small, price: null, profit: null, margin: null },
  ]
  return {
    lines,
    weightedMarkup: materialCost > 0 ? materialPrice / materialCost - 1 : null,
    price,
    cost,
    profit,
    margin: profit != null && price > 0 ? profit / price : null,
    hours,
    laborCosted,
    equipmentRows: equipmentRows.length,
    rowsWithHours: rows.filter((r) => n0(r.hours) > 0).length,
    rowsTotal: rows.length,
  }
}

/** The one-line read under the card: "Material earns 28.6% and labor 24.6%." / the under-water warning / the no-hours offer. */
export function priceBreakdownNote(b: PriceBreakdown, args: { laborRate: number | null }): { tone: 'ok' | 'warn'; words: string } {
  const labor = b.lines.find((l) => l.key === 'labor') as PriceLine
  const material = b.lines.find((l) => l.key === 'material') as PriceLine
  const pct = (m: number | null) => (m == null ? '—' : `${Math.round(m * 1000) / 10}%`)
  if (!b.laborCosted) {
    if (b.hours > 0 && args.laborRate == null) return { tone: 'warn', words: `The Labor tab has ${Math.round(b.hours).toLocaleString('en-US')} hours but no rate, and People has no field hours in the last 90 days to make a crew rate. Type a rate on Labor.` }
    const rateWords = args.laborRate != null ? ` at $${args.laborRate.toFixed(2)}` : ''
    return { tone: 'warn', words: `The labor book knows ${b.rowsWithHours} of these ${b.rowsTotal} rows. Open Labor once and the hours fill in from the book${rateWords}; the line then splits into labor and margin.` }
  }
  if (labor.profit != null && labor.profit < 0) {
    return { tone: 'warn', words: `Labor is under water: the price leaves $${labor.price!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for ${Math.round(b.hours).toLocaleString('en-US')} hours that cost $${labor.cost!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} plus the small costs. Either the hours are high, the markup eats the price, or the book's prices are low.` }
  }
  return { tone: 'ok', words: `Material earns ${pct(material.margin)} and labor ${pct(labor.margin)}. The strip's profit is the two plus equipment's, and nothing else.` }
}
