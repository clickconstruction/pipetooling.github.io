/**
 * Active-Pricing selection for a bid. A bid owns zero or more "Pricings" (bid-scoped
 * price_book_versions). `selected_price_book_version_id` on the bid is the remembered
 * active choice — it may point at a current Pricing, a now-stale Pricing, or (for bids
 * created before Pricings existed) a global template version.
 *
 * Rules:
 *  - If the bid has Pricings: keep the saved one when it's still among them, else fall
 *    back to the lowest sort_order.
 *  - If the bid has no Pricings yet: pass the saved id straight through. This preserves
 *    the legacy behavior where the bid still prices against its global selection until
 *    the user adds the first Pricing (lazy back-compat); null stays null (empty picker).
 */
export type PricingForSelection = { id: string; sort_order: number }

export function pickActivePricing(input: {
  savedVersionId: string | null
  bidPricings: PricingForSelection[]
}): string | null {
  const { savedVersionId, bidPricings } = input
  if (bidPricings.length > 0) {
    if (savedVersionId && bidPricings.some((p) => p.id === savedVersionId)) {
      return savedVersionId
    }
    const sorted = [...bidPricings].sort((a, b) => a.sort_order - b.sort_order)
    return sorted[0]?.id ?? null
  }
  return savedVersionId ?? null
}

/** Next sort_order to append a new Pricing after a bid's existing ones (starts at 0). */
export function nextSortOrder(existing: { sort_order: number }[]): number {
  return existing.reduce((max, x) => Math.max(max, x.sort_order), -1) + 1
}
