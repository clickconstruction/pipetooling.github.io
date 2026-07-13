import { describe, expect, it } from 'vitest'
import { compareBidsForBidBoardDueDate } from './compareBidsForBidBoardDueDate'

describe('compareBidsForBidBoardDueDate', () => {
  it('puts dated due dates before unmarked', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'b', bid_due_date: '2026-02-01' },
        { id: 'a', bid_due_date: null },
      ),
    ).toBeLessThan(0)
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'a', bid_due_date: null },
        { id: 'b', bid_due_date: '  ' },
      ),
    ).toBeLessThan(0)
  })

  it('orders dates oldest first', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'a', bid_due_date: '2026-03-01' },
        { id: 'b', bid_due_date: '2026-01-15' },
      ),
    ).toBeGreaterThan(0)
  })

  it('uses id when same due date', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'm', bid_due_date: '2026-01-01' },
        { id: 'n', bid_due_date: '2026-01-01' },
      ),
    ).toBeLessThan(0)
  })

  it('same day: earlier due time first', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'z', bid_due_date: '2026-01-01', bid_due_time: '10:00' },
        { id: 'a', bid_due_date: '2026-01-01', bid_due_time: '14:00' },
      ),
    ).toBeLessThan(0)
  })

  it('same day: bids with a due time come before bids without one', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'z', bid_due_date: '2026-01-01', bid_due_time: '14:00' },
        { id: 'a', bid_due_date: '2026-01-01' },
      ),
    ).toBeLessThan(0)
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'a', bid_due_date: '2026-01-01', bid_due_time: null },
        { id: 'z', bid_due_date: '2026-01-01', bid_due_time: '08:00' },
      ),
    ).toBeGreaterThan(0)
  })

  it('due time never outranks the date', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'a', bid_due_date: '2026-01-02', bid_due_time: '06:00' },
        { id: 'b', bid_due_date: '2026-01-01' },
      ),
    ).toBeGreaterThan(0)
  })

  it('same day and same time falls back to id', () => {
    expect(
      compareBidsForBidBoardDueDate(
        { id: 'm', bid_due_date: '2026-01-01', bid_due_time: '10:00' },
        { id: 'n', bid_due_date: '2026-01-01', bid_due_time: '10:00' },
      ),
    ).toBeLessThan(0)
  })
})
