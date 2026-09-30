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

  it('a sent bid names the day it was sent and the Lost door', () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12' }), ME, 'dev')).toBe(
      'Sent Sep 12, 2026. A sent bid is already off the working board. If it is dead, mark it Lost in Outcome.',
    )
  })

  it('a sent date stored as a timestamp still reads as its calendar day', () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12T15:00:00+00:00' }), ME, 'dev')).toMatch(
      /^Sent Sep 12, 2026\./,
    )
  })

  it('a terminal outcome is named in the words the board uses', () => {
    expect(archiveFromBoardBlockedReason(bid({ outcome: 'won' }), ME, 'dev')).toBe(
      'This bid is Won. It left the working board when its outcome was set.',
    )
    expect(archiveFromBoardBlockedReason(bid({ outcome: 'started_or_complete' }), ME, 'dev')).toMatch(
      /^This bid is Started or complete\./,
    )
  })

  it("the sent reason wins over the outcome, so a sent-and-lost bid says sent", () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12', outcome: 'lost' }), ME, 'dev')).toMatch(/^Sent/)
  })

  it('an unsent bid that is not yours says who can, unless you are a dev', () => {
    expect(archiveFromBoardBlockedReason(bid(), ME, 'assistant')).toBe(
      "Only this bid's estimator or account man can archive it. Ask them, or a dev.",
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
