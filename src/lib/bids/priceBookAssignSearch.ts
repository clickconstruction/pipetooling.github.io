/**
 * Pricing-tab "assign a book entry" search (v2.TBD): the box seeds from the
 * count row's fixture name, but book entries are named for the material
 * (`feet of water line`, `2" Schedule 80`) while takeoff rows are named for
 * the run (`ft of 2" Demo Water Line`) — a whole-phrase substring filter
 * almost never matched the seed, so estimators retyped every row.
 *
 * Two rules live here: the seed drops the unit prefix (via the name-convention
 * kernel in countRowUnit.ts), and matching is word-by-word — an entry
 * qualifies when ANY search word appears in its name, ranked all-words-first,
 * then most words matched, then A→Z. A single-word search selects exactly the
 * entries the old substring filter did.
 */

import { stripCountRowUnitPrefix } from './countRowUnit'

/** What the assign… button pre-fills the search box with. */
export function seedPricingAssignmentSearch(fixture: string | null | undefined): string {
  return stripCountRowUnitPrefix(fixture)
}

/**
 * Book entries matching `search`, best first, capped at `cap` (pass Infinity
 * for an uncapped scrollable list). An empty/blank search returns the first
 * `cap` entries in their given order, like the old filter did.
 */
export function filterPriceBookEntries<T>(
  entries: readonly T[],
  getName: (entry: T) => string,
  search: string,
  cap = 12
): T[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return entries.slice(0, cap === Infinity ? undefined : cap)
  const scored: Array<{ entry: T; name: string; hits: number; all: boolean }> = []
  for (const entry of entries) {
    const name = getName(entry)
    const lower = name.toLowerCase()
    let hits = 0
    for (const w of words) if (lower.includes(w)) hits++
    if (hits > 0) scored.push({ entry, name, hits, all: hits === words.length })
  }
  scored.sort(
    (a, b) => Number(b.all) - Number(a.all) || b.hits - a.hits || a.name.localeCompare(b.name)
  )
  return (cap === Infinity ? scored : scored.slice(0, cap)).map((s) => s.entry)
}
