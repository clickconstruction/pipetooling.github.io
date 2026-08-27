/**
 * Pricing-tab "assign a book entry" search (v2.TBD): the box seeds from the
 * count row's fixture name, but book entries are named for the material
 * (`feet of water line`, `2" Schedule 80`) while takeoff rows are named for
 * the run (`ft of 2" Demo Water Line`) — a whole-phrase substring filter
 * almost never matched the seed, so estimators retyped every row.
 *
 * Matching rules (v2.2397 added modes + highlight ranges — Wendi: "i want
 * exact matching as an option" and highlighted matches):
 *  - the seed drops the unit prefix (via the name-convention kernel in
 *    countRowUnit.ts);
 *  - 'similar' mode is the original word-by-word match — an entry qualifies
 *    when ANY search word appears in its name, ranked all-words-first, then
 *    most words matched, then A→Z;
 *  - 'exact' mode keeps only entries containing EVERY search word (same
 *    ranking within);
 *  - every match carries the character ranges its words hit, so the dropdown
 *    can highlight WHY a row matched ("2IN" hiding inside "1 1/2IN" stops
 *    being a mystery).
 */

import { stripCountRowUnitPrefix } from './countRowUnit'

/** What the assign… button pre-fills the search box with. */
export function seedPricingAssignmentSearch(fixture: string | null | undefined): string {
  return stripCountRowUnitPrefix(fixture)
}

export type AssignMatchMode = 'similar' | 'exact'

export type ScoredBookEntry<T> = {
  entry: T
  name: string
  /** How many distinct search words this name contains. */
  hits: number
  /** True when every search word appears. */
  all: boolean
  /** Merged, sorted [start, end) ranges of every matched word occurrence in `name`. */
  ranges: Array<[number, number]>
}

export type PriceBookSearchResult<T> = {
  matches: ScoredBookEntry<T>[]
  /** Search words that appear in NO entry's name — the "matches nothing" strip. */
  unmatchedWords: string[]
  /** Search words that matched at least one entry (display order preserved). */
  matchedWords: string[]
  /** How many entries a 'similar' search would return — the exact-mode empty state's "Show N similar". */
  similarCount: number
}

/** All [start, end) occurrences of `word` in `lower` (already lowercased). */
function wordRanges(lower: string, word: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let from = 0
  for (;;) {
    const i = lower.indexOf(word, from)
    if (i === -1) return out
    out.push([i, i + word.length])
    from = i + 1
  }
}

/** Sort by start and merge overlapping/touching ranges (e.g. "2in" + "in"). */
function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length <= 1) return ranges
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out: Array<[number, number]> = [sorted[0]!]
  for (const [s, e] of sorted.slice(1)) {
    const last = out[out.length - 1]!
    if (s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

/**
 * Book entries matching `search` in the given mode, best first, capped at
 * `cap` (pass Infinity for an uncapped scrollable list), with highlight
 * ranges and the word-level diagnostics the dropdown header shows. An
 * empty/blank search returns the first `cap` entries in their given order
 * (no ranges) in BOTH modes, like the old filter did.
 */
export function searchPriceBookEntries<T>(
  entries: readonly T[],
  getName: (entry: T) => string,
  search: string,
  mode: AssignMatchMode,
  cap = 12
): PriceBookSearchResult<T> {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    const all = entries.slice(0, cap === Infinity ? undefined : cap)
    return {
      matches: all.map((entry) => ({ entry, name: getName(entry), hits: 0, all: false, ranges: [] })),
      unmatchedWords: [],
      matchedWords: [],
      similarCount: entries.length,
    }
  }
  const wordEverHit = words.map(() => false)
  const scored: Array<ScoredBookEntry<T>> = []
  for (const entry of entries) {
    const name = getName(entry)
    const lower = name.toLowerCase()
    let hits = 0
    const ranges: Array<[number, number]> = []
    words.forEach((w, wi) => {
      const r = wordRanges(lower, w)
      if (r.length > 0) {
        hits++
        wordEverHit[wi] = true
        ranges.push(...r)
      }
    })
    if (hits > 0) scored.push({ entry, name, hits, all: hits === words.length, ranges: mergeRanges(ranges) })
  }
  scored.sort(
    (a, b) => Number(b.all) - Number(a.all) || b.hits - a.hits || a.name.localeCompare(b.name)
  )
  const modeList = mode === 'exact' ? scored.filter((s) => s.all) : scored
  return {
    matches: cap === Infinity ? modeList : modeList.slice(0, cap),
    unmatchedWords: words.filter((_, i) => !wordEverHit[i]),
    matchedWords: words.filter((_, i) => wordEverHit[i]),
    similarCount: scored.length,
  }
}

/**
 * Original entries-only filter ('similar' mode), kept for call sites and
 * tests that don't need ranges. A single-word search selects exactly the
 * entries the old substring filter did.
 */
export function filterPriceBookEntries<T>(
  entries: readonly T[],
  getName: (entry: T) => string,
  search: string,
  cap = 12
): T[] {
  return searchPriceBookEntries(entries, getName, search, 'similar', cap).matches.map((m) => m.entry)
}
