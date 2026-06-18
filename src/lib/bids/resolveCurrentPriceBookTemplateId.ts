/**
 * Resolve which shared **template** the Pricing tab's price-book dropdown should show as
 * "current" for a bid. The dropdown lists templates only, but a bid actually prices against
 * either a bid-owned copy (cloned from a template) or — for bids that never set up pricing —
 * a template directly (the "Default" fallback / legacy `selected_price_book_version_id`).
 *
 *  - Active pricing is a bid-owned copy  → the template it was cloned from (`source_version_id`).
 *  - Active pricing IS a template id     → that template (Default fallback / legacy link).
 *  - Otherwise (no active pricing, or a copy whose source is gone) → null (placeholder).
 */
export function resolveCurrentPriceBookTemplateId(input: {
  selectedPricingVersionId: string | null
  bidPricings: { id: string; source_version_id: string | null }[]
  templateIds: string[]
}): string | null {
  const { selectedPricingVersionId, bidPricings, templateIds } = input
  if (!selectedPricingVersionId) return null
  const own = bidPricings.find((p) => p.id === selectedPricingVersionId)
  if (own) return own.source_version_id ?? null
  if (templateIds.includes(selectedPricingVersionId)) return selectedPricingVersionId
  return null
}
