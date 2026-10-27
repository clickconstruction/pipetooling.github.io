/**
 * Empty words for Documents' four ledgers (punch list #184, sweep C): Estimates, Bid proposals,
 * Jobs and Supply invoices, alone or under the Search tab. A ledger with no row names the page
 * that fills it, as a link to that page; a search with no match quotes the search and offers Clear
 * the search. `documentsEmptyWords.test.ts` holds every sentence to plain words.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'

type Press = () => void

export type DocumentsLedger = 'estimates' | 'bid-proposals' | 'jobs' | 'supply-invoices'

/** Each ledger's noun for its rows, its noun after a search, and the page that fills it. */
export const DOCUMENTS_LEDGER_EMPTY: Record<DocumentsLedger, { noun: string; searchNoun: string; page: { label: string; to: string; tail: string } }> = {
  estimates: { noun: 'estimates', searchNoun: 'estimates', page: { label: 'Estimates', to: '/estimates', tail: 'is where you write one.' } },
  'bid-proposals': { noun: 'bid proposals', searchNoun: 'bids', page: { label: 'Bids', to: '/bids', tail: 'is where you write one.' } },
  jobs: { noun: 'jobs', searchNoun: 'jobs', page: { label: 'Jobs', to: '/jobs', tail: 'is where you add one.' } },
  'supply-invoices': { noun: 'supply house invoices', searchNoun: 'invoices', page: { label: 'Supply houses', to: '/materials?tab=supply-houses', tail: 'is where you add one.' } },
}

/**
 * A ledger with nothing to list: no row at all, or a search hiding every row. Under the Search tab
 * the search box is the tab's, so its Clear the search is passed in; null draws the sentence alone.
 */
export function documentsLedgerEmptyWords(ledger: DocumentsLedger, s: { total: number; query: string; clearSearch: Press | null }): EmptyStateWords {
  const l = DOCUMENTS_LEDGER_EMPTY[ledger]
  if (s.total === 0) return emptyWordsWithPress(emptyWords({ kind: 'data', noun: l.noun, page: { label: l.page.label, tail: l.page.tail } }), { to: l.page.to })
  const words = emptyWords({ kind: 'filter', noun: l.searchNoun, query: s.query })
  return s.clearSearch ? emptyWordsWithPress(words, { onPress: s.clearSearch }) : { main: words.main }
}
