/**
 * A version's ★ (`bid_versions.starred_price_book_version_id`, v2.2117) is one of that version's
 * own prices: the price its GC's letter is built on. The letter has always read it through
 * `starredPricingIdForVersion`, which passes over a saved ★ that belongs to another version and
 * stands the version's first price in. These helpers give the writes and the other readers the
 * same rule (v2.4377).
 *
 * How a foreign ★ got saved: deleting the price open on the Workbench re-picked the lowest
 * sort_order price on the WHOLE bid and saved it as the active version's ★. On BP385 and BP384
 * the stray ★ is exactly that price, owned by the sibling version.
 */
import { planLetterSections, starredPricingIdForVersion, unsplitStarPricingId, type BundlePricing, type BundleVersion } from './coverLetterVersionBundle'

type StarVersion = { id: string; starred_price_book_version_id?: string | null }

/**
 * The ★ of the bid on screen, read the letter's way. A split bid: the active version's own ★,
 * else its first price, else none. An unsplit bid: the saved ★ when it is one of the bid's own
 * prices, else the first of them, else the saved id as it is (a legacy bid priced on a shared book).
 */
export function resolvedStarPricingId(args: {
  activeVersionId: string | null
  bidVersions: ReadonlyArray<StarVersion>
  bidPricings: ReadonlyArray<BundlePricing>
  /** `bids.selected_price_book_version_id`. */
  bidSavedPricingId: string | null
}): string | null {
  const { activeVersionId, bidVersions, bidPricings, bidSavedPricingId } = args
  if (activeVersionId != null) {
    const version = bidVersions.find((v) => v.id === activeVersionId) ?? { id: activeVersionId }
    return starredPricingIdForVersion(version, bidPricings)
  }
  return unsplitStarPricingId(bidPricings, bidSavedPricingId) ?? bidSavedPricingId
}

/**
 * Whether a price may be saved as the ★. On a split bid only one of the active version's own
 * prices may, or none (which clears it): another version's price, an unversioned one and a shared
 * book are refused. An unsplit bid keeps its ★ on the bid row alone, so anything goes there.
 */
export function starWriteAllowed(args: {
  activeVersionId: string | null
  pricingId: string | null
  /** The price's `bid_version_id`, read fresh from the database; undefined when no such price exists. */
  pricingBidVersionId: string | null | undefined
}): boolean {
  if (args.activeVersionId == null || args.pricingId == null) return true
  return args.pricingBidVersionId === args.activeVersionId
}

export const STAR_NOT_OWN_PRICE_MESSAGE = 'That price belongs to another version. Open that version to make it its base.'

/**
 * How many prices each version puts on its GC's letter: the sections `planLetterSections` draws
 * for it with a price — its ★, then each price it offers as an alternate. A version left off the
 * letter, or with no prices yet, puts none. The Send to strip's "gets N prices" sums these.
 */
export function letterPriceCountByVersion(
  versions: ReadonlyArray<BundleVersion>,
  pricings: ReadonlyArray<BundlePricing>,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const section of planLetterSections(versions, pricings)) {
    if (section.pricingId) counts[section.versionId] = (counts[section.versionId] ?? 0) + 1
  }
  return counts
}

/**
 * After the price open on the Workbench is deleted: the price to open next, and the ★ to save
 * (absent = the ★ stays where it is). Deleting never moves a version's ★ — a ★ can't be deleted
 * (v2.2409) — so a split bid opens its version's own ★, never another version's price. An unsplit
 * bid moves its ★ only when the deleted price was the ★ itself.
 */
export function afterOpenPriceDeleted(args: {
  deletedId: string
  /** The version on screen; null for an unsplit bid. */
  activeVersion: StarVersion | null
  /** The bid's prices after the delete. */
  remaining: ReadonlyArray<BundlePricing>
  /** `bids.selected_price_book_version_id`. */
  bidSavedPricingId: string | null
}): { viewId: string | null; saveStarId?: string | null } {
  const { deletedId, activeVersion, remaining, bidSavedPricingId } = args
  if (activeVersion) return { viewId: starredPricingIdForVersion(activeVersion, remaining) }
  if (deletedId === bidSavedPricingId) {
    const next = unsplitStarPricingId(remaining, null)
    return { viewId: next, saveStarId: next }
  }
  return { viewId: unsplitStarPricingId(remaining, bidSavedPricingId) ?? bidSavedPricingId }
}
