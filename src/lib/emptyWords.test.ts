import { describe, expect, it } from 'vitest'
import { emptyWords, emptyWordsWithPress, type EmptyWordsInput } from './emptyWords'
import { plainWordsFailures } from './plainWords'

const ONE_OF_EACH: EmptyWordsInput[] = [
  { kind: 'make', noun: 'bids', control: 'New Bid' },
  { kind: 'filter', noun: 'bids', query: 'Ridgeway' },
  { kind: 'filter', noun: 'purchase orders', query: '  ' },
  { kind: 'waiting', who: 'dispatch' },
  { kind: 'data', noun: 'sessions', page: { label: 'Clock in', tail: 'starts the first.' } },
]

describe('emptyWords: the four kinds', () => {
  it('make: what is missing, the control that adds the first, the words after it', () => {
    expect(emptyWords({ kind: 'make', noun: 'bids', control: 'New Bid' })).toEqual({ main: 'No bids yet.', next: 'New Bid', tail: 'adds the first.' })
    expect(emptyWords({ kind: 'make', noun: 'checklist items', control: 'Add item' }).main).toBe('No checklist items yet.')
  })

  it('filter: quotes the search in curly quotes and offers Clear the search', () => {
    expect(emptyWords({ kind: 'filter', noun: 'bids', query: 'Ridgeway' })).toEqual({ main: 'No bids match ‘Ridgeway’.', next: 'Clear the search', tail: '' })
    expect(emptyWords({ kind: 'filter', noun: 'bids', query: '  Ridgeway  ' }).main).toBe('No bids match ‘Ridgeway’.')
  })

  it('filter with no search text: the filters hide the rows, and the press clears them', () => {
    expect(emptyWords({ kind: 'filter', noun: 'purchase orders', query: '' })).toEqual({ main: 'No purchase orders match the filters.', next: 'Clear the filters', tail: '' })
  })

  it('waiting: the good state, named for who the list would wait on, with no press', () => {
    expect(emptyWords({ kind: 'waiting', who: 'dispatch' })).toEqual({ main: 'Nothing waiting on dispatch.', next: '', tail: '' })
    expect(emptyWords({ kind: 'waiting', who: 'you' }).main).toBe('Nothing waiting on you.')
    expect(emptyWords({ kind: 'waiting', who: 'an estimator' }).main).toBe('Nothing waiting on an estimator.')
  })

  it('data: what is missing and the page that fills it, its tail optional', () => {
    expect(emptyWords({ kind: 'data', noun: 'sessions', page: { label: 'Clock in', tail: 'starts the first.' } })).toEqual({ main: 'No sessions yet.', next: 'Clock in', tail: 'starts the first.' })
    expect(emptyWords({ kind: 'data', noun: 'blocks', page: { label: 'Schedule' } })).toEqual({ main: 'No blocks yet.', next: 'Schedule', tail: '' })
  })

  it('every kind reads in plain words: under 20 words, no dash, semicolon or parenthesis', () => {
    for (const input of ONE_OF_EACH) {
      const words = emptyWords(input)
      expect(plainWordsFailures(words.main), words.main).toEqual([])
      expect(plainWordsFailures(`${words.main} ${words.next} ${words.tail}`.trim()), words.main).toEqual([])
    }
  })
})

describe('emptyWordsWithPress: the shape EmptyState takes', () => {
  it('attaches a handler or a page to the press, and drops an empty tail', () => {
    const onPress = () => {}
    expect(emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'bids', query: 'Ridgeway' }), { onPress })).toEqual({ main: 'No bids match ‘Ridgeway’.', next: { label: 'Clear the search', onPress }, tail: undefined })
    expect(emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'bids', control: 'New Bid' }), { to: '/bids?newBid=true' })).toEqual({ main: 'No bids yet.', next: { label: 'New Bid', to: '/bids?newBid=true' }, tail: 'adds the first.' })
  })

  it('a kind with no press stays main alone', () => {
    expect(emptyWordsWithPress(emptyWords({ kind: 'waiting', who: 'you' }), { onPress: () => {} })).toEqual({ main: 'Nothing waiting on you.', next: undefined, tail: undefined })
  })
})
