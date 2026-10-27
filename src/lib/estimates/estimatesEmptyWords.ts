/**
 * Empty words for Estimates (punch list #184, sweep C): what the Pipeline, the Ledger, the
 * Follow-up lanes and the line-item book say when a list has no rows, in `EmptyState`'s shape
 * (`main`, the press, `tail`). The rule is `emptyWords.ts`'s: a list says what fills it and offers
 * the press, a search with no match quotes the search and offers Clear the search, and a lane
 * whose empty is the good state says so. Each helper takes the page's own handler.
 * `estimatesEmptyWords.test.ts` fires every press and holds every sentence to plain words.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'

type Press = () => void

/** The Estimates page opens a fresh draft on this link (`pages/Estimates.tsx`, the Projects card's "+ Estimate" deep link). */
export const NEW_ESTIMATE_PATH = '/estimates?newEstimate=true'

/** The page's make button. */
export const NEW_ESTIMATE_CONTROL = 'New estimate'

/**
 * No estimate at all. With the customer filter on, the filter's own Clear filter shows every
 * estimate. A primary reads which estimates they can see, after the press.
 */
export function estimatesListEmptyWords(s: { customerFiltered: boolean; primary: boolean; newEstimate: Press; clearCustomer: Press }): EmptyStateWords {
  if (s.customerFiltered) return { main: 'No estimates for this customer.', next: { label: 'Clear filter', onPress: s.clearCustomer }, tail: 'shows every estimate.' }
  const words = emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'estimates', control: NEW_ESTIMATE_CONTROL }), { onPress: s.newEstimate })
  return s.primary ? { ...words, tail: `${words.tail ?? ''} You see the ones you created and those on jobs you are the Account Man for.`.trim() } : words
}

/** The Pipeline after a search hid every estimate. */
export function estimatesSearchEmptyWords(query: string, clearSearch: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'estimates', query }), { onPress: clearSearch })
}

/** The Ledger: the search hid every estimate, or the kind, date and superseded filters did. */
export function estimatesLedgerEmptyWords(s: { query: string; searchHidesAll: boolean; clearSearch: Press; clearFilters: Press }): EmptyStateWords {
  if (s.searchHidesAll && s.query.trim()) return estimatesSearchEmptyWords(s.query, s.clearSearch)
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'estimates', query: '' }), { onPress: s.clearFilters })
}

export type EstimateLane = 'unsent' | 'sent' | 'accepted'

const LANE_NOUN: Record<EstimateLane, string> = { unsent: 'unsent estimates', sent: 'sent estimates', accepted: 'accepted estimates' }

/**
 * A Follow-up lane with no row. Under a search it quotes the search; otherwise each lane says its
 * own good state. Unsent leaves out *Every draft went out.* while empty drafts wait on Clean up.
 */
export function estimateLaneEmptyWords(lane: EstimateLane, s: { query: string; clearSearch: Press; emptyDrafts: number }): EmptyStateWords {
  if (s.query.trim()) return { main: `No ${LANE_NOUN[lane]} match ‘${s.query.trim()}’.`, next: { label: 'Clear the search', onPress: s.clearSearch } }
  switch (lane) {
    case 'unsent':
      return s.emptyDrafts > 0 ? { main: 'Only empty drafts are unsent.', tail: 'Clean up above deletes them.' } : { main: 'Nothing unsent.', tail: 'Every draft went out.' }
    case 'sent':
      return { main: emptyWords({ kind: 'waiting', who: 'a customer' }).main, tail: 'Every sent estimate has its answer.' }
    case 'accepted':
      return { main: 'Nothing accepted yet.', tail: 'A sent estimate lands here once the customer accepts it.' }
  }
}

/**
 * The line-item book's pick list: an empty book (Edit book adds the first item, for an editor), or
 * the filter hiding every item.
 */
export function estimateCatalogEmptyWords(s: { total: number; query: string; openEditBook: Press | null; clearSearch: Press }): EmptyStateWords {
  if (s.total === 0) return s.openEditBook ? { main: 'No preset items yet.', next: { label: 'Edit book', onPress: s.openEditBook }, tail: 'adds the first.' } : { main: 'No preset items yet.' }
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'items', query: s.query }), { onPress: s.clearSearch })
}
