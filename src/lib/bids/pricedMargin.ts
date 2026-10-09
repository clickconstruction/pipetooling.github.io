/**
 * The margin a bid was priced at (Burn against the bid, piece 1, v2.5043 — the owner's call of
 * 2026-10-09). The Pricing workbench's strip shows it, (revenue − our cost) ÷ revenue, and since
 * v2.5043 the workbench stamps it on the bid when its own price writes land (`bids.priced_*`, through
 * `stamp_bid_priced_margin`). The stamp freezes once the bid is sent: the margin it went out at.
 * The job's Costs verdict and Bids → Bid Costs → Bid vs actual read it beside the job's burn.
 *
 * Pure: the stamp's inputs off the strip's rows, the gate that says whether a screen may stamp,
 * the row read back, and the words every surface uses.
 */

export type BidPricedMargin = {
  /** 0–100, two decimals, as the server computed it. */
  pct: number
  revenueUsd: number
  costUsd: number
  /** Revenue on priced rows with no cost: the margin counts it as profit, so above 0 reads high. */
  uncostedUsd: number
  /** No labor rate means labor is $0 in the cost, so the margin reads high. */
  rateSet: boolean
  bidVersionId: string | null
  at: string | null
}

export type PricedMarginStampInput = { revenueUsd: number; costUsd: number; uncostedUsd: number; rateSet: boolean }

const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * The strip's numbers over SAVED prices only: a pending solve or a price mid-typing is not a price
 * yet. Revenue is every row's saved price × count (alternates included, as the strip adds them);
 * our cost is the workbench's total cost. Null with no priced revenue.
 */
export function pricedMarginStampInput(args: {
  rows: ReadonlyArray<{ unitPrice: number | null | undefined; count: number }>
  totalCost: number
  uncostedRevenue: number
  laborRate: number | null | undefined
}): PricedMarginStampInput | null {
  const revenue = args.rows.reduce((s, r) => s + (r.unitPrice != null && r.unitPrice > 0 && Number.isFinite(r.count) ? r.unitPrice * r.count : 0), 0)
  if (!(revenue > 0)) return null
  return {
    revenueUsd: round2(revenue),
    costUsd: round2(Math.max(0, Number(args.totalCost) || 0)),
    uncostedUsd: round2(Math.max(0, Number(args.uncostedRevenue) || 0)),
    rateSet: Number(args.laborRate) > 0,
  }
}

/** The margin the inputs give, 0–100 to two decimals: the server's arithmetic. */
export function pricedMarginPct(i: PricedMarginStampInput): number {
  return round2(((i.revenueUsd - i.costUsd) / i.revenueUsd) * 100)
}

/**
 * Whether this screen may stamp the bid: it is not sent yet, and the workbench is on the price the
 * customer sees (the ★ pricing) of the bid's own GC, not another GC's version and not an add-on
 * alternate. A bid with no versions prices its unsplit base, which is its own.
 */
export function mayStampPricedMargin(args: {
  bidDateSent: string | null | undefined
  viewingPricingId: string | null | undefined
  customerFacingPricingId: string | null | undefined
  bidVersion: { customer_id?: string | null; is_alternate?: boolean | null } | null | undefined
}): boolean {
  if (args.bidDateSent) return false
  if (!args.viewingPricingId || args.viewingPricingId !== args.customerFacingPricingId) return false
  if (args.bidVersion && (args.bidVersion.customer_id || args.bidVersion.is_alternate)) return false
  return true
}

/**
 * What the Pricing tab has on screen for the stamp (refreshed every commit): the strip's numbers over
 * saved prices and whether this screen may stamp. Null with no bid open; `input` null while the
 * workbench cannot derive (no counts, pricing or cost estimate yet).
 */
export function pricedMarginStampOnScreen(args: {
  bid: { id: string; bid_date_sent?: string | null } | null | undefined
  derived: { rows: ReadonlyArray<{ unitPrice: number | null | undefined; count: number }>; totalCost: number; uncostedRevenue: number; rate: number | null | undefined } | null
  selectedBidVersionId: string | null | undefined
  bidVersions: ReadonlyArray<{ id: string; customer_id?: string | null; is_alternate?: boolean | null }>
  viewingPricingId: string | null | undefined
  customerFacingPricingId: string | null | undefined
}): { bidId: string; bidVersionId: string | null; input: PricedMarginStampInput | null; mayStamp: boolean } | null {
  const bid = args.bid
  if (!bid) return null
  const d = args.derived
  const versionId = args.selectedBidVersionId ?? null
  const version = versionId ? (args.bidVersions.find((v) => v.id === versionId) ?? null) : null
  return {
    bidId: bid.id,
    bidVersionId: versionId,
    input: d ? pricedMarginStampInput({ rows: d.rows, totalCost: d.totalCost, uncostedRevenue: d.uncostedRevenue, laborRate: d.rate }) : null,
    mayStamp: mayStampPricedMargin({ bidDateSent: bid.bid_date_sent ?? null, viewingPricingId: args.viewingPricingId, customerFacingPricingId: args.customerFacingPricingId, bidVersion: version }),
  }
}

/** A stamp worth writing: the inputs or the version differ from the bid's last stamp, to the cent. */
export function pricedMarginStampDiffers(prev: BidPricedMargin | null, next: PricedMarginStampInput, nextVersionId: string | null): boolean {
  if (!prev) return true
  return (
    round2(prev.revenueUsd) !== next.revenueUsd ||
    round2(prev.costUsd) !== next.costUsd ||
    round2(prev.uncostedUsd) !== next.uncostedUsd ||
    prev.rateSet !== next.rateSet ||
    (prev.bidVersionId ?? null) !== (nextVersionId ?? null)
  )
}

/** A `bids` row's `priced_*` columns → the stamp; null when the bid carries none. */
export function parseBidPricedMargin(row: Record<string, unknown> | null | undefined): BidPricedMargin | null {
  if (!row) return null
  const pct = num(row.priced_margin_pct)
  const revenue = num(row.priced_revenue_usd)
  if (pct == null || revenue == null || revenue <= 0) return null
  return {
    pct,
    revenueUsd: revenue,
    costUsd: num(row.priced_cost_usd) ?? 0,
    uncostedUsd: num(row.priced_uncosted_usd) ?? 0,
    rateSet: row.priced_rate_set === true,
    bidVersionId: typeof row.priced_bid_version_id === 'string' ? row.priced_bid_version_id : null,
    at: typeof row.priced_at === 'string' ? row.priced_at : null,
  }
}

const usd0 = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

/** "31%" — whole points, as the strip shows it. */
export function pricedMarginPctWords(m: Pick<BidPricedMargin, 'pct'>): string {
  return `${Math.round(m.pct)}%`
}

/** What makes a stamp read high, in the order to fix it: no labor rate, then revenue on rows with no cost. */
export function pricedMarginPartialWords(m: Pick<BidPricedMargin, 'rateSet' | 'uncostedUsd'>): string[] {
  const out: string[] = []
  if (!m.rateSet) out.push('no labor rate')
  if (m.uncostedUsd >= 0.5) out.push(`${usd0(m.uncostedUsd)} on rows with no cost`)
  return out
}

/** "$33,600 cost on $48,700 · no labor rate" — the inputs behind the margin, and why it may read high. */
export function pricedMarginDetailWords(m: BidPricedMargin): string {
  return [`${usd0(m.costUsd)} cost on ${usd0(m.revenueUsd)}`, ...pricedMarginPartialWords(m)].join(' · ')
}

/**
 * The job's direct margin at completion beside the margin the bid was priced at, in points:
 * "3 pts under the price" / "2 pts over the price" / "on the price". Null without both.
 */
export function pricedVsDirectWords(directMarginPct: number | null | undefined, priced: Pick<BidPricedMargin, 'pct'> | null | undefined): string | null {
  if (directMarginPct == null || !Number.isFinite(directMarginPct) || !priced) return null
  const pts = Math.round(directMarginPct) - Math.round(priced.pct)
  if (pts === 0) return 'on the price'
  return `${Math.abs(pts)} ${Math.abs(pts) === 1 ? 'pt' : 'pts'} ${pts < 0 ? 'under' : 'over'} the price`
}
