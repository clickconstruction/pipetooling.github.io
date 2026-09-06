import { describe, expect, it } from 'vitest'
import { tallyStaleGloss } from './tallyStaleGloss'
import { buildNeedsYouItems, needsYouClickTarget, type NeedsYouInputs } from '../dashboardNeedsYou'

function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'dev',
    arBankUnallocatedCount: 0,
    arBankEnabled: false,
    tallyStaleUnlinkedCount: 0,
    tallyStaffStalePeopleCount: 0,
    tallyStaffStaleTxCount: 0,
    tallyStaffEligible: false,
    tallyMinAgeDays: 2,
    lostBidNudge: null,
    lostBidNudgeLoading: false,
    teamReviewsOverdue: [],
    teamReviewCadenceDays: 30,
    roadmapNudges: [],
    jobFollowupsEnabled: false,
    jobFollowupCount: 0,
    jobFollowupStageCounts: null,
    gcReviewEnabled: false,
    gcReviewStatus: null,
    gcReviewNudge: null,
    gcReviewIsWednesday: false,
    bulkDeleteAlerts: null,
    claimDevRefusedCount: null,
    claimDevLookbackDays: 7,
    robotAuditsEnabled: false,
    robotAuditsPending: 0,
    d22UncodedEnabled: false,
    d22UncodedCount: 0,
    ...overrides,
  } as NeedsYouInputs
}

describe('tallyStaleGloss', () => {
  it('says the card figure in the page header, with the age floor', () => {
    expect(tallyStaleGloss(100, 2)).toBe('100 over 2 days old')
    expect(tallyStaleGloss(1, 1)).toBe('1 over 1 day old')
    expect(tallyStaleGloss(0, 2)).toBe('none over 2 days old')
    expect(tallyStaleGloss(null, 2)).toBeNull()
  })
})

describe('tally card ↔ /tally parity (one hook, two surfaces)', () => {
  it('the card figure and the page gloss are the same number; the page total rides the click', () => {
    const staleUnlinked = 100
    const unlinked = 105
    const card = buildNeedsYouItems(inputs({ tallyStaleUnlinkedCount: staleUnlinked, tallyUnlinkedCount: unlinked })).find(
      (i) => i.key === 'tally-self',
    )
    expect(card).toBeDefined()
    expect(card!.figure).toBe(String(staleUnlinked))
    // Each side carries the other's number in its own words.
    expect(card!.detail).toContain('105 unlinked in all')
    expect(tallyStaleGloss(staleUnlinked, 2)).toBe(`${card!.figure} over 2 days old`)
    expect(card!.destinationFigure).toBe(String(unlinked))
    expect(needsYouClickTarget(card!)).toBe('#tally-self&dest=105')
  })

  it('when every unlinked row is over the floor the two sides already agree — no dest gloss', () => {
    const card = buildNeedsYouItems(inputs({ tallyStaleUnlinkedCount: 7, tallyUnlinkedCount: 7 })).find((i) => i.key === 'tally-self')
    expect(card!.detail).not.toContain('in all')
    expect(card!.destinationFigure).toBeUndefined()
    expect(needsYouClickTarget(card!)).toBe('#tally-self')
  })

  it('a still-loading total adds no gloss (never a wrong number)', () => {
    const card = buildNeedsYouItems(inputs({ tallyStaleUnlinkedCount: 7, tallyUnlinkedCount: null })).find((i) => i.key === 'tally-self')
    expect(card!.detail).not.toContain('in all')
    expect(card!.destinationFigure).toBeUndefined()
  })
})
