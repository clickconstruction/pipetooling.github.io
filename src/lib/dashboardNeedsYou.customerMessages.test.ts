import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_MESSAGES_HREF,
  CUSTOMER_MESSAGES_LINE_ON,
  NEEDS_YOU_RANK,
  buildNeedsYouItems,
  customerMessagesLine,
  type NeedsYouInputs,
} from './dashboardNeedsYou'
import type { CustomerMessagesCounts } from './followUp/customerCounts'
import { plainWordsFailures } from './plainWords'

/**
 * The Customers line (residential build, R8 · 14): customers who need a reply, what we owe them, and senders to sort, as
 * one Needs you line. Its own file, as the GC projects line has: two cards' tests at the shared file's end conflict.
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

/** The mockup's card 14: 3 need a reply, 1 we owe, 2 to sort. */
const mockup: CustomerMessagesCounts = { needReply: 3, weOwe: 1, toSort: 2 }
const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ customerMessagesEnabled: true, ...over })).find((i) => i.key === 'customer-messages')

describe('customer-messages (residential build, R8 · 14)', () => {
  it('is off until Messages has its page, so the Dashboard passes it disabled and nothing draws', () => {
    expect(CUSTOMER_MESSAGES_LINE_ON).toBe(false)
    expect(card({ customerMessagesEnabled: CUSTOMER_MESSAGES_LINE_ON, customerMessages: mockup })).toBeUndefined()
  })

  it('once on, says Customers with the three counts, under Messages', () => {
    expect(card({ customerMessages: mockup })).toMatchObject({
      severity: 'amber',
      kicker: 'Messages',
      title: 'Customers',
      detail: '3 need a reply, 1 we owe, 2 to sort.',
      figure: '6',
      actionLabel: 'Messages',
    })
  })

  it('drops each count that is zero, and says one in the singular', () => {
    expect(customerMessagesLine({ needReply: 1, weOwe: 0, toSort: 0 })).toBe('1 needs a reply.')
    expect(customerMessagesLine({ needReply: 0, weOwe: 2, toSort: 0 })).toBe('2 we owe.')
    expect(customerMessagesLine({ needReply: 0, weOwe: 0, toSort: 1 })).toBe('1 to sort.')
    expect(customerMessagesLine({ needReply: 4, weOwe: 0, toSort: 1 })).toBe('4 need a reply, 1 to sort.')
    expect(card({ customerMessages: { needReply: 0, weOwe: 1, toSort: 0 } })).toMatchObject({ detail: '1 we owe.', figure: '1' })
  })

  it('shows nothing when off, loading or with all three at zero', () => {
    expect(card({ customerMessagesEnabled: false, customerMessages: mockup })).toBeUndefined()
    expect(card({ customerMessages: null })).toBeUndefined()
    expect(card({ customerMessages: { needReply: 0, weOwe: 0, toSort: 0 } })).toBeUndefined()
  })

  it('sits beside the quiet jobs in the revenue chasing tier', () => {
    expect(NEEDS_YOU_RANK['customer-messages']).toBe(NEEDS_YOU_RANK['job-followups'])
  })

  it('opens Messages on its customers', () => {
    expect(CUSTOMER_MESSAGES_HREF).toBe('/messages?kind=customer')
  })

  it('passes the plain words rules', () => {
    const item = card({ customerMessages: mockup })!
    for (const words of [item.kicker, item.title, item.detail, item.actionLabel]) expect(plainWordsFailures(words)).toEqual([])
  })
})
