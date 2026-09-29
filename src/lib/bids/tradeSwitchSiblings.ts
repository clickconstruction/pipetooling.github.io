/**
 * The Bid window's trade switch (Edit Bid → Service Type): the other bids for the same customer
 * and the same project, grouped by trade — so the switch can offer "open the Electrical bid"
 * where one exists instead of copying the bid again.
 *
 * Moved out of `src/pages/Bids.tsx`'s `refreshBidServiceTypeSwitchSiblings` (punch list #51,
 * PR 3). Pure; the read is the hook's (`useBidTradeSwitch`).
 */

export type TradeSwitchSiblingRow = {
  id: string
  bid_number: string | null
  service_type_id: string
  project_name: string | null
}

export type TradeSwitchSibling = { id: string; bid_number: string | null }

/** How the switch compares project names: trimmed, case-folded. An empty name matches nothing. */
export function tradeSwitchProjectKey(projectName: string | null | undefined): string {
  return (projectName ?? '').trim().toLowerCase()
}

/**
 * The sibling rows whose project name matches `projectName`, grouped by trade, in the order
 * read. Rows for other projects are left out; an empty project name groups nothing.
 */
export function groupTradeSwitchSiblings(
  rows: ReadonlyArray<TradeSwitchSiblingRow>,
  projectName: string | null | undefined,
): Record<string, TradeSwitchSibling[]> {
  const key = tradeSwitchProjectKey(projectName)
  const map: Record<string, TradeSwitchSibling[]> = {}
  if (!key) return map
  for (const row of rows) {
    if (tradeSwitchProjectKey(row.project_name) !== key) continue
    const st = row.service_type_id
    if (!map[st]) map[st] = []
    map[st].push({ id: row.id, bid_number: row.bid_number })
  }
  return map
}
