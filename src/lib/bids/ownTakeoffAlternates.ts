/**
 * Own-takeoff alternates (v2.2404, Wendi: "assign an alternate takeoff to the
 * alternate bid, so that the materials that correspond to it are calculated
 * in the margin").
 *
 * An alternate that changes materials is a bid VERSION under the hood — its
 * own counts and takeoff (v2.2132) — marked `is_alternate` for the same GC.
 * These helpers are the pure math for surfacing those versions as cards in
 * the Workbench's price-options row:
 *
 *  - which versions ride the row (same GC as the active version, alternate,
 *    not the one on screen);
 *  - the card's numbers: the alternate's margin swaps ITS materials into the
 *    bid-wide cost (labor and the other direct costs stay shared across the
 *    whole bid — the existing versions model).
 *
 * Materials per version are real for the 'rough' (unit-price takeoff) model;
 * the 'exact' model's POs are bid-wide (the documented shared-PO caveat), so
 * those bids pass altMaterials = null and the card falls back to the shared
 * cost — same margin the bid shows today.
 */

export type SameGcAlternateInput = {
  id: string
  customer_id: string | null
  is_alternate?: boolean | null
}

/** Same-GC alternate versions for the price-options row (never the active one). */
export function sameGcAlternateVersions<V extends SameGcAlternateInput>(
  versions: readonly V[],
  activeVersionId: string | null,
): V[] {
  if (!activeVersionId) return []
  const active = versions.find((v) => v.id === activeVersionId)
  if (!active) return []
  const gc = active.customer_id ?? null
  return versions.filter(
    (v) => v.id !== activeVersionId && (v.is_alternate ?? false) === true && (v.customer_id ?? null) === gc,
  )
}

export type AlternateCardNumbers = {
  /** The cost the alternate's margin is judged against (shared cost with its materials swapped in). */
  cost: number | null
  profit: number | null
  /** profit ÷ revenue, the grid's definition. Null without positive revenue. */
  margin: number | null
  /** altMaterials − baseMaterials; null when the alternate's materials are unknown (exact model). */
  materialsDelta: number | null
}

/**
 * The card's money line. `baseTotalCost` and `baseMaterials` are the active
 * version's Workbench numbers (pre-tax materials, as `derivePricingWorkbench`
 * sums them); `altMaterials` is the alternate version's own pre-tax takeoff
 * total, or null when it can't be known (exact/PO model) — then the shared
 * cost stands unchanged.
 */
export function alternateCardNumbers(input: {
  revenue: number | null
  altMaterials: number | null
  baseMaterials: number
  baseTotalCost: number
}): AlternateCardNumbers {
  const { revenue, altMaterials, baseMaterials, baseTotalCost } = input
  const cost = altMaterials != null ? baseTotalCost - baseMaterials + altMaterials : baseTotalCost
  if (revenue == null || revenue <= 0) {
    return { cost, profit: null, margin: null, materialsDelta: altMaterials != null ? altMaterials - baseMaterials : null }
  }
  const profit = revenue - cost
  return {
    cost,
    profit,
    margin: profit / revenue,
    materialsDelta: altMaterials != null ? altMaterials - baseMaterials : null,
  }
}

/**
 * The base an own-takeoff alternate was cut from (v2.6000, Wendi's video of 2026-10-27): the
 * same-GC versions that are not alternates, in sort order, and only while the active version is
 * itself an alternate. On the base's row the alternate rides as a card; this is the mirror, so
 * the pair stays on screen from both sides and the way back is one card, not only the chip on
 * the Send to strip. On the base, or on an unsplit bid, nothing.
 */
export function sameGcBaseVersions<V extends SameGcAlternateInput & { sort_order?: number | null }>(
  versions: readonly V[],
  activeVersionId: string | null,
): V[] {
  if (!activeVersionId) return []
  const active = versions.find((v) => v.id === activeVersionId)
  if (!active || (active.is_alternate ?? false) !== true) return []
  const gc = active.customer_id ?? null
  return versions
    .filter((v) => v.id !== activeVersionId && (v.is_alternate ?? false) !== true && (v.customer_id ?? null) === gc)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

/**
 * The line over the tray while an own-takeoff alternate is on screen (v2.6000). Before it, the
 * alternate's own ★ is a copy of the base's price with the base's price name, so after the click
 * that opened the alternate nothing on the Workbench carried the alternate's name. Plain words
 * (`plainWords.ts`): the version by name, what the cards are, and where the base sits when it rides
 * the row.
 */
export function alternateOnScreenWords(input: { versionName: string; hasBaseCard: boolean }): string {
  const sentences = [
    `You are on ${input.versionName}, an alternate with its own takeoff.`,
    'The cards below are its prices.',
    ...(input.hasBaseCard ? ['The base is the first card.'] : []),
  ]
  return sentences.join(' ')
}
