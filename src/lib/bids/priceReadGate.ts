/**
 * Bids → Pricing: which read of a price's prices may write the screen (v2.5669, Grace's report).
 *
 * The Workbench reads the open price's book (`price_book_entries`) and its rows (assignments,
 * custom prices, hides) many ways: the card click, the resolve effect, and every price write's own
 * reload. Those reads finish in any order. Before this, the last one to land won — so the reload of
 * the price you just LEFT (a typed price saves on blur, and clicking another card is the blur) wrote
 * that price's rows over the one now open, and the open card read "No prices yet" until you came back.
 *
 * The rule: number every read, and let a read write only if it is the newest read of ITS price and
 * that price is the one on screen when it lands. Reads of other prices are dropped; an older read of
 * the open price never overwrites a newer one.
 */
export type PriceReadGate = {
  /** Start a read of `pricingId`'s prices; returns its ticket. */
  begin(pricingId: string): number
  /** Whether the read with `ticket` may write, now that it has landed. */
  mayWrite(pricingId: string, ticket: number, onScreenPricingId: string | null): boolean
}

export function createPriceReadGate(): PriceReadGate {
  let last = 0
  const newestByPricing = new Map<string, number>()
  return {
    begin(pricingId) {
      last += 1
      newestByPricing.set(pricingId, last)
      return last
    },
    mayWrite(pricingId, ticket, onScreenPricingId) {
      return pricingId === onScreenPricingId && newestByPricing.get(pricingId) === ticket
    },
  }
}

/**
 * Whether the prices on screen are the open price's own: its book and its rows have both landed.
 * Until then the Workbench is still loading, and the open card must not read as "No prices yet" —
 * the rows still in state belong to the price you left, and the pricing kernel skips them.
 */
export function openPricePricesReady(args: {
  selectedPricingVersionId: string | null
  entriesReadFor: string | null
  rowsReadFor: string | null
}): boolean {
  const { selectedPricingVersionId: open } = args
  return open != null && args.entriesReadFor === open && args.rowsReadFor === open
}
