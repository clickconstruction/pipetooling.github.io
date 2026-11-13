import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { MAIL_SAVED_DOOR, MAIL_SAVED_WORDS } from './myMail/savedForYou'
import { needsYouDoor } from './needsYouDoors'
import { NEEDS_YOU_SOURCES, needsYouSourceEnabled } from './needsYouSources'

/**
 * The owner is told (v2.7068): the Needs you line that says someone else saved the viewer's mail onto a job, as
 * `useMailSavedForYou` hands it in. Its own file, as While you were off has.
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

describe('the line on the Needs you card', () => {
  const need = { count: 2, title: 'Nadia Reyes saved 17 conversations from your mail to 7 jobs.', detail: 'It was today at 3:05 PM. Nothing changed in your Gmail.' }
  const line = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ mailSavedEnabled: true, ...over })).find((i) => i.key === 'mail-saved')

  it('is news with nothing to do: blue, in the notice’s own words, with a door to the person’s own record', () => {
    const item = line({ mailSaved: need })!
    expect(item).toMatchObject({ key: 'mail-saved', severity: 'blue', kicker: MAIL_SAVED_WORDS.kicker, title: need.title, detail: need.detail, figure: '2', actionLabel: MAIL_SAVED_WORDS.action })
    expect(needsYouDoor(item, { role: 'helpers' }, 'dashboard')).toEqual({ kind: 'href', href: MAIL_SAVED_DOOR })
    expect(MAIL_SAVED_DOOR).toBe('/settings?tab=settings-recent-push#settings-recent-push')
  })

  it('draws nothing when the source is off or there is no notice', () => {
    expect(line({ mailSavedEnabled: false, mailSaved: need })).toBeUndefined()
    expect(line({ mailSaved: null })).toBeUndefined()
    expect(line({ mailSaved: { ...need, count: 0 } })).toBeUndefined()
  })

  it('is on for every role, the field roles too, on the Dashboard and on Quickfill, and for nobody signed out', () => {
    expect(NEEDS_YOU_SOURCES).toContain('mailSaved')
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(needsYouSourceEnabled('mailSaved', role, 'dashboard'), role).toBe(true)
    }
    expect(needsYouSourceEnabled('mailSaved', null, 'dashboard')).toBe(false)
  })
})
