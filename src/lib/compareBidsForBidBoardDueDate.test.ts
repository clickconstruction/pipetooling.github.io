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
})
