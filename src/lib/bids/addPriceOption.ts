/**
 * Bids → Pricing, ＋ Add price → Another price for this GC: what the name window is given
 * (decomposition queue row 1). The window is `AddPriceOptionWindow`; the tab keeps what is typed
 * and creates the price.
 */

/** What the window holds while it is open. */
export type AddPriceOptionValue = { name: string; fromId: string | null; offer: boolean }

/** A price the new one can start from. `isBase` is the price the GC's letter is built on. */
export type AddPriceOptionChoice = { id: string; name: string; isBase: boolean }

/**
 * The prices on the version on screen, in the order they were loaded: a version's own prices, or
 * on an unsplit bid the prices with no version.
 */
export function priceOptionsOnVersion(
  priceBookVersions: ReadonlyArray<{ id: string; name: string; bid_version_id: string | null }>,
  selectedBidVersionId: string | null,
  customerFacingPricingId: string | null,
): AddPriceOptionChoice[] {
  return priceBookVersions
    .filter((p) => (selectedBidVersionId ? p.bid_version_id === selectedBidVersionId : p.bid_version_id == null))
    .map((p) => ({ id: p.id, name: p.name, isBase: p.id === customerFacingPricingId }))
}

/** The name a price takes when its box is left empty: Alternate 1 beside one price, Alternate 2 beside two. */
export function defaultPriceOptionName(pricesOnVersion: number): string {
  return `Alternate ${Math.max(1, pricesOnVersion)}`
}
