/**
 * Cover Letter (New view, v2.2117): the letter bundles BID VERSIONS — each at its customer-facing
 * ★ price scenario — never price scenarios themselves. Pure helpers; no React, no DB.
 *
 * Vocabulary: a *version* (`bid_versions`) is a bid the customer can receive; a *scenario*
 * (`price_book_versions` scoped to a bid) is a price point for you to compare. Only one scenario
 * per version is ever customer-facing: its ★.
 */

export type BundleVersion = {
  id: string
  name: string
  sort_order: number
  include_in_submission: boolean
  is_alternate?: boolean | null
  starred_price_book_version_id?: string | null
  customer_id?: string | null
}

export type BundlePricing = {
  id: string
  bid_version_id: string | null
  sort_order: number
  created_at?: string | null
}

/**
 * The ★ scenario for a version: its saved `starred_price_book_version_id` when that scenario still
 * belongs to the version, else the version's first scenario (lowest sort_order, then oldest), else
 * null (a version legitimately may have no prices yet). Mirrors `deriveActivePricingId`'s split
 * branch so the letter and the Workbench agree on which scenario is "the customer's".
 */
export function starredPricingIdForVersion(version: BundleVersion, pricings: BundlePricing[]): string | null {
  const own = pricings.filter((p) => p.bid_version_id === version.id)
  if (own.length === 0) return null
  const saved = version.starred_price_book_version_id
  if (saved && own.some((p) => p.id === saved)) return saved
  const sorted = [...own].sort(
    (a, b) => a.sort_order - b.sort_order || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')),
  )
  return sorted[0]?.id ?? null
}

export type BundleSectionPlan = {
  versionId: string
  name: string
  isAlternate: boolean
  /** The scenario whose prices the section shows; null = no prices yet (section still listed). */
  pricingId: string | null
  customerId: string | null
}

/**
 * Which versions go in the letter, in letter order: base bids first (by sort_order), then
 * alternates (by sort_order). Only versions flagged `include_in_submission`.
 */
export function planLetterSections(versions: BundleVersion[], pricings: BundlePricing[]): BundleSectionPlan[] {
  const included = versions.filter((v) => v.include_in_submission)
  const bySort = (a: BundleVersion, b: BundleVersion) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  const base = included.filter((v) => !v.is_alternate).sort(bySort)
  const alts = included.filter((v) => !!v.is_alternate).sort(bySort)
  return [...base, ...alts].map((v) => ({
    versionId: v.id,
    name: v.name,
    isAlternate: !!v.is_alternate,
    pricingId: starredPricingIdForVersion(v, pricings),
    customerId: v.customer_id ?? null,
  }))
}

/** Sum of the base sections' revenue — the number the letter says the job costs. */
export function letterTotal(sections: Array<{ isAlternate: boolean; revenueSum: number }>): number {
  return sections.filter((s) => !s.isAlternate).reduce((sum, s) => sum + (Number.isFinite(s.revenueSum) ? s.revenueSum : 0), 0)
}

/**
 * Section heading inside the bundled document. Base: "Bid: To Plans". Alternate: "Alternate:
 * Value Engineered — in lieu of To Plans" (names the base bids it replaces; just "Alternate: X"
 * when there are no base sections).
 */
export function sectionLabel(section: { name: string; isAlternate: boolean }, baseNames: string[]): string {
  if (!section.isAlternate) return `Bid: ${section.name}`
  const inLieu = baseNames.filter((n) => n !== section.name)
  return inLieu.length > 0 ? `Alternate: ${section.name} — in lieu of ${inLieu.join(' + ')}` : `Alternate: ${section.name}`
}

/** One-line summary for the panel: "2 base · 1 alternate" / "1 bid" / "nothing yet". */
export function bundleSummary(sections: Array<{ isAlternate: boolean }>): string {
  const base = sections.filter((s) => !s.isAlternate).length
  const alt = sections.length - base
  if (sections.length === 0) return 'nothing in the letter yet'
  const parts: string[] = []
  if (base > 0) parts.push(`${base} base bid${base === 1 ? '' : 's'}`)
  if (alt > 0) parts.push(`${alt} alternate${alt === 1 ? '' : 's'}`)
  return parts.join(' · ')
}
