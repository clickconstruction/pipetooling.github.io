import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEEDS_YOU_RANK, buildNeedsYouItems, rankNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'
import type { OwnerRecordsSigned } from './jobs/ownerRecords'

/**
 * Records for an owner (punch list #86): the line that tells the office an owner signed for
 * the records on their portal and waits for the packet. Its own file: the shared builder test
 * is where every new card lands, and two cards' tests at its end conflict.
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

const one: OwnerRecordsSigned = { count: 1, first: { requestId: 'r1', jobId: 'j273', name: 'Umar Khan', address: '9703 Lenox Hl, San Antonio, TX', signedOn: '2026-10-06' } }
const card = (over: Partial<NeedsYouInputs>) => buildNeedsYouItems(inputs({ ownerRecordsSignedEnabled: true, ...over })).find((i) => i.key === 'owner-records-signed')

describe('owner-records-signed (punch list #86)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 1 PM in Chicago on Oct 9: the company calendar reads 2026-10-09.
    vi.setSystemTime(new Date('2026-10-09T18:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('names who signed and where, says how long they have waited, and opens their request', () => {
    const c = card({ ownerRecordsSigned: one })!
    expect(c).toMatchObject({ severity: 'amber', kicker: 'Records for an owner', title: 'Umar Khan signed for the records on 9703 Lenox Hl, San Antonio, TX', figure: '1', actionLabel: 'Open their request' })
    expect(c.detail).toBe('Signed on their portal Oct 6. They have waited 3 days. Finish the checks in the window, then press Record it as sent and pick On their portal. Their Download opens when you do.')
  })

  it('signed today reads no wait; several name the first and open it', () => {
    expect(card({ ownerRecordsSigned: { ...one, first: { ...one.first, signedOn: '2026-10-09' } } })!.detail).toBe('Signed on their portal Oct 9. Finish the checks in the window, then press Record it as sent and pick On their portal. Their Download opens when you do.')
    const many = card({ ownerRecordsSigned: { ...one, count: 3, first: { ...one.first, signedOn: '2026-10-08', address: '' } } })!
    expect(many.title).toBe('3 owners signed for their records on their portal')
    expect(many.detail.startsWith('The first is Umar Khan, on their property. Signed on their portal Oct 8. They have waited 1 day. ')).toBe(true)
    expect(many).toMatchObject({ figure: '3', actionLabel: 'Open the first' })
  })

  it('quiet when switched off, while loading, or with nobody waiting', () => {
    expect(card({ ownerRecordsSignedEnabled: false, ownerRecordsSigned: one })).toBeUndefined()
    expect(card({ ownerRecordsSigned: null })).toBeUndefined()
    expect(card({ ownerRecordsSigned: { ...one, count: 0 } })).toBeUndefined()
  })

  it('ranks with the other things owed to a customer, above the notice piles', () => {
    expect(NEEDS_YOU_RANK['owner-records-signed']).toBe(NEEDS_YOU_RANK['lien-unconditional'])
    expect(NEEDS_YOU_RANK['owner-records-signed']).toBeLessThan(NEEDS_YOU_RANK['lien-notice-draft'])
    const ranked = rankNeedsYouItems(buildNeedsYouItems(inputs({ ownerRecordsSignedEnabled: true, ownerRecordsSigned: one, tallyStaffEligible: true, tallyStaffStalePeopleCount: 2, tallyStaffStaleTxCount: 9 })))
    expect(ranked.findIndex((i) => i.key === 'owner-records-signed')).toBeLessThan(ranked.findIndex((i) => i.key === 'tally-team'))
  })
})
