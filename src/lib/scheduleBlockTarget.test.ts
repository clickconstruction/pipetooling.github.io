import { describe, expect, it } from 'vitest'
import { bidOpenPath, scheduleBlockTarget } from './scheduleBlockTarget'
import { SCHEDULE_BID_ANCHOR_PREFIX, scheduleBlockAnchorId } from './jobScheduleBlocks'

const UUID = 'b3f790d9-1111-4222-8333-444455556666'

describe('scheduleBlockTarget', () => {
  it('a bare uuid is a job', () => {
    expect(scheduleBlockTarget(UUID)).toEqual({ kind: 'job', id: UUID })
  })

  it('a bid: anchor is a bid, with the prefix stripped', () => {
    expect(scheduleBlockTarget(`bid:${UUID}`)).toEqual({ kind: 'bid', id: UUID })
  })

  it('round-trips the anchor id the hub produces for both block kinds', () => {
    expect(scheduleBlockTarget(scheduleBlockAnchorId({ job_id: UUID, bid_id: null }))).toEqual({ kind: 'job', id: UUID })
    expect(scheduleBlockTarget(scheduleBlockAnchorId({ job_id: null, bid_id: UUID }))).toEqual({ kind: 'bid', id: UUID })
    expect(`bid:`).toBe(SCHEDULE_BID_ANCHOR_PREFIX)
  })

  it('trims whitespace and tolerates the url-encoded form once decoded', () => {
    expect(scheduleBlockTarget(`  bid:${UUID} `)).toEqual({ kind: 'bid', id: UUID })
    expect(scheduleBlockTarget(decodeURIComponent(`bid%3A${UUID}`))).toEqual({ kind: 'bid', id: UUID })
  })

  it('a bare "bid:" with nothing after it is a bid with an empty id (the receiver falls back to the hub)', () => {
    expect(scheduleBlockTarget('bid:')).toEqual({ kind: 'bid', id: '' })
  })
})

describe('bidOpenPath', () => {
  it('builds the Edit Bid deep link the Bids page already honours', () => {
    expect(bidOpenPath(UUID, 'openBidEdit')).toBe(`/bids?bidId=${UUID}&openBidEdit=1`)
  })

  it('returns null for an empty id so a malformed link goes back to the hub', () => {
    expect(bidOpenPath('', 'openBidEdit')).toBeNull()
    expect(bidOpenPath('   ', 'openBidEdit')).toBeNull()
  })
})
