/**
 * Active-Version selection for a bid. A bid owns zero or more named **Versions** (variants).
 * `bids.selected_bid_version_id` is the remembered active choice. Zero versions = the bid is
 * "unsplit" (its takeoff + pricing are NULL-version-tagged); the active version is then null.
 *
 * Mirrors `pickActivePricing`, but there is no legacy-global passthrough: no versions ⇒ null.
 */
export type VersionForSelection = { id: string; sort_order: number }

export function pickActiveVersion(input: {
  savedVersionId: string | null
  bidVersions: VersionForSelection[]
}): string | null {
  const { savedVersionId, bidVersions } = input
  if (bidVersions.length === 0) return null // unsplit
  if (savedVersionId && bidVersions.some((v) => v.id === savedVersionId)) return savedVersionId
  const sorted = [...bidVersions].sort((a, b) => a.sort_order - b.sort_order)
  return sorted[0]?.id ?? null
}

/**
 * The pricing facet for the active Version. A bid's pricing copies each carry the
 * `bid_version_id` of the Version they belong to.
 *  - Split bid (activeVersionId set): the pricing whose `bid_version_id` matches, else none.
 *  - Unsplit bid (activeVersionId null): an unsplit pricing copy (bid_version_id null) if one
 *    exists, else the lazy legacy fallback (the bid's `selected_price_book_version_id`, which
 *    may point at a global template).
 */
export function deriveActivePricingId(input: {
  activeVersionId: string | null
  bidPricings: { id: string; bid_version_id: string | null }[]
  legacyFallbackPricingId: string | null
}): string | null {
  const { activeVersionId, bidPricings, legacyFallbackPricingId } = input
  if (activeVersionId != null) {
    return bidPricings.find((p) => p.bid_version_id === activeVersionId)?.id ?? null
  }
  const unsplit = bidPricings.find((p) => p.bid_version_id == null)
  return unsplit?.id ?? legacyFallbackPricingId ?? null
}

/**
 * Resolve the active version id from a bid-tagged ref. The takeoff loaders read the active
 * version synchronously from a ref; tagging it with the bid it belongs to lets a reader use
 * the version ONLY when it matches the bid being loaded. A mismatch (the ref is still set for
 * a previously-active bid, before the async resolution effect catches up) returns null = that
 * bid's Base — never another bid's version. For the normal path the ref always matches, so the
 * result is identical to reading the bare version id.
 */
export function resolveTaggedVersion(
  tagged: { bidId: string; versionId: string | null } | null,
  bidId: string,
): string | null {
  return tagged && tagged.bidId === bidId ? tagged.versionId : null
}
