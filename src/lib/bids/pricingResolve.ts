/**
 * Resolve lifecycle for the Pricing tab's per-bid data load (v2.2367).
 *
 * Jumping straight to Pricing (the board's price-tag link) renders the tab before
 * `bid_versions` / pricing copies arrive. Without a tracked lifecycle the strip claims
 * the bid is unsplit ("one packet") and the Workbench shows its permanent
 * "set those up, then come back" empty state — which reads as deleted work. These
 * helpers give the surfaces a third answer: "still loading" (and "load failed").
 */
export type PricingResolveStatus = 'idle' | 'loading' | 'ready' | 'error'

export type PricingResolveState = {
  /** The bid the status talks about; null until a resolve has started. */
  bidId: string | null
  status: PricingResolveStatus
}

export const IDLE_PRICING_RESOLVE: PricingResolveState = { bidId: null, status: 'idle' }

export function beginPricingResolve(bidId: string): PricingResolveState {
  return { bidId, status: 'loading' }
}

/**
 * Settle the in-flight resolve for `bidId`. A settle for a different bid (an aborted
 * load finishing late after the user moved on) leaves the state untouched, and an
 * already-settled matching state is returned as-is so React sees no change.
 */
export function settlePricingResolve(state: PricingResolveState, bidId: string, ok: boolean): PricingResolveState {
  if (state.bidId !== bidId) return state
  const status = ok ? 'ready' : 'error'
  if (state.status === status) return state
  return { bidId, status }
}

export type PricingResolvePanel = 'skeleton' | 'error' | 'content'

/**
 * What the Pricing surfaces render for the bid on screen. `skeleton` also covers the
 * first paint after a bid/tab switch, before the resolve effect has run — the state
 * still points at the previous bid (or is idle) while the arrays are already empty,
 * exactly the frame that used to flash the empty state.
 */
export function pricingResolvePanel(state: PricingResolveState, bidId: string | null): PricingResolvePanel {
  if (!bidId) return 'content'
  if (state.bidId !== bidId) return 'skeleton'
  if (state.status === 'loading' || state.status === 'idle') return 'skeleton'
  if (state.status === 'error') return 'error'
  return 'content'
}
