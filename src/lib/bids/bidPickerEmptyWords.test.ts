import { describe, expect, it, vi } from 'vitest'
import { BID_PICKER_NONE_NAME_YOU, bidPickerEmptyWords, NEW_BID_PATH } from './bidPickerEmptyWords'
import { plainWordsFailures } from '../plainWords'

const base = { total: 4, onlyMyBids: false, mine: 4, query: '', clearQuery: vi.fn(), showEveryBid: vi.fn() }

describe('bidPickerEmptyWords', () => {
  it('no bids at all: New Bid through the Bids page deep link', () => {
    expect(bidPickerEmptyWords({ ...base, total: 0, mine: 0 })).toEqual({ main: 'No bids yet.', next: { label: 'New Bid', to: NEW_BID_PATH }, tail: 'adds the first.' })
    expect(NEW_BID_PATH).toBe('/bids?newBid=true')
  })

  it('only my bids hides every bid: Show every bid turns the switch off', () => {
    const showEveryBid = vi.fn()
    const words = bidPickerEmptyWords({ ...base, onlyMyBids: true, mine: 0, query: 'Ridgeway', showEveryBid })
    expect(words).toEqual({ main: BID_PICKER_NONE_NAME_YOU, next: { label: 'Show every bid', onPress: showEveryBid } })
    expect(plainWordsFailures(BID_PICKER_NONE_NAME_YOU)).toEqual([])
  })

  it('a search with no match quotes it and offers Clear the search', () => {
    const clearQuery = vi.fn()
    expect(bidPickerEmptyWords({ ...base, query: ' Ridgeway ', clearQuery })).toEqual({ main: 'No bids match ‘Ridgeway’.', next: { label: 'Clear the search', onPress: clearQuery }, tail: undefined })
    expect(bidPickerEmptyWords({ ...base, onlyMyBids: true, mine: 2, query: 'Ridgeway', clearQuery })?.main).toBe('No bids match ‘Ridgeway’.')
  })

  it('while only my bids is on, the search also offers Show every bid (v2.5986)', () => {
    const clearQuery = vi.fn()
    const showEveryBid = vi.fn()
    expect(bidPickerEmptyWords({ ...base, onlyMyBids: true, mine: 2, query: 'Ridgway', clearQuery, showEveryBid })).toEqual({
      main: 'No bids match ‘Ridgway’.',
      next: { label: 'Clear the search', onPress: clearQuery },
      tail: undefined,
      orNext: { label: 'Show every bid', onPress: showEveryBid },
    })
    expect(bidPickerEmptyWords({ ...base, query: 'Ridgway', clearQuery, showEveryBid })?.orNext).toBeUndefined()
  })

  it('is nothing when none of the three explains the empty list', () => {
    expect(bidPickerEmptyWords(base)).toBeNull()
  })
})
