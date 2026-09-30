import { describe, expect, it } from 'vitest'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import {
  archiveFromBoardBlockedReason,
  bidEligibleForWorkingBoardArchive,
  canUserArchiveBidOnWorkingBoard,
} from './workingBoardArchiveEligibility'

const ME = 'user-me'
const OTHER = 'user-other'

function bid(overrides: Partial<BidWithBuilder> = {}): BidWithBuilder {
  return {
    id: 'bid-1',
    bid_date_sent: null,
    outcome: null,
    working_board_archived_at: null,
    estimator_id: OTHER,
    account_manager_id: OTHER,
    ...overrides,
  } as unknown as BidWithBuilder
}

describe('bidEligibleForWorkingBoardArchive', () => {
  it('is unsent and not in a terminal outcome', () => {
    expect(bidEligibleForWorkingBoardArchive(bid())).toBe(true)
    expect(bidEligibleForWorkingBoardArchive(bid({ bid_date_sent: '2026-09-12' }))).toBe(false)
    expect(bidEligibleForWorkingBoardArchive(bid({ outcome: 'won' }))).toBe(false)
    expect(bidEligibleForWorkingBoardArchive(bid({ outcome: 'lost' }))).toBe(false)
    expect(bidEligibleForWorkingBoardArchive(bid({ outcome: 'started_or_complete' }))).toBe(false)
    expect(bidEligibleForWorkingBoardArchive(bid({ outcome: 'pending' }))).toBe(true)
  })
})

describe('canUserArchiveBidOnWorkingBoard', () => {
  it("is the bid's estimator, its account man, or a dev — on an eligible bid", () => {
    expect(canUserArchiveBidOnWorkingBoard(bid({ estimator_id: ME }), ME, 'estimator')).toBe(true)
    expect(canUserArchiveBidOnWorkingBoard(bid({ account_manager_id: ME }), ME, 'master_technician')).toBe(true)
    expect(canUserArchiveBidOnWorkingBoard(bid(), ME, 'dev')).toBe(true)
    expect(canUserArchiveBidOnWorkingBoard(bid(), ME, 'assistant')).toBe(false)
    expect(canUserArchiveBidOnWorkingBoard(bid({ bid_date_sent: '2026-09-12' }), ME, 'dev')).toBe(false)
  })
})

describe('archiveFromBoardBlockedReason', () => {
  it('is null when the press may go ahead', () => {
    expect(archiveFromBoardBlockedReason(bid(), ME, 'dev')).toBeNull()
    expect(archiveFromBoardBlockedReason(bid({ estimator_id: ME }), ME, 'estimator')).toBeNull()
  })

  it('a sent bid says the rule, the day it was sent, the field to clear, and the Lost door', () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12' }), ME, 'dev')).toBe(
      'Archive is for bids that have not been sent. This one was sent Sep 12, 2026. To archive it, clear its Bid Date Sent first. If the bid is dead, set Win / Loss to Lost instead.',
    )
  })

  it('a sent date stored as a timestamp still reads as its calendar day', () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12T15:00:00+00:00' }), ME, 'dev')).toContain(
      'sent Sep 12, 2026.',
    )
  })

  it('a terminal outcome names the Win / Loss segment to press', () => {
    expect(archiveFromBoardBlockedReason(bid({ outcome: 'won' }), ME, 'dev')).toBe(
      'Archive is for open bids. This one is Won. To archive it, set Win / Loss back to Open first.',
    )
    expect(archiveFromBoardBlockedReason(bid({ outcome: 'started_or_complete' }), ME, 'dev')).toContain(
      'This one is Started / Complete.',
    )
  })

  it('the sent reason wins over the outcome, so a sent-and-lost bid says sent', () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12', outcome: 'lost' }), ME, 'dev')).toMatch(
      /^Archive is for bids that have not been sent\./,
    )
  })

  it('an unsent bid that is not yours names who can, and how to make it yours', () => {
    expect(
      archiveFromBoardBlockedReason(bid({ estimator_id: 'u-wendi', account_manager_id: 'u-malachi' }), ME, 'assistant', {
        'u-wendi': 'Wendi',
        'u-malachi': 'Malachi',
      }),
    ).toBe(
      "Only this bid's estimator, Wendi, or its account man, Malachi, can archive it. A dev can too. To archive it yourself, set yourself as its Estimator or Account Man first, or ask one of them.",
    )
  })

  it('without names it still says the roles and the door', () => {
    expect(archiveFromBoardBlockedReason(bid(), ME, 'assistant')).toBe(
      "Only this bid's estimator or its account man can archive it. A dev can too. To archive it yourself, set yourself as its Estimator or Account Man first, or ask one of them.",
    )
    expect(archiveFromBoardBlockedReason(bid(), ME, 'dev')).toBeNull()
  })

  it('an archived bid has no blocked reason — the button is the way back instead', () => {
    expect(archiveFromBoardBlockedReason(bid({ working_board_archived_at: '2026-09-20T10:00:00Z' }), ME, 'assistant')).toBeNull()
  })

  it('no bid or no signed-in user: nothing to say', () => {
    expect(archiveFromBoardBlockedReason(undefined, ME, 'dev')).toBeNull()
    expect(archiveFromBoardBlockedReason(bid(), undefined, 'dev')).toBeNull()
  })
})
