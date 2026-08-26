/**
 * Pricing Workbench solver (the "New" Pricing view): given the bid's rows and
 * overhead, produce unit prices that hit a target margin or a target total
 * price — spreading revenue across rows in proportion to their cost
 * (overhead allocated pro-rata), holding locked rows, and never pricing
 * uncosted rows (mirrors `applyMarginPricing`'s rule: no cost basis → skip).
 *
 * The two targets scope differently, and the difference is load-bearing:
 * - A TARGET TOTAL is the whole-bid number the estimator typed, so held rows
 *   AND already-priced uncosted rows count toward it — the bid lands AT the
 *   typed number, not that much above it.
 * - A TARGET MARGIN applies to the rows the solver actually prices (costed
 *   rows, overhead loaded in). Revenue hand-set on uncosted rows stacks ON
 *   TOP of the solve instead of being subtracted from its target — otherwise
 *   a bid whose hand-set revenue exceeds the blended target crushes every
 *   costed row to the safety floor: prices below cost and a slider that does
 *   nothing across most of its range (Wendi's 23-no-cost-row bid).
 *
 * Blended margin matches the grid's Total margin: (revenue − totalCost) ÷
 * revenue, where totalCost includes overhead.
 */

export type WorkbenchSolverRow = {
  /** count_row id */
  id: string
  count: number
  /** Row's own cost (labor + materials + tax), NOT including overhead. */
  rowCost: number
  /** Current unit price (null = unpriced). */
  unitPrice: number | null
  /** Held rows keep their current price; the solver prices around them. */
  locked: boolean
}

export type WorkbenchSolveOptions = {
  /**
   * Target margin as a whole percent (1–95) for the rows being priced (costed
   * rows, overhead pro-rata). Hand-set revenue on uncosted rows stacks on top,
   * so the whole bid's blended margin lands at or above this. Ignored when
   * targetTotal set.
   */
  targetMarginPct?: number
  /**
   * Target total revenue in dollars for the WHOLE bid; wins over targetMarginPct.
   * Existing revenue on uncosted rows counts toward it (held, like locked rows),
   * so the bid lands at the number typed rather than that much above it.
   */
  targetTotal?: number
  /** Only fill rows whose unitPrice is null; priced rows are held like locks. */
  onlyUnpriced?: boolean
  /** Round unit prices UP to the next $5 (else round to whole dollars). */
  roundTo5?: boolean
}

export type WorkbenchSolution = {
  /** count_row id → new unit price. Only rows the solver moved. */
  prices: Map<string, number>
  /** Rows skipped for having no cost basis. */
  uncostedIds: string[]
  /** The blended margin the solution lands at (post-rounding), 0–1, or null when revenue is 0. */
  resultingMargin: number | null
  /** Total revenue after applying the solution to the input rows. */
  resultingRevenue: number
  /** Revenue already sitting on uncosted rows (held as-is by the solver). */
  uncostedFixedRevenue: number
}

function roundUnit(price: number, roundTo5: boolean): number {
  const p = roundTo5 ? Math.ceil(price / 5) * 5 : Math.round(price)
  return Math.max(p, 1)
}

export function solveWorkbenchPrices(
  rows: WorkbenchSolverRow[],
  overhead: number,
  opts: WorkbenchSolveOptions,
): WorkbenchSolution | null {
  const fixtureCost = rows.reduce((s, r) => s + (r.rowCost > 0 ? r.rowCost : 0), 0)
  const totalCost = fixtureCost + Math.max(overhead, 0)
  if (fixtureCost <= 0) return null

  let targetRevenue: number
  if (opts.targetTotal != null) {
    if (!Number.isFinite(opts.targetTotal) || opts.targetTotal <= 0) return null
    targetRevenue = opts.targetTotal
  } else {
    const m = opts.targetMarginPct
    if (m == null || !Number.isFinite(m) || m < 1 || m > 95) return null
    targetRevenue = totalCost / (1 - m / 100)
  }

  const uncostedIds = rows.filter((r) => !(r.rowCost > 0)).map((r) => r.id)
  const held = rows.filter(
    (r) => r.rowCost > 0 && (r.locked || (opts.onlyUnpriced === true && r.unitPrice != null)),
  )
  const free = rows.filter((r) => r.rowCost > 0 && !held.includes(r))
  if (free.length === 0) return null

  const heldRevenue = held.reduce((s, r) => s + (r.unitPrice ?? 0) * r.count, 0)
  // Priced uncosted rows are never re-solved but their revenue is part of the
  // bid total, so it must come out of the target too — else the bid overshoots
  // by exactly that amount (target 150k landing at 240k on no-cost-row-heavy bids).
  const uncostedFixedRevenue = rows.reduce(
    (s, r) => s + (!(r.rowCost > 0) && r.unitPrice != null ? r.unitPrice * r.count : 0),
    0,
  )
  // Pro-rata overhead rides each row's cost basis so a solved-alone subset
  // still carries its share of the bid's overhead.
  const basisOf = (r: WorkbenchSolverRow) => r.rowCost * (1 + (fixtureCost > 0 ? Math.max(overhead, 0) / fixtureCost : 0))
  const freeBasis = free.reduce((s, r) => s + basisOf(r), 0)
  // Margin solves leave the uncosted revenue out of the subtraction — it
  // stacks on top of the solve (see header). Only a typed target total is a
  // whole-bid number that the hand-set revenue must count toward.
  const fixedTowardTarget = opts.targetTotal != null ? uncostedFixedRevenue : 0
  // Never solve below 20% of the free rows' basis — a floor against absurd
  // targets (e.g. target total less than held revenue).
  const needed = Math.max(targetRevenue - heldRevenue - fixedTowardTarget, freeBasis * 0.2)
  const k = needed / freeBasis

  const prices = new Map<string, number>()
  for (const r of free) {
    const unit = roundUnit((basisOf(r) * k) / r.count, opts.roundTo5 === true)
    prices.set(r.id, unit)
  }

  let resultingRevenue = held.reduce((s, r) => s + (r.unitPrice ?? 0) * r.count, 0)
  for (const r of rows) {
    if (prices.has(r.id)) resultingRevenue += (prices.get(r.id) ?? 0) * r.count
    else if (!held.includes(r) && r.unitPrice != null && r.rowCost > 0) resultingRevenue += r.unitPrice * r.count
    else if (uncostedIds.includes(r.id) && r.unitPrice != null) resultingRevenue += r.unitPrice * r.count
  }
  const resultingMargin = resultingRevenue > 0 ? (resultingRevenue - totalCost) / resultingRevenue : null

  return { prices, uncostedIds, resultingMargin, resultingRevenue, uncostedFixedRevenue }
}

export type ProfitSegment = { id: string; label: string; profit: number; share: number }

/** Profit-by-row segments (positive profit only), sorted desc, with top-2 concentration share. */
export function profitConcentration(
  rows: Array<{ id: string; label: string; count: number; rowCost: number; unitPrice: number | null }>,
): { segments: ProfitSegment[]; top2Share: number | null; totalProfit: number } {
  const parts = rows
    .map((r) => ({ id: r.id, label: r.label, profit: r.unitPrice != null ? (r.unitPrice * r.count - r.rowCost) : 0 }))
    .filter((p) => p.profit > 0)
    .sort((a, b) => b.profit - a.profit)
  const totalProfit = parts.reduce((s, p) => s + p.profit, 0)
  const segments = parts.map((p) => ({ ...p, share: totalProfit > 0 ? p.profit / totalProfit : 0 }))
  const top2Share = totalProfit > 0 ? segments.slice(0, 2).reduce((s, p) => s + p.share, 0) : null
  return { segments, top2Share, totalProfit }
}
