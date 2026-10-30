import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import type { WhatWaited } from './messages/whatWaited'
import { NEEDS_YOU_ITEM_ACTOR } from './needsYouActor'
import { needsYouDoor } from './needsYouDoors'
import { needsYouSourceEnabled } from './needsYouSources'
import { plainWordsFailures } from './plainWords'

/**
 * While you were off (v2.6060, punch list #141 PR 4): the Needs you line that lists the pushes the viewer's own Push me
 * hours held, as `useWhileOff` hands it in. Its own file, as the Customers line has.
 */
function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'helpers',
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

/** The mock-up's Dashboard at 6 AM: three replies and a work order waited; Evan answered Dana meanwhile. */
const mockup: WhatWaited = {
  count: 4,
  title: 'While you were off: 3 replies and a work order waited',
  detail: 'Since 8 PM. Evan answered Dana at 11:50 PM.',
  first: { contactId: 'dana', messageId: 'm1' },
}
const line = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ whileOffEnabled: true, ...over })).find((i) => i.key === 'while-off')

describe('while-off (v2.6060, punch list #141 PR 4)', () => {
  it('draws the line as the hook hands it in, amber, with See them', () => {
    expect(line({ whileOff: mockup })).toMatchObject({
      severity: 'amber',
      kicker: 'Push me',
      title: mockup.title,
      detail: mockup.detail,
      figure: '4',
      actionLabel: 'See them',
    })
    const item = line({ whileOff: mockup })!
    expect(plainWordsFailures(item.title)).toEqual([])
    expect(plainWordsFailures(item.detail)).toEqual([])
  })

  it('draws nothing while off, with nothing read, or with nothing waiting', () => {
    expect(line({ whileOffEnabled: false, whileOff: mockup })).toBeUndefined()
    expect(line({ whileOff: null })).toBeUndefined()
    expect(line({ whileOff: { ...mockup, count: 0 } })).toBeUndefined()
  })

  it('sits with the Customers line, is the viewer’s own, and is read for everyone who signs in on both hosts', () => {
    expect(NEEDS_YOU_RANK['while-off']).toBe(NEEDS_YOU_RANK['customer-messages'])
    expect(NEEDS_YOU_ITEM_ACTOR['while-off']).toBe('anyone')
    for (const role of ['helpers', 'primary', 'estimator', 'assistant', 'master_technician', 'dev'] as const) {
      expect(needsYouSourceEnabled('whileOff', role, 'dashboard')).toBe(true)
      expect(needsYouSourceEnabled('whileOff', role, 'quickfill')).toBe(true)
    }
    expect(needsYouSourceEnabled('whileOff', null, 'dashboard')).toBe(false)
  })

  it('opens the first line still waiting, at the line, and Messages when none was read', () => {
    expect(needsYouDoor({ key: 'while-off' }, { role: 'helpers', whileOffFirst: mockup.first }, 'dashboard')).toEqual({ kind: 'href', href: '/messages?thread=dana&at=m1' })
    expect(needsYouDoor({ key: 'while-off' }, { role: 'helpers', whileOffFirst: null }, 'quickfill')).toEqual({ kind: 'href', href: '/messages' })
  })
})
