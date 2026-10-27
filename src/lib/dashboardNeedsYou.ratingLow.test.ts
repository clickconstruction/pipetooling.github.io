import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { NEEDS_YOU_ITEM_ACTOR } from './needsYouActor'
import { needsYouDoor } from './needsYouDoors'
import { plainWordsFailures } from './plainWords'
import type { LowRatingsNeed } from './ratings/ratingsOffice'

/**
 * The review ask's line (v2.5946, punch list #185 PR 4): a customer who left three stars or fewer and nobody has called.
 * Its own file, as the Customers line has: two cards' tests at the shared file's end conflict.
 */
function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'assistant',
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
    robotLockedShadows: null,
    d22UncodedEnabled: false,
    d22UncodedCount: 0,
    lienUnconditionalEnabled: false,
    lienUnconditionalOwed: null,
    lienWaiversToSignEnabled: false,
    lienWaiversToSign: null,
    demandDeadlineEnabled: false,
    demandDeadlineOverdue: null,
    lienWatchEnabled: false,
    lienWatch: null,
    hoursApprovalsEnabled: false,
    hoursApprovals: null,
    hoursApprovalsMinAgeDays: 3,
    labelApprovalsEnabled: false,
    labelApprovals: null,
    labelApprovalsMinAgeDays: 3,
    ...overrides,
  }
}

const one: LowRatingsNeed = { count: 1, first: { ratingId: 'r-1', contactId: 'c-dana', jobId: 'job-1312', name: 'Dana', score: 2, words: 'The floor was left a mess.' } }
const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ lowRatingsEnabled: true, ...over })).find((i) => i.key === 'rating-low')

describe('rating-low (v2.5946, punch list #185)', () => {
  it('names the customer, the stars and the job, under Customers, with their words', () => {
    expect(card({ lowRatings: { need: one, jobWord: 'job 1312' } })).toMatchObject({
      severity: 'amber',
      kicker: 'Customers',
      title: 'Dana left 2 stars on job 1312',
      detail: '“The floor was left a mess.” Call them today.',
      figure: '1',
      actionLabel: 'Open their thread',
    })
  })

  it('counts several and names the first', () => {
    expect(card({ lowRatings: { need: { ...one, count: 3 }, jobWord: null } })).toMatchObject({ title: '3 customers left three stars or fewer', figure: '3', actionLabel: 'Open the first' })
  })

  it('shows nothing when off, loading, or with none owed', () => {
    expect(card({ lowRatingsEnabled: false, lowRatings: { need: one, jobWord: null } })).toBeUndefined()
    expect(card({ lowRatings: null })).toBeUndefined()
    expect(card({ lowRatings: { need: { count: 0, first: null }, jobWord: null } })).toBeUndefined()
  })

  it('sits in the revenue chasing tier beside the Customers line, is anyone’s, and opens the first one’s thread', () => {
    expect(NEEDS_YOU_RANK['rating-low']).toBe(NEEDS_YOU_RANK['customer-messages'])
    expect(NEEDS_YOU_ITEM_ACTOR['rating-low']).toBe('anyone')
    expect(needsYouDoor({ key: 'rating-low' }, { role: 'assistant', lowRatingContactId: 'c-dana' }, 'dashboard')).toEqual({ kind: 'href', href: '/messages?thread=c-dana' })
    expect(needsYouDoor({ key: 'rating-low' }, { role: 'assistant' }, 'dashboard')).toEqual({ kind: 'href', href: '/messages' })
  })

  it('reads in plain words', () => {
    const c = card({ lowRatings: { need: one, jobWord: 'job 1312' } })!
    for (const w of [c.title, c.detail]) expect(plainWordsFailures(w), w).toEqual([])
  })
})
