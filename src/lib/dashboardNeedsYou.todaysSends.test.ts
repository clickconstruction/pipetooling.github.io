import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import { todaysSends, todaysSendsNeed, type OfferRow } from './offers/offers'

/**
 * The Today's sends row (punch list #424): the kernel's need becomes one Needs you item that says itself twice, as
 * plain words for Walk the list and a fold, and as marked values for the Cards row. Its own file, as the Customers
 * line has: two cards' tests at the shared file's end conflict.
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

// Sat Oct 17 2026, 11:00 AM Central.
const NOW = new Date('2026-10-17T16:00:00Z')
const offer = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: 'o1',
  contactId: 'c-dana',
  contactKind: 'residential',
  stepKey: 'approved',
  jobKey: 'pipeline:job-1312',
  body: 'Dana, any word on the estimate? Happy to walk through it.',
  channelId: 'ch-1',
  preparedAt: '2026-10-17T14:00:00Z',
  preparedBy: 'app',
  sendOn: null,
  aboutOn: null,
  heldWhy: null,
  ...over,
})
const need = (offers: OfferRow[]) =>
  todaysSendsNeed(todaysSends({ offers, names: { 'c-dana': 'Dana Whitfield', 'c-sam': 'Sam Ortiz', 'c-lee': 'Lee Park' }, numbers: { 'ch-1': '(830) 555-0121', 'ch-9': '(210) 555-0199' }, stepNames: { 'residential:approved': 'Approved' } }, NOW), NOW)
const row = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ todaysSendsEnabled: true, ...over })).find((i) => i.key === 'todays-sends')

describe('todays-sends: the row shows the texts (punch list #424)', () => {
  it('draws nothing while off, while nothing waits, or before the texts are read', () => {
    expect(row({ todaysSendsEnabled: false, todaysSends: need([offer()]) })).toBeUndefined()
    expect(row({ todaysSends: null })).toBeUndefined()
    expect(row({ todaysSends: need([]) })).toBeUndefined()
  })

  it('says how many can go and who to, in plain words and as marked values, and its press names the act', () => {
    const item = row({ todaysSends: need([offer(), offer({ id: 'o2', contactId: 'c-sam', channelId: 'ch-9' }), offer({ id: 'o3', contactId: 'c-lee', channelId: null })]) })!
    expect(item).toMatchObject({ severity: 'amber', kicker: 'Texts to customers', title: '2 texts to send', figure: '2', actionLabel: 'Read them' })
    // The plain words carry no marker: Walk the list and a fold's summary print them as they are.
    expect(item.detail).toBe('Dana Whitfield · Sam Ortiz · 1 held · no number')
    expect(`${item.title}${item.detail}`).not.toMatch(/[⟪⟫]/)
    // The Cards row draws these, each value apart from the fixed words.
    expect(item.shown).toEqual({
      title: '⟪n|2⟫ texts to send',
      names: '⟪who|Dana Whitfield⟫ · ⟪who|Sam Ortiz⟫',
      peek: null,
      chips: [{ kind: 'held', text: '⟪n|1⟫ held · ⟪why|no number⟫' }],
    })
    expect(NEEDS_YOU_RANK['todays-sends']).toBe(40)
  })

  it('a row with only timed texts is grey, since it needs nobody', () => {
    const item = row({ todaysSends: need([offer({ preparedBy: 'office', sendOn: '2026-10-20', sendAt: '2026-10-20T14:00:00Z' })]) })!
    expect(item).toMatchObject({ severity: 'gray', title: '1 text goes Tue 9:00 AM', actionLabel: 'See it', figure: '1' })
  })

  it('a held-only row counts the held and offers to fix them', () => {
    const item = row({ todaysSends: need([offer({ channelId: null })]) })!
    expect(item).toMatchObject({ severity: 'amber', title: '1 text cannot go', actionLabel: 'Fix it', figure: '1' })
  })
})
