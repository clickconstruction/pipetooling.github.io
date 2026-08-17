import { describe, expect, it } from 'vitest'
import { compareBidsForBidBoardDueDate, compareBidsForBidBoardPendingRecency } from './compareBidsForBidBoardDueDate'

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

describe('compareBidsForBidBoardPendingRecency', () => {
  const bid = (id: string, sent: string | null, due: string | null) => ({ id, bid_date_sent: sent, bid_due_date: due })

  it('most recently sent first', () => {
    const rows = [bid('a', '2026-08-01', null), bid('b', '2026-08-15', null), bid('c', '2026-08-10', null)]
    expect([...rows].sort(compareBidsForBidBoardPendingRecency).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('falls back to bid_due_date when sent is missing, interleaved with sent dates', () => {
    const rows = [bid('sent-old', '2026-07-01', null), bid('due-new', null, '2026-08-12'), bid('sent-new', '2026-08-15', null)]
    expect([...rows].sort(compareBidsForBidBoardPendingRecency).map((r) => r.id)).toEqual(['sent-new', 'due-new', 'sent-old'])
  })

  it('rows with neither date sort last, stable by id', () => {
    const rows = [bid('z', null, null), bid('a', null, null), bid('m', '2026-08-01', null)]
    expect([...rows].sort(compareBidsForBidBoardPendingRecency).map((r) => r.id)).toEqual(['m', 'a', 'z'])
  })

  it('sent date wins over a newer due date on the same row', () => {
    const rows = [bid('x', '2026-08-01', '2026-08-20'), bid('y', '2026-08-05', null)]
    expect([...rows].sort(compareBidsForBidBoardPendingRecency).map((r) => r.id)).toEqual(['y', 'x'])
  })
})
