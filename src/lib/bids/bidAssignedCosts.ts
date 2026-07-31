/**
 * Real (actual) cost assigned to a bid, from the bid-side cost mirrors added in
 * v2.1165 — the rows that land there when a job's costs are migrated onto a bid.
 *
 * Kept as a pure kernel because the arithmetic is the part worth testing: the
 * Bid Costs tab only renders what this returns. Every numeric arrives from
 * PostgREST as a string (numeric columns serialise as text), so each is coerced
 * rather than trusted.
 *
 * Team labor is NOT summed here — it already has its own loader
 * (`loadTeamLaborDataForBids`) and has been on the Bid Costs tab since long
 * before the mirrors existed. {@link bidRealCostTotal} combines the two.
 */

/** Numeric columns come back from PostgREST as strings; nulls are real. */
function num(v: number | string | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export type BidPartRow = { bid_id: string; quantity: number | string | null; fixture_cost: number | string | null }
export type BidMaterialRow = { bid_id: string; amount: number | string | null }
/** `pct` of the invoice's own `amount` — same shape the job side uses. */
export type BidSupplyAllocRow = { bid_id: string; pct: number | string | null; invoice_amount: number | string | null }
export type BidMercuryAllocRow = { bid_id: string; amount: number | string | null }

export type BidAssignedCostRows = {
  parts: BidPartRow[]
  materials: BidMaterialRow[]
  supply: BidSupplyAllocRow[]
  mercury: BidMercuryAllocRow[]
}

export type BidAssignedCosts = {
  /** Parts-style: tally parts (quantity x fixture cost), card charges and supply splits. */
  partsStyle: number
  /** Billed materials line items. */
  materials: number
  /** partsStyle + materials — everything this kernel knows about. */
  total: number
}

const EMPTY: BidAssignedCosts = { partsStyle: 0, materials: 0, total: 0 }

/** Zeroed costs, for bids with nothing assigned. */
export function emptyBidAssignedCosts(): BidAssignedCosts {
  return { ...EMPTY }
}

/**
 * Fold the four mirror tables into per-bid totals.
 *
 * Parts-style deliberately groups tally parts, Mercury card charges and
 * supply-house splits together, matching how the Edit Job migrate modal already
 * labels them ("Parts, card charges & supply invoices") — one vocabulary across
 * both sides of the move.
 */
export function bidAssignedCostsByBidId(rows: Partial<BidAssignedCostRows>): Map<string, BidAssignedCosts> {
  const out = new Map<string, BidAssignedCosts>()
  const bump = (bidId: string, key: 'partsStyle' | 'materials', amount: number) => {
    if (!bidId || !Number.isFinite(amount) || amount === 0) return
    const cur = out.get(bidId) ?? emptyBidAssignedCosts()
    cur[key] += amount
    cur.total = cur.partsStyle + cur.materials
    out.set(bidId, cur)
  }

  for (const p of rows.parts ?? []) bump(p.bid_id, 'partsStyle', num(p.quantity) * num(p.fixture_cost))
  for (const m of rows.mercury ?? []) bump(m.bid_id, 'partsStyle', num(m.amount))
  for (const s of rows.supply ?? []) bump(s.bid_id, 'partsStyle', (num(s.pct) / 100) * num(s.invoice_amount))
  for (const m of rows.materials ?? []) bump(m.bid_id, 'materials', num(m.amount))

  return out
}

/**
 * A bid's full real cost: clocked team labor plus everything assigned to it.
 * `laborCost` comes from `TeamLaborBidRow.bidCost`.
 */
export function bidRealCostTotal(assigned: BidAssignedCosts | undefined, laborCost: number | null | undefined): number {
  return num(laborCost) + (assigned?.total ?? 0)
}
