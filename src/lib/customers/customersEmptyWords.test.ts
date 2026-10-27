import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import { NEW_BID_PATH } from '../bids/bidPickerEmptyWords'
import { NEW_ESTIMATE_PATH } from '../estimates/estimatesEmptyWords'
import {
  CUSTOMER_BIDS_EMPTY,
  CUSTOMER_ESTIMATES_EMPTY,
  CUSTOMER_INVOICES_EMPTY,
  NEW_JOB_PATH,
  customerFeedEmptyWords,
  customerJobsEmptyWords,
  customerNotesEmptyWords,
  customerOpenJobsEmptyWords,
  customersListEmptyWords,
} from './customersEmptyWords'

const noop = () => {}
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
function press(w: EmptyStateWords) {
  if (!w.next || !('onPress' in w.next)) throw new Error(`no handler press on: ${w.main}`)
  w.next.onPress()
}
const list = (over: Partial<Parameters<typeof customersListEmptyWords>[0]> = {}) =>
  customersListEmptyWords({ total: 12, similar: false, query: '', addCustomer: noop, clearSearch: noop, clearFilters: noop, showAll: noop, ...over })

describe('customersEmptyWords', () => {
  it('the list: Add customer, Show all, Clear the search, Clear the filters, in that order', () => {
    const add = vi.fn()
    const none = list({ total: 0, addCustomer: add, query: 'Oak' })
    expect(read(none)).toBe('No customers yet. Add customer adds the first.')
    press(none)
    expect(add).toHaveBeenCalledTimes(1)
    expect(list({ total: 0, addCustomer: null })).toEqual({ main: 'No customers yet.' })

    const showAll = vi.fn()
    const similar = list({ similar: true, showAll, query: 'Oak' })
    expect(read(similar)).toBe('No two customers share a name, address, phone or email. Show all')
    press(similar)
    expect(showAll).toHaveBeenCalledTimes(1)

    const clearSearch = vi.fn()
    const search = list({ query: 'Ridgeway', clearSearch })
    expect(read(search)).toBe('No customers match ‘Ridgeway’. Clear the search')
    press(search)
    expect(clearSearch).toHaveBeenCalledTimes(1)

    const clearFilters = vi.fn()
    const filters = list({ clearFilters })
    expect(read(filters)).toBe('No customers match the filters. Clear the filters')
    press(filters)
    expect(clearFilters).toHaveBeenCalledTimes(1)
  })

  it('the bids window and the Hub tabs link to the page that makes the thing', () => {
    expect(CUSTOMER_BIDS_EMPTY.next).toEqual({ label: 'New Bid', to: NEW_BID_PATH })
    expect(CUSTOMER_ESTIMATES_EMPTY.next).toEqual({ label: 'New estimate', to: NEW_ESTIMATE_PATH })
    expect(customerJobsEmptyWords(true).next).toEqual({ label: 'New Job', to: NEW_JOB_PATH })
    expect(customerJobsEmptyWords(false)).toEqual({ main: 'No jobs for this customer yet.' })
    expect(CUSTOMER_INVOICES_EMPTY.next).toBeUndefined()
  })

  it('the Hub: Open jobs says no job or every job paid; the feed offers All under a filter', () => {
    expect(customerOpenJobsEmptyWords(0)).toEqual({ main: 'No jobs yet.' })
    expect(read(customerOpenJobsEmptyWords(4))).toBe('Nothing open. Every job is paid.')
    const all = vi.fn()
    const filtered = customerFeedEmptyWords('money', all)
    expect(read(filtered)).toBe('Nothing for this filter. All shows every event.')
    press(filtered)
    expect(all).toHaveBeenCalledTimes(1)
    expect(customerFeedEmptyWords('all', all).next).toBeUndefined()
  })

  it('customer notes: Add row opens the new-note row', () => {
    const addRow = vi.fn()
    const words = customerNotesEmptyWords(addRow)
    expect(read(words)).toBe('No notes yet. Add row adds the first.')
    press(words)
    expect(addRow).toHaveBeenCalledTimes(1)
  })

  it('every sentence reads in plain words', () => {
    const all: EmptyStateWords[] = [
      list({ total: 0 }),
      list({ similar: true }),
      list({ query: 'Ridgeway' }),
      list(),
      CUSTOMER_BIDS_EMPTY,
      customerOpenJobsEmptyWords(0),
      customerOpenJobsEmptyWords(2),
      customerFeedEmptyWords('jobs', noop),
      customerFeedEmptyWords('all', noop),
      CUSTOMER_ESTIMATES_EMPTY,
      customerJobsEmptyWords(true),
      CUSTOMER_INVOICES_EMPTY,
      customerNotesEmptyWords(noop),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
