/**
 * Legacy template-keyed pricing (v2.2720).
 *
 * Before bids kept a frozen copy of their price book (June 2026), a bid priced straight
 * against a shared template: its `bid_pricing_assignments` and `bid_count_row_custom_prices`
 * rows carry the TEMPLATE's `price_book_version_id`. Such a bid owns no pricing copy and
 * usually has no saved `selected_price_book_version_id`, so the engine used to fall back to the
 * viewer's last-picked book — and a viewer whose last pick was WENDI saw a bid priced on
 * Default as "$0 · assign…" (BP190, 206 bids in prod on 2026-09-03).
 *
 * This picks the template that actually holds the bid's rows, so the fallback can prefer it.
 */
export function pickLegacyDataTemplateId(input: {
  /** `price_book_version_id` of every assignment / custom-price row on the bid (one entry per row). */
  referencedVersionIds: ReadonlyArray<string | null | undefined>
  /** Shared templates (`bid_id IS NULL`) for the service type, in display order. */
  templateIds: ReadonlyArray<string>
  /** The bid's own pricing copies — never a "legacy" answer. */
  bidPricingIds: ReadonlyArray<string>
}): string | null {
  const { referencedVersionIds, templateIds, bidPricingIds } = input
  if (templateIds.length === 0 || referencedVersionIds.length === 0) return null
  const own = new Set(bidPricingIds)
  const counts = new Map<string, number>()
  for (const id of referencedVersionIds) {
    if (!id || own.has(id)) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  // Walk templates in display order so a tie resolves to the earlier template, deterministically.
  for (const id of templateIds) {
    const n = counts.get(id) ?? 0
    if (n > bestCount) {
      best = id
      bestCount = n
    }
  }
  return best
}
