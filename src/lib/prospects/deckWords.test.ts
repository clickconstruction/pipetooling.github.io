import { describe, expect, it } from 'vitest'
import { cardClockTicks, dueChipWords, emptyLaneWords } from './deckWords'

const NOW = Date.UTC(2026, 9, 16, 15, 0, 0)
const daysBack = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('emptyLaneWords', () => {
  it('names the lane and the control that adds to it', () => {
    expect(emptyLaneWords('sub', null)).toEqual({ main: 'Nobody on Subs yet.', door: 'new_prospect', doorLabel: 'New Prospect', tail: 'adds the first company.' })
    expect(emptyLaneWords('gc_lead', null)).toEqual({ main: 'Nobody on Jobs to GC yet.', door: 'new_prospect', doorLabel: 'New Prospect', tail: 'adds the first lead.' })
    expect(emptyLaneWords('customer', null).main).toBe('Nobody on Customers yet.')
  })
  it('on a trade filter, names the trade and offers All subs', () => {
    expect(emptyLaneWords('sub', 'Fire sprinkler')).toEqual({ main: 'No subs for Fire sprinkler.', door: 'all_subs', doorLabel: 'All subs', tail: 'widens the queue.' })
    expect(emptyLaneWords('customer', 'Concrete').door).toBe('new_prospect')
  })
})

describe('dueChipWords', () => {
  it('is nothing while never contacted, or within the first week', () => {
    expect(dueChipWords(null, NOW)).toBeNull()
    expect(dueChipWords(daysBack(0), NOW)).toBeNull()
    expect(dueChipWords(daysBack(6), NOW)).toBeNull()
    expect(dueChipWords('not a date', NOW)).toBeNull()
  })
  it('counts the days from seven on', () => {
    expect(dueChipWords(daysBack(7), NOW)).toBe('Due 7 days')
    expect(dueChipWords(daysBack(231), NOW)).toBe('Due 231 days')
  })
})

describe('cardClockTicks', () => {
  it('ticks only on the deck, in view, with a card up', () => {
    expect(cardClockTicks({ onDeck: true, visible: true, hasCard: true })).toBe(true)
    expect(cardClockTicks({ onDeck: true, visible: true, hasCard: false })).toBe(false)
    expect(cardClockTicks({ onDeck: false, visible: true, hasCard: true })).toBe(false)
    expect(cardClockTicks({ onDeck: true, visible: false, hasCard: true })).toBe(false)
  })
})
