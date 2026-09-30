import { describe, expect, it } from 'vitest'
import {
  BID_PICKER_GROUPS,
  bidPickerGroupKey,
  groupBidsForPicker,
  isBidPickerGroupFolded,
  normalizeBidPickerFolds,
  type BidPickerGroupBid,
} from './bidPickerGroups'

function bid(over: Partial<BidPickerGroupBid> & { id: string }): BidPickerGroupBid {
  return {
    bid_number: null,
    bid_due_date: null,
    bid_date_sent: null,
    bid_value: null,
    outcome: null,
    working_board_archived_at: null,
    ...over,
  }
}

describe('bidPickerGroupKey', () => {
  it('follows the Bid Board rule: outcome first, then sent, else unsent', () => {
    expect(bidPickerGroupKey(bid({ id: 'a', outcome: 'won', bid_date_sent: '2026-09-01' }))).toBe('won')
    expect(bidPickerGroupKey(bid({ id: 'b', outcome: 'started_or_complete', bid_date_sent: null }))).toBe('startedOrComplete')
    expect(bidPickerGroupKey(bid({ id: 'c', outcome: 'lost', bid_date_sent: '2026-09-01' }))).toBe('lost')
    expect(bidPickerGroupKey(bid({ id: 'd', bid_date_sent: '2026-09-01' }))).toBe('pending')
    expect(bidPickerGroupKey(bid({ id: 'e' }))).toBe('unsent')
  })

  it('an unsent bid archived off the working board leaves Unsent / Working for its own group', () => {
    expect(bidPickerGroupKey(bid({ id: 'a', working_board_archived_at: '2026-09-20T00:00:00Z' }))).toBe('archived')
    // The archive flag means nothing once the bid is sent or decided (the board reads it the same way).
    expect(bidPickerGroupKey(bid({ id: 'b', bid_date_sent: '2026-09-01', working_board_archived_at: '2026-09-20T00:00:00Z' }))).toBe('pending')
    expect(bidPickerGroupKey(bid({ id: 'c', outcome: 'lost', working_board_archived_at: '2026-09-20T00:00:00Z' }))).toBe('lost')
  })
})

describe('groupBidsForPicker', () => {
  const rows = [
    bid({ id: 'lost1', bid_number: '470', outcome: 'lost', bid_date_sent: '2026-08-28' }),
    bid({ id: 'won1', bid_number: '479', outcome: 'won', bid_date_sent: '2026-09-11' }),
    bid({ id: 'unsent-low', bid_number: '488', bid_due_date: '2026-10-07' }),
    bid({ id: 'pending1', bid_number: '487', bid_date_sent: '2026-09-26', bid_due_date: '2026-09-20' }),
    bid({ id: 'unsent-high', bid_number: '500', bid_due_date: '2026-09-25' }),
    bid({ id: 'archived1', bid_number: '441', working_board_archived_at: '2026-07-20T00:00:00Z' }),
    bid({ id: 'started1', bid_number: '463', outcome: 'started_or_complete', bid_date_sent: '2026-08-14' }),
  ]

  it('returns the groups in the board order with their counts, empty groups dropped', () => {
    const groups = groupBidsForPicker(rows, 'number')
    expect(groups.map((g) => [g.key, g.label, g.bids.length])).toEqual([
      ['unsent', 'Unsent / Working Bids', 2],
      ['pending', 'Not yet won or lost', 1],
      ['won', 'Won', 1],
      ['startedOrComplete', 'Started or Complete', 1],
      ['lost', 'Lost', 1],
      ['archived', 'Archived (Unsent/Working)', 1],
    ])
  })

  it('drops the groups nothing falls in', () => {
    const groups = groupBidsForPicker(rows.filter((r) => r.outcome === null && !r.working_board_archived_at), 'number')
    expect(groups.map((g) => g.key)).toEqual(['unsent', 'pending'])
    expect(groupBidsForPicker([], 'number')).toEqual([])
  })

  it('sorts inside each group by the picker view and never moves a heading', () => {
    const byNumber = groupBidsForPicker(rows, 'number')
    expect(byNumber[0]?.bids.map((b) => b.id)).toEqual(['unsent-high', 'unsent-low'])
    const byDue = groupBidsForPicker(rows, 'due')
    expect(byDue.map((g) => g.key)).toEqual(byNumber.map((g) => g.key))
    expect(byDue[0]?.bids.map((b) => b.id)).toEqual(['unsent-high', 'unsent-low'])
    // Sorting by sent inside Unsent (nothing is sent) falls back to the bid number, like the flat list did.
    const bySent = groupBidsForPicker(rows, 'sent')
    expect(bySent[0]?.bids.map((b) => b.id)).toEqual(['unsent-high', 'unsent-low'])
  })

  it('does not mutate the rows it is handed', () => {
    const copy = [...rows]
    groupBidsForPicker(rows, 'value')
    expect(rows).toEqual(copy)
  })
})

describe('folds', () => {
  it('Lost and Archived start folded; the working groups start open', () => {
    for (const g of BID_PICKER_GROUPS) {
      expect(isBidPickerGroupFolded({}, g.key)).toBe(g.key === 'lost' || g.key === 'archived')
    }
  })

  it('a stored choice wins over the default, each way', () => {
    expect(isBidPickerGroupFolded({ lost: false }, 'lost')).toBe(false)
    expect(isBidPickerGroupFolded({ won: true }, 'won')).toBe(true)
  })

  it('reads a stored map back defensively', () => {
    expect(normalizeBidPickerFolds(null)).toEqual({})
    expect(normalizeBidPickerFolds('lost')).toEqual({})
    expect(normalizeBidPickerFolds({ lost: false, won: 'yes', bogus: true })).toEqual({ lost: false })
  })
})
