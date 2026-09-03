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
 *  - Split bid (activeVersionId set): the bid's saved `selected_price_book_version_id` when it
 *    belongs to this version (the Workbench's ★ customer-facing scenario — without this
 *    preference the star silently reverted to the first scenario on every reload), else the
 *    version's first pricing, else none (no template fallback — a version legitimately may have
 *    no pricing yet).
 *  - Unsplit bid (activeVersionId null): the saved id when it's one of the bid's unsplit pricing
 *    copies, else any unsplit copy, else the saved id as-is (a shared/template pricing), else the
 *    template that actually holds this bid's assignment / custom-price rows (v2.2720 — a bid
 *    priced straight on a shared book before copies existed), else the viewer's default template
 *    (last pick → "Default" → first). That last fallback preserves the long-standing behavior
 *    where bids that never explicitly picked a price book price against "Default" — without it,
 *    those bids show no pricing at all.
 */
export function deriveActivePricingId(input: {
  activeVersionId: string | null
  bidPricings: { id: string; bid_version_id: string | null }[]
  legacyFallbackPricingId: string | null
  /** The shared template whose id this bid's pricing rows actually carry (v2.2720, `pickLegacyDataTemplateId`). */
  legacyDataPricingId?: string | null
  defaultTemplatePricingId?: string | null
  /** The active version's own ★ (`bid_versions.starred_price_book_version_id`, v2.2117) — wins when it belongs to the version. */
  versionStarredPricingId?: string | null
}): string | null {
  const { activeVersionId, bidPricings, legacyFallbackPricingId, legacyDataPricingId, defaultTemplatePricingId, versionStarredPricingId } = input
  if (activeVersionId != null) {
    const versionPricings = bidPricings.filter((p) => p.bid_version_id === activeVersionId)
    const starred = versionStarredPricingId ? versionPricings.find((p) => p.id === versionStarredPricingId) : undefined
    const saved = versionPricings.find((p) => p.id === legacyFallbackPricingId)
    return starred?.id ?? saved?.id ?? versionPricings[0]?.id ?? null
  }
  const unsplitPricings = bidPricings.filter((p) => p.bid_version_id == null)
  const savedUnsplit = unsplitPricings.find((p) => p.id === legacyFallbackPricingId)
  return savedUnsplit?.id ?? unsplitPricings[0]?.id ?? legacyFallbackPricingId ?? legacyDataPricingId ?? defaultTemplatePricingId ?? null
}

/**
 * True when an in-flight Version switch is still the one the user wants.
 *
 * `switchActiveVersion` sets the active version synchronously, then awaits the bid's pricing
 * copies before resolving which pricing facet to show. Switching twice in a row (A → B → A, the
 * "click the other version and click back" the field reported) leaves two of those awaits in
 * flight, and they can finish out of order. The loser must not write: it resolved a pricing facet
 * for the version the user has already left, and {@link deriveActivePricingId} returns null for a
 * split version with no pricing copy — so a stale write lands as "no price book" and *sticks*,
 * because the unsplit-only safety net never re-resolves a split bid.
 */
export function versionSwitchStillActive(
  tagged: { bidId: string; versionId: string | null } | null,
  bidId: string,
  versionId: string | null,
): boolean {
  return tagged != null && tagged.bidId === bidId && tagged.versionId === versionId
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
