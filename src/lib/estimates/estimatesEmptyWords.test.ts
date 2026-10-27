import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import {
  NEW_ESTIMATE_PATH,
  estimateCatalogEmptyWords,
  estimateLaneEmptyWords,
  estimatesLedgerEmptyWords,
  estimatesListEmptyWords,
  estimatesSearchEmptyWords,
} from './estimatesEmptyWords'

const noop = () => {}
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
function press(w: EmptyStateWords) {
  if (!w.next || !('onPress' in w.next)) throw new Error(`no handler press on: ${w.main}`)
  w.next.onPress()
}

describe('estimatesEmptyWords', () => {
  it('the list: New estimate starts the first, a primary reads what they see, the customer filter offers Clear filter', () => {
    const newEstimate = vi.fn()
    const clearCustomer = vi.fn()
    const words = estimatesListEmptyWords({ customerFiltered: false, primary: false, newEstimate, clearCustomer })
    expect(read(words)).toBe('No estimates yet. New estimate adds the first.')
    press(words)
    expect(newEstimate).toHaveBeenCalledTimes(1)
    expect(estimatesListEmptyWords({ customerFiltered: false, primary: true, newEstimate, clearCustomer }).tail).toBe(
      'adds the first. You see the ones you created and those on jobs you are the Account Man for.',
    )
    const customer = estimatesListEmptyWords({ customerFiltered: true, primary: true, newEstimate, clearCustomer })
    expect(read(customer)).toBe('No estimates for this customer. Clear filter shows every estimate.')
    press(customer)
    expect(clearCustomer).toHaveBeenCalledTimes(1)
    expect(NEW_ESTIMATE_PATH).toBe('/estimates?newEstimate=true')
  })

  it('the Pipeline and the Ledger: the search first, then the Ledger filters', () => {
    const clearSearch = vi.fn()
    const clearFilters = vi.fn()
    const search = estimatesSearchEmptyWords('Ridgeway', clearSearch)
    expect(read(search)).toBe('No estimates match ‘Ridgeway’. Clear the search')
    press(search)
    expect(clearSearch).toHaveBeenCalledTimes(1)
    expect(estimatesLedgerEmptyWords({ query: 'Ridgeway', searchHidesAll: true, clearSearch, clearFilters }).main).toBe('No estimates match ‘Ridgeway’.')
    const filters = estimatesLedgerEmptyWords({ query: 'Ridgeway', searchHidesAll: false, clearSearch, clearFilters })
    expect(read(filters)).toBe('No estimates match the filters. Clear the filters')
    press(filters)
    expect(clearFilters).toHaveBeenCalledTimes(1)
  })

  it('the Follow-up lanes: each lane its good state, a search quoted', () => {
    const clearSearch = vi.fn()
    expect(read(estimateLaneEmptyWords('unsent', { query: '', clearSearch, emptyDrafts: 0 }))).toBe('Nothing unsent. Every draft went out.')
    expect(read(estimateLaneEmptyWords('unsent', { query: '', clearSearch, emptyDrafts: 2 }))).toBe('Only empty drafts are unsent. Clean up above deletes them.')
    expect(read(estimateLaneEmptyWords('sent', { query: '', clearSearch, emptyDrafts: 0 }))).toBe('Nothing waiting on a customer. Every sent estimate has its answer.')
    expect(estimateLaneEmptyWords('accepted', { query: '', clearSearch, emptyDrafts: 0 }).main).toBe('Nothing accepted yet.')
    const searched = estimateLaneEmptyWords('sent', { query: ' Oak ', clearSearch, emptyDrafts: 0 })
    expect(read(searched)).toBe('No sent estimates match ‘Oak’. Clear the search')
    press(searched)
    expect(clearSearch).toHaveBeenCalledTimes(1)
  })

  it('the line-item book: Edit book for an editor, the sentence alone for the rest, Clear the search after the filter', () => {
    const editBook = vi.fn()
    const clearSearch = vi.fn()
    const empty = estimateCatalogEmptyWords({ total: 0, query: '', openEditBook: editBook, clearSearch })
    expect(read(empty)).toBe('No preset items yet. Edit book adds the first.')
    press(empty)
    expect(editBook).toHaveBeenCalledTimes(1)
    expect(estimateCatalogEmptyWords({ total: 0, query: '', openEditBook: null, clearSearch })).toEqual({ main: 'No preset items yet.' })
    const filtered = estimateCatalogEmptyWords({ total: 5, query: 'hydro', openEditBook: editBook, clearSearch })
    expect(filtered.main).toBe('No items match ‘hydro’.')
    press(filtered)
    expect(clearSearch).toHaveBeenCalledTimes(1)
  })

  it('every sentence reads in plain words', () => {
    const all: EmptyStateWords[] = [
      estimatesListEmptyWords({ customerFiltered: false, primary: true, newEstimate: noop, clearCustomer: noop }),
      estimatesListEmptyWords({ customerFiltered: true, primary: false, newEstimate: noop, clearCustomer: noop }),
      estimatesSearchEmptyWords('Ridgeway', noop),
      estimatesLedgerEmptyWords({ query: '', searchHidesAll: false, clearSearch: noop, clearFilters: noop }),
      ...(['unsent', 'sent', 'accepted'] as const).map((lane) => estimateLaneEmptyWords(lane, { query: '', clearSearch: noop, emptyDrafts: 0 })),
      estimateLaneEmptyWords('unsent', { query: '', clearSearch: noop, emptyDrafts: 3 }),
      estimateLaneEmptyWords('accepted', { query: 'Oak', clearSearch: noop, emptyDrafts: 0 }),
      estimateCatalogEmptyWords({ total: 0, query: '', openEditBook: noop, clearSearch: noop }),
      estimateCatalogEmptyWords({ total: 4, query: 'hydro', openEditBook: null, clearSearch: noop }),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
