import { describe, expect, it } from 'vitest'
import { placementBidIdsSafeToDelete, type PlacementCleanupBid } from './workingBoardPlacementCleanup'

const USER = 'u1'

function bid(partial: Partial<PlacementCleanupBid> & { id: string }): PlacementCleanupBid {
  return {
    bid_date_sent: null,
    outcome: null,
    estimator_id: USER,
    account_manager_id: null,
    ...partial,
  }
}

describe('placementBidIdsSafeToDelete', () => {
  it('NEVER deletes placements whose bid is absent from the confirmation fetch (the 2026-08-04 trade-filter incident)', () => {
    // Filtered/partial/RLS-hidden bid lists reach the kernel as "absent" — kept.
    expect(placementBidIdsSafeToDelete(['b1', 'b2'], [], USER)).toEqual([])
    expect(placementBidIdsSafeToDelete(['b1', 'b2'], [bid({ id: 'b1', bid_date_sent: '2026-08-01' })], USER)).toEqual(['b1'])
  })

  it('keeps placements for eligible bids still assigned to the user', () => {
    const bids = [
      bid({ id: 'b1' }), // estimator
      bid({ id: 'b2', estimator_id: 'someone-else', account_manager_id: USER }), // account manager
    ]
    expect(placementBidIdsSafeToDelete(['b1', 'b2'], bids, USER)).toEqual([])
  })

  it('deletes placements for sent bids', () => {
    expect(placementBidIdsSafeToDelete(['b1'], [bid({ id: 'b1', bid_date_sent: '2026-08-01' })], USER)).toEqual(['b1'])
  })

  it('deletes placements for terminal outcomes', () => {
    const bids = [
      bid({ id: 'b1', outcome: 'won' }),
      bid({ id: 'b2', outcome: 'lost' }),
      bid({ id: 'b3', outcome: 'started_or_complete' }),
      bid({ id: 'b4', outcome: 'weird_future_outcome' }), // non-terminal outcome stays
    ]
    expect(placementBidIdsSafeToDelete(['b1', 'b2', 'b3', 'b4'], bids, USER)).toEqual(['b1', 'b2', 'b3'])
  })

  it('deletes placements for bids reassigned away from the user', () => {
    const bids = [bid({ id: 'b1', estimator_id: 'someone-else', account_manager_id: 'another' })]
    expect(placementBidIdsSafeToDelete(['b1'], bids, USER)).toEqual(['b1'])
  })

  it('dedupes repeated placement ids and handles empty input', () => {
    expect(placementBidIdsSafeToDelete([], [], USER)).toEqual([])
    expect(placementBidIdsSafeToDelete(['b1', 'b1'], [bid({ id: 'b1', outcome: 'won' })], USER)).toEqual(['b1'])
  })
})
