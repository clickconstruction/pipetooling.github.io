/**
 * Star-delete guard (v2.2409). Every GC packet (bid_versions row) carries its own
 * ★ customer-facing price scenario in `starred_price_book_version_id` — the Cover
 * Letter, Share, and bid value for that packet are all built on it. Deleting a
 * scenario that is some packet's ★ silently breaks that packet's letter (the FK is
 * ON DELETE SET NULL).
 *
 * The Price modal used to guard Delete by comparing against the VIEWED packet's ★
 * only — but the scenario card row falls back to the bid-wide list when the viewed
 * packet has no scoped scenarios (legacy pointers), so another packet's ★ card
 * could be opened with Delete enabled. That is how BP384's NORTHSTAR ★ was deleted
 * on 2026-08-27. The guard must ask: is this scenario ANY packet's ★?
 */
export type StarHolder = { id: string; starred_price_book_version_id: string | null }

/** The packet whose ★ is built on this scenario, if any — regardless of which packet is being viewed. */
export function versionStarringScenario<T extends StarHolder>(
  bidVersions: T[],
  scenarioId: string | null | undefined,
): T | null {
  if (!scenarioId) return null
  return bidVersions.find((v) => v.starred_price_book_version_id === scenarioId) ?? null
}

/**
 * Whether deleting this scenario would break a customer-facing letter: it is some
 * packet's ★, or (unsplit/legacy bids with no packets) the bid-level ★ fallback.
 */
export function scenarioIsCustomerFacing(input: {
  scenarioId: string
  bidVersions: StarHolder[]
  viewedCustomerFacingId: string | null
}): boolean {
  return (
    versionStarringScenario(input.bidVersions, input.scenarioId) != null ||
    input.scenarioId === input.viewedCustomerFacingId
  )
}

/**
 * Why the Price window's Delete is dead, or null when the price can go. A price some packet's ★
 * is built on, or the viewed packet's customer-facing price, cannot be deleted from the window.
 * The sentence names the other GC when the ★ belongs to a packet that is not on screen.
 */
export function priceDeleteBlock(input: {
  bidVersions: StarHolder[]
  pricingId: string
  customerFacingPricingId: string | null
  selectedBidVersionId: string | null
  gcNameOf: (versionId: string) => string
}): string | null {
  const starringVersion = versionStarringScenario(input.bidVersions, input.pricingId)
  const isBase = starringVersion != null || input.pricingId === input.customerFacingPricingId
  if (!isBase) return null
  return starringVersion && starringVersion.id !== input.selectedBidVersionId
    ? `${input.gcNameOf(starringVersion.id)}'s letter is built on this price — star another price for that packet first.`
    : "The GC's letter is built on this price — make another price the base first."
}
