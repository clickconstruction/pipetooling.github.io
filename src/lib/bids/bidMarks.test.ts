import { describe, expect, it } from 'vitest'
import {
  bidMarkButtonWords,
  bidMarkCount,
  bidMarkSinceWords,
  isFinishedBidForMark,
  onlyMarkedBids,
  removeBidMarks,
  splitBidMarks,
  toggleBidMark,
  type BidForMark,
} from './bidMarks'

const NOW = new Date(2026, 8, 30, 15, 0, 0) // Wed Sep 30, 2026, local

function bid(over: Partial<BidForMark> & { id: string }): BidForMark {
  return { outcome: null, bid_date_sent: null, working_board_archived_at: null, ...over }
}

describe('toggleBidMark', () => {
  it('makes a mark stamped now, then clears it', () => {
    const made = toggleBidMark({}, 'b1', NOW)
    expect(made.marked).toBe(true)
    expect(made.next).toEqual({ b1: NOW.toISOString() })
    const cleared = toggleBidMark(made.next, 'b1', new Date(NOW.getTime() + 1000))
    expect(cleared.marked).toBe(false)
    expect(cleared.next).toEqual({})
  })

  it('never mutates the map it was given', () => {
    const before = Object.freeze({ b1: '2026-09-28T10:00:00.000Z' })
    const { next } = toggleBidMark(before, 'b2', NOW)
    expect(before).toEqual({ b1: '2026-09-28T10:00:00.000Z' })
    expect(bidMarkCount(next)).toBe(2)
  })

  it('removeBidMarks drops only the ids named and keeps the rest', () => {
    const marks = { a: '1', b: '2', c: '3' }
    expect(removeBidMarks(marks, ['a', 'c'])).toEqual({ b: '2' })
    expect(removeBidMarks(marks, [])).toBe(marks)
  })
})

describe('bidMarkSinceWords', () => {
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString()

  it('today, yesterday, then the weekday inside a week', () => {
    expect(bidMarkSinceWords(at(2026, 8, 30, 8), NOW)).toBe('marked today')
    expect(bidMarkSinceWords(at(2026, 8, 30, 23), NOW)).toBe('marked today')
    expect(bidMarkSinceWords(at(2026, 8, 29), NOW)).toBe('marked yesterday')
    expect(bidMarkSinceWords(at(2026, 8, 25), NOW)).toBe('marked Fri')
    expect(bidMarkSinceWords(at(2026, 8, 24), NOW)).toBe('marked Thu')
  })

  it('a week or more ago prints the date, with the year once it is another year', () => {
    expect(bidMarkSinceWords(at(2026, 8, 23), NOW)).toBe('marked Sep 23')
    expect(bidMarkSinceWords(at(2026, 0, 5), NOW)).toBe('marked Jan 5')
    expect(bidMarkSinceWords(at(2025, 11, 12), NOW)).toBe('marked Dec 12, 2025')
  })

  it('a stamp from the future or one it cannot read never throws', () => {
    expect(bidMarkSinceWords(at(2026, 9, 2), NOW)).toBe('marked today')
    expect(bidMarkSinceWords('nonsense', NOW)).toBe('marked')
  })
})

describe('finished marks', () => {
  it('won, started, lost and archived are finished; unsent and pending are live', () => {
    expect(isFinishedBidForMark(bid({ id: 'u' }))).toBe(false)
    expect(isFinishedBidForMark(bid({ id: 'p', bid_date_sent: '2026-09-20' }))).toBe(false)
    expect(isFinishedBidForMark(bid({ id: 'w', outcome: 'won', bid_date_sent: '2026-09-20' }))).toBe(true)
    expect(isFinishedBidForMark(bid({ id: 'l', outcome: 'lost', bid_date_sent: '2026-09-20' }))).toBe(true)
    expect(isFinishedBidForMark(bid({ id: 'a', working_board_archived_at: '2026-09-01T00:00:00Z' }))).toBe(true)
  })

  it('splitBidMarks sorts the marks on screen and leaves marks on bids not listed alone', () => {
    const marks = { u: '1', w: '2', elsewhere: '3' }
    const bids = [bid({ id: 'u' }), bid({ id: 'w', outcome: 'won', bid_date_sent: '2026-09-20' }), bid({ id: 'n' })]
    expect(splitBidMarks(marks, bids)).toEqual({ live: ['u'], finished: ['w'] })
  })

  it('onlyMarkedBids keeps the marked rows in the order given', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(onlyMarkedBids({ c: '1', a: '2' }, rows).map((r) => r.id)).toEqual(['a', 'c'])
  })
})

describe('bidMarkButtonWords', () => {
  it('reads Mark with no mark and Marked · when with one', () => {
    expect(bidMarkButtonWords({}, 'b1', NOW)).toEqual({ label: 'Mark', since: null })
    expect(bidMarkButtonWords({ b1: new Date(2026, 8, 25, 9).toISOString() }, 'b1', NOW)).toEqual({ label: 'Marked', since: 'Fri' })
  })
})
