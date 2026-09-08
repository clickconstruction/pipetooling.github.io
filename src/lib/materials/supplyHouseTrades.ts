/**
 * Which trades a supply house serves (to-dos/supply-house-directory, PR 6).
 * Rows in `supply_house_service_types` tag a house; a house with no rows
 * serves everyone. The rule every reader applies: when the viewer is looking
 * at a subset of trades, keep houses that serve one of them OR are untagged —
 * an untagged house never vanishes from a restricted estimator.
 */

export type HouseTradeLink = { supply_house_id: string; service_type_id: string }

export type TradeType = { id: string; name: string }

export function tradesByHouse(links: readonly HouseTradeLink[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const l of links) {
    const set = out.get(l.supply_house_id) ?? new Set<string>()
    set.add(l.service_type_id)
    out.set(l.supply_house_id, set)
  }
  return out
}

/** True when the house is untagged or serves at least one of `tradeIds`. */
export function houseServesAnyTrade(houseId: string, tradeIds: Iterable<string>, byHouse: ReadonlyMap<string, ReadonlySet<string>>): boolean {
  const served = byHouse.get(houseId)
  if (!served || served.size === 0) return true
  for (const t of tradeIds) if (served.has(t)) return true
  return false
}

/**
 * Which trade chips start on: a restricted viewer's own trades (those that still
 * exist), otherwise every trade. An empty selection is never the default.
 */
export function defaultTradeSelection(allTypeIds: readonly string[], restrictedIds: readonly string[] | null | undefined): Set<string> {
  const all = new Set(allTypeIds)
  if (restrictedIds && restrictedIds.length > 0) {
    const mine = new Set(restrictedIds.filter((id) => all.has(id)))
    if (mine.size > 0) return mine
  }
  return all
}

/**
 * Houses to show for a trade selection. No selection, or every trade selected,
 * means no trade filter at all; a subset keeps untagged houses plus those that
 * serve a selected trade.
 */
export function filterHousesByTrades<H extends { id: string }>(
  houses: readonly H[],
  selected: ReadonlySet<string>,
  allTypeIds: readonly string[],
  byHouse: ReadonlyMap<string, ReadonlySet<string>>,
): H[] {
  if (selected.size === 0 || (allTypeIds.length > 0 && allTypeIds.every((id) => selected.has(id)))) return [...houses]
  return houses.filter((h) => houseServesAnyTrade(h.id, selected, byHouse))
}

/** The house's trade names in service-type order; empty when untagged. */
export function tradeNamesFor(houseId: string, byHouse: ReadonlyMap<string, ReadonlySet<string>>, types: readonly TradeType[]): string[] {
  const served = byHouse.get(houseId)
  if (!served || served.size === 0) return []
  return types.filter((t) => served.has(t.id)).map((t) => t.name)
}

/**
 * The RFQ picker's default: houses that serve the bid's trade or are untagged,
 * plus how many the trade hid (so the modal can offer "show all").
 */
export function housesForBidTrade<H extends { id: string }>(
  houses: readonly H[],
  bidTradeId: string | null | undefined,
  byHouse: ReadonlyMap<string, ReadonlySet<string>>,
): { shown: H[]; hidden: number } {
  if (!bidTradeId) return { shown: [...houses], hidden: 0 }
  const shown = houses.filter((h) => houseServesAnyTrade(h.id, [bidTradeId], byHouse))
  return { shown, hidden: houses.length - shown.length }
}
