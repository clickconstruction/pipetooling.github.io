import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { needsYouSourceEnabled } from './needsYouSources'

/**
 * The Permits skim's line (punch list #302): permits waiting on a keep or a pass, as one Needs you line with its door.
 * Its own file, as the GC follow-up line has: two cards' tests at the shared file's end conflict.
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

const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ permitSkimEnabled: true, ...over })).find((i) => i.key === 'permits-to-skim')

describe('permits-to-skim (punch list #302)', () => {
  it('says how many wait and how long the oldest has, with the count as its figure', () => {
    expect(card({ permitSkim: { waiting: 14, oldestDays: 3 } })).toMatchObject({
      severity: 'amber',
      kicker: 'Permits',
      title: '14 permits wait on a skim',
      detail: 'The oldest has waited 3 days. About a minute.',
      figure: '14',
      actionLabel: 'Skim them',
    })
  })

  it('stays off when nothing waits, when the read has no answer and when the source is off', () => {
    expect(card({ permitSkim: { waiting: 0, oldestDays: null } })).toBeUndefined()
    expect(card({ permitSkim: null })).toBeUndefined()
    expect(buildNeedsYouItems(inputs({ permitSkimEnabled: false, permitSkim: { waiting: 5, oldestDays: 1 } })).some((i) => i.key === 'permits-to-skim')).toBe(false)
  })

  it('is read by the office and the estimators on the Dashboard, and held off Quickfill', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) expect(needsYouSourceEnabled('permitSkim', role, 'dashboard')).toBe(true)
    expect(needsYouSourceEnabled('permitSkim', 'helpers', 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('permitSkim', 'assistant', 'quickfill')).toBe(false)
  })
})
