/**
 * Bids → Pricing: the price cards row's decisions (region P2, the Pricing / Labor map's step 9,
 * part 2) — which price cards show, which layout the row takes, each card's figures, and where
 * "copy prices from …" copies from. Pure; `PricingCardsRow` draws what these decide.
 */

type ScenarioLike = { id: string; name: string; sort_order: number; bid_version_id: string | null }

/**
 * The price cards: "what this GC receives" — the price options on the bid version on screen,
 * in sort order (v2.2404). When scoping empties the row (a legacy pointer), every price shows;
 * when the bid owns no price at all but one is open (a shared book on a legacy bid), that one
 * shows as "Standard prices" so Duplicate can start the first real one.
 */
export function cardsRowScenarios<V extends ScenarioLike>(args: {
  priceBookVersions: ReadonlyArray<V>
  selectedBidVersionId: string | null
  selectedPricingVersionId: string | null
}): V[] {
  const all = [...args.priceBookVersions].sort((a, b) => a.sort_order - b.sort_order)
  const scoped = args.selectedBidVersionId ? all.filter((p) => p.bid_version_id === args.selectedBidVersionId) : all.filter((p) => p.bid_version_id == null)
  const owned = scoped.length > 0 ? scoped : all
  if (owned.length > 0) return owned
  return args.selectedPricingVersionId ? [{ id: args.selectedPricingVersionId, name: 'Standard prices', sort_order: 0 } as V] : []
}

/**
 * Whether a card's price belongs to the version on screen (an unsplit bid's own prices carry no
 * version). Only an own price can become its ★ or be offered on its letter; the fallback row above
 * can show another version's prices, and those stay view-only (v2.4377).
 */
export function cardOwnedByVersion(card: { bid_version_id?: string | null }, selectedBidVersionId: string | null): boolean {
  return (card.bid_version_id ?? null) === selectedBidVersionId
}

/** A card's revenue: the open price reads the Workbench's live total; the others their loaded card revenue, null while it loads. */
export function cardRevenue(id: string, args: { selectedPricingVersionId: string | null; effRevenue: number; scenarioRevenue: Readonly<Record<string, number>> }): number | null {
  return id === args.selectedPricingVersionId ? args.effRevenue : (args.scenarioRevenue[id] ?? null)
}

/** A card's margin (null with no revenue to divide by) and whether it is unpriced — a revenue of exactly $0, not one still loading. */
export function cardFigures(revenue: number | null, totalCost: number): { margin: number | null; unpriced: boolean } {
  return { margin: revenue != null && revenue > 0 ? (revenue - totalCost) / revenue : null, unpriced: revenue === 0 }
}

export type CardsRowMode = 'none' | 'soloUnpriced' | 'solo' | 'row'

/**
 * The row's layout. Nothing to show → `none`. One price and one GC at most → the one-line band
 * (`solo`), or, while that price is unpriced, no band at all (`soloUnpriced` — the ＋ Add price
 * door moves to the solver line, artifact 0a627c7c). Anything more → the tray of cards (`row`).
 */
export function cardsRowMode(args: { scenarioCount: number; alternateCount: number; bidVersionCount: number; soloRevenue: number | null }): CardsRowMode {
  if (args.scenarioCount === 0 && args.alternateCount === 0) return 'none'
  if (args.scenarioCount === 1 && args.bidVersionCount <= 1) return args.soloRevenue === 0 ? 'soloUnpriced' : 'solo'
  return 'row'
}

/**
 * Where an empty open price copies from: the ★ price when it is priced and not the one open,
 * else the first other priced one, else none.
 */
export function copySourceFor<V extends { id: string }>(args: {
  scenarios: ReadonlyArray<V>
  starredId: string | null
  viewingId: string | null
  revenueOf: (id: string) => number | null
}): V | null {
  const { scenarios, starredId, viewingId, revenueOf } = args
  const starred = scenarios.find((s) => s.id === starredId) ?? null
  if (starred && (revenueOf(starred.id) ?? 0) > 0 && starred.id !== viewingId) return starred
  return scenarios.find((s) => s.id !== viewingId && (revenueOf(s.id) ?? 0) > 0) ?? null
}
