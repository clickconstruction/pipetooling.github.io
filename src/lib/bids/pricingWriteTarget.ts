/**
 * Where a pricing write lands, and whether the bid must take its own copy afterwards.
 *
 * A bid never prices from a shared price book for long: `clone_price_book_version_to_bid`
 * gives it a frozen COPY (`price_book_versions.bid_id = the bid`), and every priced row
 * (`bid_pricing_assignments`, `bid_count_row_custom_prices`) keys to that copy. Until
 * someone picks a book, though, `deriveActivePricingId` shows a shared template's prices —
 * and before this kernel every write on such a bid keyed straight to the template, so the
 * bid re-priced every time the book was edited (BP483: 42 rows on the shared Default, no
 * copy; the to-do `to-dos/frozen-bid-prices/`).
 *
 * The rule: a write on a shared template is allowed (the clone RPC carries the bid's rows on
 * that template onto the copy), but the bid must take its copy right after — **the first
 * price on a bid freezes it**. A robot template is the exception: the twin write fence keys
 * on the robot-flagged parent version, so a twin bid keeps pricing there (the v2.2720
 * backfill skipped them for the same reason).
 */
export type PricingWriteTarget =
  /** Nothing selected — the write paths already return early. */
  | { kind: 'none' }
  /** One of the bid's own pricing copies — the freeze already holds. */
  | { kind: 'own'; versionId: string }
  /** A shared template — write, then clone it into the bid and re-point every write at the copy. */
  | { kind: 'shared'; versionId: string; name: string }
  /** A robot template — the twin fence lives on it; never clone. */
  | { kind: 'robot'; versionId: string }
  /** Not the bid's and not a known template (templates still loading, a deleted book) — leave it alone. */
  | { kind: 'unknown'; versionId: string }

export function resolvePricingWriteTarget(input: {
  selectedPricingVersionId: string | null
  /** The bid's own pricing copies (`price_book_versions` with `bid_id` = the bid). */
  bidPricings: ReadonlyArray<{ id: string }>
  /** The shared catalog (`bid_id IS NULL`). */
  templates: ReadonlyArray<{ id: string; name: string; is_robot?: boolean | null }>
}): PricingWriteTarget {
  const { selectedPricingVersionId: versionId, bidPricings, templates } = input
  if (!versionId) return { kind: 'none' }
  if (bidPricings.some((p) => p.id === versionId)) return { kind: 'own', versionId }
  const template = templates.find((t) => t.id === versionId)
  if (!template) return { kind: 'unknown', versionId }
  if (template.is_robot) return { kind: 'robot', versionId }
  return { kind: 'shared', versionId, name: template.name }
}

/** True when a write keyed to `selectedPricingVersionId` must be followed by taking the bid's copy. */
export function needsFreezeAfterWrite(target: PricingWriteTarget): target is Extract<PricingWriteTarget, { kind: 'shared' }> {
  return target.kind === 'shared'
}
