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
 *  - Otherwise (no active pricing, or a lineage that never reaches a template) → null.
 */

/**
 * The template at the root of a pricing's clone lineage. `pricingId` may be a bid-owned
 * scenario (its `source_version_id` chain is followed through `bidPricings`, cycle-safe) or a
 * template id itself. Null when the chain dead-ends before reaching a known template.
 */
export function resolvePriceBookTemplateRoot(input: {
  pricingId: string | null
  bidPricings: { id: string; source_version_id: string | null }[]
  templateIds: string[]
}): string | null {
  const { pricingId, bidPricings, templateIds } = input
  if (!pricingId) return null
  let cur = bidPricings.find((p) => p.id === pricingId) ?? null
  if (!cur) return templateIds.includes(pricingId) ? pricingId : null
  const seen = new Set<string>([cur.id])
  while (cur) {
    const src: string | null = cur.source_version_id
    if (!src) return null
    if (templateIds.includes(src)) return src
    if (seen.has(src)) return null // defensive: a cyclic lineage never resolves
    seen.add(src)
    cur = bidPricings.find((p) => p.id === src) ?? null
  }
  return null
}

export function resolveCurrentPriceBookTemplateId(input: {
  selectedPricingVersionId: string | null
  bidPricings: { id: string; source_version_id: string | null }[]
  templateIds: string[]
}): string | null {
  return resolvePriceBookTemplateRoot({
    pricingId: input.selectedPricingVersionId,
    bidPricings: input.bidPricings,
    templateIds: input.templateIds,
  })
}
