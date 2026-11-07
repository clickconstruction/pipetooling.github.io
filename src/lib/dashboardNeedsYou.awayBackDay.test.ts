import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { needsYouDoor } from './needsYouDoors'
import { needsYouSourceEnabled } from './needsYouSources'
import { plainWordsFailures } from './plainWords'
import type { AwayBackDayNeed } from './people/awayBackDay'

/**
 * The day back (punch list #256 PR 9, v2.6590): the Needs you line for an Away note whose countdown has ended, as
 * `useAwayBackDay` hands it in. Its own file, as the While you were off line has.
 */
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

const need: AwayBackDayNeed = { count: 1, first: { userId: 'u-c', displayName: 'Corinne Vela' }, title: "Corinne Vela's countdown ended today.", detail: 'They left Nov 3, 2026. Bring them back, or leave the note up.' }

describe('Needs you · the day back (punch list #256 PR 9)', () => {
  it('draws the line with the kernel’s words, the count and Bring back…, in the people tier', () => {
    const items = buildNeedsYouItems(inputs({ awayBackDayEnabled: true, awayBackDay: need }))
    const item = items.find((i) => i.key === 'away-back-day')
    expect(item).toMatchObject({ severity: 'blue', kicker: 'Away', title: need.title, detail: need.detail, figure: '1', actionLabel: 'Bring back…' })
    expect(NEEDS_YOU_RANK['away-back-day']).toBe(30)
    expect(plainWordsFailures(`${item!.title} ${item!.detail}`)).toEqual([])
  })

  it('stays off while the source is off or nobody’s day has come', () => {
    expect(buildNeedsYouItems(inputs({ awayBackDayEnabled: false, awayBackDay: need })).find((i) => i.key === 'away-back-day')).toBeUndefined()
    expect(buildNeedsYouItems(inputs({ awayBackDayEnabled: true, awayBackDay: null })).find((i) => i.key === 'away-back-day')).toBeUndefined()
  })

  it('the door opens the first teammate’s desk with Bring back up, else the archived list', () => {
    expect(needsYouDoor({ key: 'away-back-day' }, { role: 'dev', awayBackFirstUserId: 'u-c' }, 'dashboard')).toEqual({ kind: 'href', href: '/people?tab=users&person=u:u-c&flow=bring_back' })
    expect(needsYouDoor({ key: 'away-back-day' }, { role: 'dev' }, 'quickfill')).toEqual({ kind: 'href', href: '/people?tab=users&archived=1' })
  })

  it('the source is the office set’s on both hosts, and no one else’s', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller'] as const) {
      expect(needsYouSourceEnabled('awayBackDay', role, 'dashboard'), role).toBe(true)
      expect(needsYouSourceEnabled('awayBackDay', role, 'quickfill'), role).toBe(true)
    }
    for (const role of ['helpers', 'estimator', 'subcontractor', 'primary', 'superintendent', null] as const) {
      expect(needsYouSourceEnabled('awayBackDay', role, 'dashboard'), String(role)).toBe(false)
    }
  })
})
