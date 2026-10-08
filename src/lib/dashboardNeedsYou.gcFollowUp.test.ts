import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import type { GcFollowUpNeeds } from './gc/followUpNeeds'

/**
 * GC mode's Follow up (v2.4941): the trade partners' asks to call about a quote, as one Needs you
 * line. Its own file, as the owner records line has: two cards' tests at the shared file's end conflict.
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

const three: GcFollowUpNeeds = {
  count: 3,
  late: true,
  title: '3 calls to make about quotes',
  detail: 'Alamo Concrete is 2 days past the day it gave for its quote. Pecan Valley Electric promised its quote today. And 1 more. Next: call them from Follow up.',
}
const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ gcFollowUpEnabled: true, ...over })).find((i) => i.key === 'gc-follow-up')

describe('gc-follow-up (GC mode, v2.4941)', () => {
  it('says the kernel’s words with the count as its figure, under GC projects', () => {
    expect(card({ gcFollowUp: three })).toMatchObject({
      severity: 'red',
      kicker: 'GC projects',
      title: '3 calls to make about quotes',
      detail: three.detail,
      figure: '3',
      actionLabel: 'Follow up',
    })
  })

  it('is amber when nobody is late', () => {
    expect(card({ gcFollowUp: { ...three, late: false } })?.severity).toBe('amber')
  })

  it('sits in the revenue chasing tier', () => {
    expect(NEEDS_YOU_RANK['gc-follow-up']).toBe(NEEDS_YOU_RANK['bid-followups'])
  })

  it('shows nothing when off, loading or with nobody to call', () => {
    expect(card({ gcFollowUpEnabled: false, gcFollowUp: three })).toBeUndefined()
    expect(card({ gcFollowUp: null })).toBeUndefined()
    expect(card({ gcFollowUp: { ...three, count: 0 } })).toBeUndefined()
  })
})
