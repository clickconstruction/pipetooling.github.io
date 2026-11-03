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

  it('the sent reason wins over the outcome, and a sent-and-lost bid says it is already off the working piles', () => {
    expect(archiveFromBoardBlockedReason(bid({ bid_date_sent: '2026-09-12', outcome: 'lost' }), ME, 'dev')).toBe(
      'Archive is for bids that have not been sent. This one was sent Sep 12, 2026 and is Lost, so it is already off the working piles. Nothing to archive.',
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

describe('archiveFromBoardBlockedReason · a bid with GC packets (BP391, 2026-11-02)', () => {
  // On a bid with versions the Win / Loss segment is locked ("set per GC"), so the old words
  // pointed Grace at a dead control. The door is each GC's card in the Sent panel.
  const sent = (overrides: Partial<BidWithBuilder> = {}) =>
    bid({ bid_date_sent: '2026-09-01', estimator_id: ME, account_manager_id: ME, ...overrides })
  const real = (outcome: string | null) => ({ outcome, sentOn: '2026-09-01' as string | null })
  const shared = { outcome: null, sentOn: '2026-09-01' as string | null, sharedLetter: true }

  it('names the GC cards, not the locked Win / Loss segment, while a GC is still waiting', () => {
    expect(archiveFromBoardBlockedReason(sent(), ME, 'estimator', {}, [real('lost'), real(null), shared])).toBe(
      "Archive is for bids that have not been sent. This one was sent Sep 1, 2026. To archive it, press Un-send… on each GC's card in the Sent panel first. If the bid is dead, press Lost… on each GC's card instead. The bid moves to Lost once every GC has said no.",
    )
  })

  it('every GC said no but the bid still reads open: it belongs in Lost, and the words name the press that moves it', () => {
    expect(archiveFromBoardBlockedReason(sent(), ME, 'estimator', {}, [real('lost'), real('lost'), shared])).toBe(
      "Archive is for bids that have not been sent. This one was sent Sep 1, 2026. Every GC on it has said no, so it belongs in Lost, not the archive. Press ↩ waiting and then Lost… on one GC's card and the bid moves to Lost.",
    )
  })

  it('a sent bid that is already Lost: off the working piles, nothing to archive — packets or not', () => {
    expect(archiveFromBoardBlockedReason(sent({ outcome: 'lost' }), ME, 'estimator', {}, [real('lost'), real('lost'), shared])).toBe(
      'Archive is for bids that have not been sent. This one was sent Sep 1, 2026 and is Lost, so it is already off the working piles. Nothing to archive.',
    )
  })

  it('with no real packet (no versions) the sent words still point at Bid Date Sent and Win / Loss', () => {
    const noVersions = 'Archive is for bids that have not been sent. This one was sent Sep 1, 2026. To archive it, clear its Bid Date Sent first. If the bid is dead, set Win / Loss to Lost instead.'
    expect(archiveFromBoardBlockedReason(sent(), ME, 'estimator')).toBe(noVersions)
    expect(archiveFromBoardBlockedReason(sent(), ME, 'estimator', {}, [])).toBe(noVersions)
    expect(archiveFromBoardBlockedReason(sent(), ME, 'estimator', {}, [shared])).toBe(noVersions)
  })
})
