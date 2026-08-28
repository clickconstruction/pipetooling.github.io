/**
 * Resolve which shared **template** the Pricing tab's price-book dropdown should show as
 * "current" for a bid. The dropdown lists templates only, but a bid actually prices against
 * either a bid-owned copy (cloned from a template) or — for bids that never set up pricing —
 * a template directly (the "Default" fallback / legacy `selected_price_book_version_id`).
 *
 *  - Active pricing is a bid-owned copy  → the template its lineage was cloned from: since
 *    v2.2396 the `source_version_id` chain is walked through the bid's own pricings, because
 *    scenarios born from "+ Add price" duplicates or bid-version clones point at ANOTHER
 *    SCENARIO, not a template — the old direct-source read showed those as "Select a price
 *    book…" (Wendi's "going between new and old deselects the pricebook").
 *  - Active pricing IS a template id     → that template (Default fallback / legacy link).
 *  - Lineage dead-ends but the pricing's NAME is a template's name → that template (v2.2444).
 *  - Otherwise → null.
 */

/**
 * Name fallback (v2.2444). `price_book_versions.source_version_id` is `ON DELETE SET NULL`, so
 * deleting a scenario severs the lineage of every copy taken from it — the descendants keep
 * their prices and their name but can no longer point at a template. That left BP384's two
 * "WENDI" pricings resolving to null, which sent the book drawer to the first template
 * alphabetically ("Default"), dropped the ★ "Feeding this bid" marker, and made "Use WENDI on
 * this bid" mint a THIRD copy instead of switching to the one the bid already had.
 *
 * Cloning preserves the source's name (v2.2123), so the name is the surviving evidence of
 * lineage. Only an unambiguous match counts: exactly one template with that name, compared
 * case- and whitespace-insensitively. A wrong guess here costs a mislabelled chip; the null it
 * replaces costs a lost book and a destructive clone.
 */
function templateIdByName(
  name: string | null | undefined,
  templates: ReadonlyArray<{ id: string; name: string | null }>,
): string | null {
  const key = (name ?? '').trim().toLowerCase()
  if (!key) return null
  const hits = templates.filter((t) => (t.name ?? '').trim().toLowerCase() === key)
  return hits.length === 1 ? (hits[0]?.id ?? null) : null
}

/**
 * The template at the root of a pricing's clone lineage. `pricingId` may be a bid-owned
 * scenario (its `source_version_id` chain is followed through `bidPricings`, cycle-safe) or a
 * template id itself. When the chain dead-ends and `templates` is supplied, the pricing's name
 * decides; without `templates` the dead-end stays null (the pre-v2.2444 behavior).
 */
export function resolvePriceBookTemplateRoot(input: {
  pricingId: string | null
  bidPricings: { id: string; source_version_id: string | null; name?: string | null }[]
  templateIds: string[]
  /** Templates with their names — supply to enable the dead-end name fallback. */
  templates?: ReadonlyArray<{ id: string; name: string | null }>
}): string | null {
  const { pricingId, bidPricings, templateIds, templates } = input
  if (!pricingId) return null
  const start = bidPricings.find((p) => p.id === pricingId) ?? null
  if (!start) return templateIds.includes(pricingId) ? pricingId : null
  const byName = () => (templates ? templateIdByName(start.name, templates) : null)
  let cur: { id: string; source_version_id: string | null; name?: string | null } | null = start
  const seen = new Set<string>([cur.id])
  while (cur) {
    const src: string | null = cur.source_version_id
    if (!src) return byName()
    if (templateIds.includes(src)) return src
    if (seen.has(src)) return byName() // defensive: a cyclic lineage never resolves
    seen.add(src)
    cur = bidPricings.find((p) => p.id === src) ?? null
  }
  return byName()
}

export function resolveCurrentPriceBookTemplateId(input: {
  selectedPricingVersionId: string | null
  bidPricings: { id: string; source_version_id: string | null; name?: string | null }[]
  templateIds: string[]
  templates?: ReadonlyArray<{ id: string; name: string | null }>
}): string | null {
  return resolvePriceBookTemplateRoot({
    pricingId: input.selectedPricingVersionId,
    bidPricings: input.bidPricings,
    templateIds: input.templateIds,
    templates: input.templates,
  })
}
