import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { needsYouDoor } from './needsYouDoors'
import { needsYouSourceEnabled } from './needsYouSources'

/**
 * Looks like a customer on Needs you (punch list #307): the names on permits that may be one of our customers, as one
 * line with its door. Its own file, as the Permits skim's line has: two cards' tests at the shared file's end conflict.
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

const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ lookAlikesEnabled: true, ...over })).find((i) => i.key === 'permit-look-alikes')

describe('permit-look-alikes (punch list #307)', () => {
  it('says how many names look like a customer, with the count as its figure', () => {
    expect(card({ lookAlikes: { count: 14 } })).toMatchObject({
      severity: 'gray',
      kicker: 'Permits',
      title: '14 names on permits look like a customer',
      detail: 'Answer each once. Nothing is tied until you press.',
      figure: '14',
      actionLabel: 'Answer them',
    })
    expect(card({ lookAlikes: { count: 1 } })?.title).toBe('1 name on permits looks like a customer')
  })

  it('adds every city’s chip and says where they wait', () => {
    expect(card({ lookAlikes: { count: 108, byCity: [{ city: 'San Antonio', count: 84 }, { city: 'Austin', count: 24 }] } })).toMatchObject({
      title: '108 names on permits look like a customer',
      detail: 'San Antonio 84 · Austin 24. Answer each once. Nothing is tied until you press.',
      figure: '108',
    })
  })

  it('stays off when no name waits, when the read has no answer and when the source is off', () => {
    expect(card({ lookAlikes: { count: 0 } })).toBeUndefined()
    expect(card({ lookAlikes: null })).toBeUndefined()
    expect(buildNeedsYouItems(inputs({ lookAlikesEnabled: false, lookAlikes: { count: 5 } })).some((i) => i.key === 'permit-look-alikes')).toBe(false)
  })

  it('ranks with the records to fill in, under the permits that wait on a skim', () => {
    expect(NEEDS_YOU_RANK['permit-look-alikes']).toBeGreaterThan(NEEDS_YOU_RANK['permits-to-skim'])
    const keys = buildNeedsYouItems(inputs({ lookAlikesEnabled: true, lookAlikes: { count: 14 }, permitSkimEnabled: true, permitSkim: { waiting: 3, oldestDays: 1 } })).map((i) => i.key)
    expect(keys.indexOf('permits-to-skim')).toBeLessThan(keys.indexOf('permit-look-alikes'))
  })

  it('is read by the people who may answer on a name, on the Dashboard, and held off Quickfill', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) expect(needsYouSourceEnabled('lookAlikes', role, 'dashboard')).toBe(true)
    for (const role of ['helpers', 'primary', 'superintendent', 'subcontractor', null] as const) expect(needsYouSourceEnabled('lookAlikes', role, 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('lookAlikes', 'assistant', 'quickfill')).toBe(false)
  })

  it('opens Builders with the Looks like a customer chip on, in the city that has some', () => {
    const item = card({ lookAlikes: { count: 14 } })!
    expect(needsYouDoor(item, { role: 'assistant', lookAlikeCity: 'Austin' }, 'dashboard')).toEqual({ kind: 'href', href: '/prospects?tab=permits&view=builders&looks=1&city=Austin' })
    expect(needsYouDoor(item, { role: 'assistant' }, 'dashboard')).toEqual({ kind: 'href', href: '/prospects?tab=permits&view=builders&looks=1' })
  })
})
