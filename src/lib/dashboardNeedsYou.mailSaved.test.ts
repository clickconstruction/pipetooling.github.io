import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { MAIL_SAVED_CHANNEL, MAIL_SAVED_WORDS } from './myMail/savedForYou'
import { MAIL_SAVED_TEMPLATE } from './myMail/savedForYouNames'
import { NEEDS_YOU_ITEM_ACTOR } from './needsYouActor'
import { NEEDS_YOU_SOURCES } from './needsYouSources'

/**
 * The notice is a record only (v2.7904). When a developer saves a teammate's mail onto a job, that teammate is told by
 * one `notification_history` row (v2.7068). The Needs you card drew a line from it, kicker *Your mail*, for seven
 * days. The owner saw the line on a user's Dashboard on 2026-11-19 and chose: *record only*. So the notice is still
 * written and still listed under Settings → Activity logs, and no Needs you line is built from it. This file holds
 * that decision; the record's own row is `SettingsRecentPushNotifications.render.test.tsx`.
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

/** The names the line stood on. A Needs you file that reads any of them has brought the line back. */
const LINE_NAMES = ['mailSaved', 'mail-saved', 'MailSaved', 'savedForYou', 'MAIL_SAVED', MAIL_SAVED_TEMPLATE]

/** Every file a Needs you line is wired through: its source, its input, its item, its door and its actor. */
const NEEDS_YOU_WIRING = ['src/lib/dashboardNeedsYou.ts', 'src/lib/needsYouSources.ts', 'src/lib/needsYouDoors.ts', 'src/lib/needsYouActor.ts', 'src/hooks/useNeedsYouInputs.ts']

describe('a mail-saved notice is a record only: no Needs you line', () => {
  it('builds no item from a notice, even when one is handed in as the old inputs carried it', () => {
    const need = { count: 2, title: 'Nadia Reyes saved 17 conversations from your mail to 7 jobs.', detail: 'It was today at 3:05 PM. Nothing changed in your Gmail.' }
    const old = { mailSavedEnabled: true, mailSaved: need } as Partial<NeedsYouInputs>
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      const items = buildNeedsYouItems(inputs({ role, ...old }))
      expect(items.filter((i) => (i.key as string) === 'mail-saved' || i.kicker === 'Your mail' || i.title === need.title || i.actionLabel === 'See the record'), role).toEqual([])
    }
  })

  it('has no source, no key and no actor for it', () => {
    expect(NEEDS_YOU_SOURCES as readonly string[]).not.toContain('mailSaved')
    expect(Object.keys(NEEDS_YOU_ITEM_ACTOR)).not.toContain('mail-saved')
  })

  it('no Needs you file reads the notice, and the hook and the read that fed the line are gone', () => {
    for (const file of NEEDS_YOU_WIRING) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      for (const name of LINE_NAMES) expect(source.includes(name), `${file} names ${name}`).toBe(false)
    }
    expect(existsSync(join(process.cwd(), 'src/hooks/useMailSavedForYou.ts'))).toBe(false)
    expect(existsSync(join(process.cwd(), 'src/lib/myMail/savedForYouIo.ts'))).toBe(false)
  })

  it('the record keeps its words: the notice is still an app row, and its row wears In the app', () => {
    expect([MAIL_SAVED_TEMPLATE, MAIL_SAVED_CHANNEL]).toEqual(['mail_saved_for_you', 'app'])
    expect(MAIL_SAVED_WORDS).toEqual({ badge: 'In the app' })
  })
})
