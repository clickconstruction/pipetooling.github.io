import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import { DOCUMENTS_LEDGER_EMPTY, documentsLedgerEmptyWords, type DocumentsLedger } from './documentsEmptyWords'

const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
const LEDGERS = Object.keys(DOCUMENTS_LEDGER_EMPTY) as DocumentsLedger[]

describe('documentsEmptyWords', () => {
  it('an empty ledger links to the page that fills it', () => {
    expect(read(documentsLedgerEmptyWords('estimates', { total: 0, query: '', clearSearch: null }))).toBe('No estimates yet. Estimates is where you write one.')
    expect(documentsLedgerEmptyWords('estimates', { total: 0, query: '', clearSearch: null }).next).toEqual({ label: 'Estimates', to: '/estimates' })
    expect(documentsLedgerEmptyWords('bid-proposals', { total: 0, query: '', clearSearch: null }).next).toEqual({ label: 'Bids', to: '/bids' })
    expect(documentsLedgerEmptyWords('jobs', { total: 0, query: '', clearSearch: null }).next).toEqual({ label: 'Jobs', to: '/jobs' })
    expect(read(documentsLedgerEmptyWords('supply-invoices', { total: 0, query: 'x', clearSearch: null }))).toBe('No supply house invoices yet. Supply houses is where you add one.')
  })

  it('a search with no match quotes it and clears it, or reads alone when the search is not the ledger’s', () => {
    const clear = vi.fn()
    const words = documentsLedgerEmptyWords('bid-proposals', { total: 8, query: 'Ridgeway', clearSearch: clear })
    expect(read(words)).toBe('No bids match ‘Ridgeway’. Clear the search')
    if (words.next && 'onPress' in words.next) words.next.onPress()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(documentsLedgerEmptyWords('supply-invoices', { total: 8, query: 'Hart', clearSearch: null })).toEqual({ main: 'No invoices match ‘Hart’.' })
  })

  it('every sentence reads in plain words', () => {
    for (const ledger of LEDGERS) {
      for (const w of [
        documentsLedgerEmptyWords(ledger, { total: 0, query: '', clearSearch: null }),
        documentsLedgerEmptyWords(ledger, { total: 3, query: 'Ridgeway', clearSearch: () => {} }),
      ]) {
        expect(plainWordsFailures(read(w)), read(w)).toEqual([])
      }
    }
  })
})
