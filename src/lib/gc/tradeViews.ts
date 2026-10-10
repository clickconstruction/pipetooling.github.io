/**
 * GC mode, the real build (the Board's B3-b and B4-b): a rule the dev views share. A trade's card has an id to jump to
 * (Trade partners' strip and Follow up's Who else?). The Follow up pill's count is `allPeople`'s since the Board's B2b-ii-b.
 */

/** The id of a trade's card on Trade partners: "gc-bench-fire-sprinkler". */
export function benchAnchor(trade: string): string {
  return `gc-bench-${trade.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}
