import { GROUP_LABELS, type BoardItem } from './todoBoard'

/**
 * The punch list's search (v2.7263): one field in the filter row that narrows the cards as the
 * person types, in both views. On 2026-11-14 the owner asked for a search on `/punch-list`; the
 * page had the Show filters, the mock-up toggle and By number's group chips, and no way to find
 * a card by its name or its number.
 *
 * A card matches when every word of the search is found in its words: the number (`#343` or
 * `343`), the name, the summary, the Next line, the shipped versions (`v2.7150`) and its
 * group's name, all read through `foldSearchWords`, so case, accents and curly quotes never
 * decide a match. The address carries the search as `?q=`, kept beside the view and the order
 * the page already keeps, so a link with a search opens on that search; the device does not
 * remember it, since a search is for the moment and a view is a habit.
 */

/** The address's own word for the search. */
export const SEARCH_PARAM = 'q'

/**
 * Words as the search reads them: lowercase, accents dropped, curly quotes and dashes made
 * plain, every run of blanks one space, the ends trimmed. The person types `ridgeway` and the
 * card says *Ridgeway*; types `wont` and the card says *won’t*.
 */
export function foldSearchWords(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‒–—―]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** The search as the address carries it: the raw text trimmed, '' when the address has none. */
export function parseSearch(raw: string | null | undefined): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** The search from a query string (`?q=…`), '' when it carries none. */
export function searchFromAddress(search: string): string {
  return parseSearch(new URLSearchParams(search).get(SEARCH_PARAM))
}

/**
 * The page's query string with the search written in, every other parameter kept, so the view
 * and the order stay. An empty search drops the word, so a cleared field leaves a bare address.
 */
export function withSearch(search: string, query: string): string {
  const params = new URLSearchParams(search)
  const q = parseSearch(query)
  if (q) params.set(SEARCH_PARAM, q)
  else params.delete(SEARCH_PARAM)
  const out = params.toString()
  return out ? `?${out}` : ''
}

/** The words of a search, folded and split, so each must be found on its own. Empty for a blank search. */
export function searchTerms(query: string): string[] {
  const folded = foldSearchWords(query)
  return folded ? folded.split(' ') : []
}

export type SearchableCard = Pick<BoardItem, 'number' | 'name' | 'summary' | 'next' | 'ver' | 'group'>

/**
 * A card's words as one folded line: `#343`, its name, its summary, its Next line, its shipped
 * versions and its group's name. `#343` carries `343` inside it, so a search with or without the
 * hash finds the card.
 */
export function cardSearchWords(card: SearchableCard): string {
  const number = Number.isInteger(card.number) && card.number >= 1 ? `#${card.number}` : ''
  return foldSearchWords([number, card.name, card.summary, card.next, card.ver, GROUP_LABELS[card.group] ?? ''].join(' \n '))
}

/** Whether a card matches a search: every word of the search is somewhere in the card's words. A blank search matches every card. */
export function cardMatchesSearch(card: SearchableCard, query: string): boolean {
  const terms = searchTerms(query)
  if (terms.length === 0) return true
  const words = cardSearchWords(card)
  return terms.every((t) => words.includes(t))
}

/** The cards a search keeps, in the order given. The same array back when the search is blank. */
export function searchCards<T extends SearchableCard>(cards: readonly T[], query: string): readonly T[] {
  if (searchTerms(query).length === 0) return cards
  return cards.filter((c) => cardMatchesSearch(c, query))
}
